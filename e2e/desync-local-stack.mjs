// Actual built site + actual signaling server + isolated PostgreSQL.
// The runner owns only its child server. It never stops an existing listener.
// Before running: build the vendored SDK/site and migrate a throwaway database.
// APP_URL=http://127.0.0.1:5840 DATABASE_URL=postgresql://...:6543/... \
//   node e2e/desync-local-stack.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, openSync, closeSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const siteRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const serverRoot = path.resolve(siteRoot, "../p2party-server");
const app = process.env.APP_URL ?? "http://127.0.0.1:5840";
const port = Number(process.env.DESYNC_SERVER_PORT ?? 5841);
const databaseUrl = process.env.DATABASE_URL;
assert(databaseUrl, "DATABASE_URL must identify a migrated throwaway database");
const database = new URL(databaseUrl);
assert(["127.0.0.1", "localhost", "[::1]"].includes(database.hostname));
assert(
  Number(database.port) > 5000,
  "the existing Postgres on 5432 is out of scope",
);
assert(Number.isSafeInteger(port) && port > 5000 && port <= 65535);
assert(
  new URL(app).hostname === "127.0.0.1" ||
    new URL(app).hostname === "localhost",
);
const signaling = `ws://127.0.0.1:${port}/ws`;
const healthUrl = `http://127.0.0.1:${port}/health`;
const started = new Date().toISOString();
const output = path.join(
  siteRoot,
  "logs",
  "desync",
  started.replaceAll(":", "-"),
);
mkdirSync(output, { recursive: true });
const serverLog = openSync(path.join(output, "server.log"), "a");
const report = { started, app, signaling, scenarios: {}, errors: [] };
const log = (...args) => console.log(new Date().toISOString(), ...args);
let server;
let browser;

async function waitFor(label, read, accept, timeout = 60000) {
  const until = Date.now() + timeout;
  let last;
  while (Date.now() < until) {
    last = await read();
    if (accept(last)) return last;
    await delay(250);
  }
  throw new Error(`${label}: timed out; last=${JSON.stringify(last)}`);
}

async function assertPortFree() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
}

async function startServer() {
  await assertPortFree();
  const env = { ...process.env, DATABASE_URL: databaseUrl, PORT: String(port) };
  delete env.COTURN_SECRET;
  delete env.COTURN_URLS;
  server = spawn(process.env.BUN ?? "bun", ["run", "src/index.ts"], {
    cwd: serverRoot,
    env,
    stdio: ["ignore", serverLog, serverLog],
  });
  let spawnError;
  server.once("error", (error) => {
    spawnError = error;
  });
  const health = await waitFor(
    "real signaling server starts",
    async () => {
      if (spawnError) throw spawnError;
      assert.equal(
        server.exitCode,
        null,
        "owned server exited before readiness",
      );
      try {
        return await (await fetch(healthUrl)).json();
      } catch {
        return null;
      }
    },
    (value) => value?.status === "ok",
    20000,
  );
  assert.equal(health.version, "0.1.2");
  assert.equal(health.protocolVersion, 4);
  log("server ready", { pid: server.pid, ...health });
  return health;
}

async function stopServer(signal = "SIGTERM") {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const child = server;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill(signal);
  await Promise.race([
    exited,
    delay(10000).then(() => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    }),
  ]);
  await exited;
}

async function newContext(tag) {
  const context = await browser.newContext();
  await context.addInitScript((url) => {
    localStorage.setItem("signalingServerUrl", JSON.stringify(url));
    window.__desync = {
      pcCreated: 0,
      dcSends: 0,
      wsOpened: 0,
      roomReplies: 0,
      wsCloses: [],
      pc: [],
    };
    const OriginalPC = window.RTCPeerConnection;
    class ObservedPC extends OriginalPC {
      constructor(...args) {
        super(...args);
        window.__desync.pcCreated++;
        window.__desync.pc.push(this);
      }
    }
    window.RTCPeerConnection = ObservedPC;
    const send = RTCDataChannel.prototype.send;
    RTCDataChannel.prototype.send = function (...args) {
      const result = send.apply(this, args);
      window.__desync.dcSends++;
      return result;
    };
    const OriginalWS = window.WebSocket;
    class ObservedWS extends OriginalWS {
      constructor(...args) {
        super(...args);
        this.addEventListener("open", () => window.__desync.wsOpened++);
        this.addEventListener("close", (event) =>
          window.__desync.wsCloses.push({ code: event.code, at: Date.now() }),
        );
        this.addEventListener("message", (event) => {
          try {
            if (JSON.parse(event.data).type === "roomId")
              window.__desync.roomReplies++;
          } catch {
            /* Binary/heartbeat data is not a room acknowledgement. */
          }
        });
      }
    }
    window.WebSocket = ObservedWS;
  }, signaling);
  context.on("page", (page) => {
    page.on("pageerror", (error) =>
      report.errors.push(`${tag}: ${error.message}`),
    );
  });
  return context;
}

const roomState = (roomUrl) => {
  const P = window.p2party;
  if (!P?.store) return null;
  const state = P.store.getState();
  const room = P.roomSelector(state).find((item) => item.url === roomUrl);
  const identity = P.keyPairSelector(state);
  const counters = window.__desync;
  return {
    roomId: room?.id,
    peerId: identity.peerId,
    publicKey: identity.publicKey,
    signaling: state.signalingServer,
    peers: room?.peers ?? [],
    handshakes: room?.handshakeStatusByPeer ?? {},
    counters: {
      pcCreated: counters.pcCreated,
      dcSends: counters.dcSends,
      wsOpened: counters.wsOpened,
      roomReplies: counters.roomReplies,
      wsCloses: counters.wsCloses,
      pcStates: counters.pc.map((pc) => pc.connectionState),
    },
  };
};

function invite(pin = false) {
  const capability = randomBytes(32);
  return {
    roomUrl: capability.toString("hex"),
    url: `${app}/r#v1.${capability.toString("base64url")}${pin ? "&auth=pin" : ""}`,
  };
}

async function join(context, invitation, pin) {
  const page = await context.newPage();
  await page.goto(invitation.url, { waitUntil: "domcontentloaded" });
  if (pin)
    await page
      .getByLabel("Room PIN", { exact: false })
      .fill(pin, { timeout: 30000 });
  // A second tab may reuse the user's room consent and connect automatically.
  // Both paths are normal UI behavior; never invoke the SDK connect function.
  const connect = page.getByRole("button", { name: "Connect", exact: true });
  await waitFor(
    "join dialog or remembered room consent",
    async () => {
      if (await connect.isVisible()) {
        await connect.click();
        return true;
      }
      return !!(await page.evaluate(roomState, invitation.roomUrl))?.roomId;
    },
    Boolean,
    30000,
  );
  return page;
}

async function authenticatedPair(pages, roomUrl, timeout = 60000) {
  return waitFor(
    "both room edges authenticated",
    () => Promise.all(pages.map((page) => page.evaluate(roomState, roomUrl))),
    (states) =>
      states.every((state, index) => {
        const other = states[1 - index];
        return (
          state?.signaling?.isVerified &&
          other?.peerId &&
          state.peers.some((peer) => peer.peerId === other.peerId) &&
          state.handshakes[other.peerId]?.status === "authenticated"
        );
      }),
    timeout,
  );
}

async function sendThroughUi(sender, receiver, text) {
  await sender
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(text);
  await sender
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await receiver.getByText(text, { exact: true }).waitFor({ timeout: 60000 });
}

try {
  report.initialHealth = await startServer();
  browser = await chromium.launch({ headless: true });
  const A = await newContext("A");
  const B = await newContext("B");
  const invitation = invite();
  const a = await join(A, invitation);
  const b = await join(B, invitation);
  const initial = await authenticatedPair([a, b], invitation.roomUrl);
  await sendThroughUi(a, b, `before-restart-${randomBytes(6).toString("hex")}`);
  const afterSend = await a.evaluate(roomState, invitation.roomUrl);
  assert(
    afterSend.counters.dcSends > initial[0].counters.dcSends,
    "UI message must use a real RTC data channel",
  );
  report.scenarios.roomExchange = { passed: true };
  log("PASS room exchange through UI over WebRTC");

  const reloadAt = Date.now();
  await a.reload({ waitUntil: "domcontentloaded" });
  const reloaded = await authenticatedPair([a, b], invitation.roomUrl);
  assert.equal(reloaded[0].peerId, initial[0].peerId);
  await sendThroughUi(b, a, `after-reload-${randomBytes(6).toString("hex")}`);
  report.scenarios.pageReload = {
    passed: true,
    rejoinMs: Date.now() - reloadAt,
  };
  log(
    "PASS remembered room consent rejoins after reload",
    report.scenarios.pageReload,
  );

  const beforeRestart = await Promise.all(
    [a, b].map((page) => page.evaluate(roomState, invitation.roomUrl)),
  );
  await stopServer("SIGKILL");
  await waitFor(
    "both clients observe server loss without UI activity",
    () =>
      Promise.all(
        [a, b].map((page) => page.evaluate(roomState, invitation.roomUrl)),
      ),
    (states) => states.every((state) => !state.signaling.isConnected),
    15000,
  );
  await delay(5000);
  const restartAt = Date.now();
  report.restartedHealth = await startServer();
  assert.notEqual(
    report.initialHealth.serverId,
    report.restartedHealth.serverId,
  );
  const rejoined = await waitFor(
    "both clients verify and rejoin without focus/click/reload",
    () =>
      Promise.all(
        [a, b].map((page) => page.evaluate(roomState, invitation.roomUrl)),
      ),
    (states) =>
      states.every(
        (state, index) =>
          state.signaling.isVerified &&
          state.counters.wsOpened > beforeRestart[index].counters.wsOpened &&
          state.counters.roomReplies >
            beforeRestart[index].counters.roomReplies,
      ),
    60000,
  );
  const reconnectMs = Date.now() - restartAt;
  await authenticatedPair([a, b], invitation.roomUrl);
  await sendThroughUi(b, a, `after-restart-${randomBytes(6).toString("hex")}`);
  report.scenarios.serverRestart = {
    passed: true,
    reconnectMs,
    counters: rejoined.map((state) => state.counters),
  };
  log("PASS unattended server restart", { reconnectMs });

  // Replace the identity responder deliberately: it cannot open the main
  // channel itself, which is the socket-generation regression's hard case.
  const replaceA = rejoined[0].publicKey > rejoined[1].publicKey;
  const oldTab = replaceA ? a : b;
  const otherTab = replaceA ? b : a;
  const replacedIdentity = await oldTab.evaluate(roomState, invitation.roomUrl);
  const tabAt = Date.now();
  const replacementTab = await join(replaceA ? A : B, invitation);
  const tabStates = await authenticatedPair(
    [replacementTab, otherTab],
    invitation.roomUrl,
    Math.max(1, 20000 - (Date.now() - tabAt)),
  );
  const authenticationMs = Date.now() - tabAt;
  assert(
    authenticationMs <= 20000,
    `replacement tab took ${authenticationMs} ms`,
  );
  assert.equal(
    tabStates[0].peerId,
    replacedIdentity.peerId,
    "new tab must reuse the same identity",
  );
  await waitFor(
    "old tab receives identity eviction",
    () => oldTab.evaluate(roomState, invitation.roomUrl),
    (state) => state.counters.wsCloses.some((close) => close.code === 1008),
    10000,
  );
  await sendThroughUi(
    replacementTab,
    otherTab,
    `replacement-tab-${randomBytes(6).toString("hex")}`,
  );
  report.scenarios.secondTab = {
    passed: true,
    replacedRole: "responder",
    authenticationMs,
    oldTab: (await oldTab.evaluate(roomState, invitation.roomUrl)).counters,
  };
  log("PASS same-identity second tab", { authenticationMs });
  await A.close();
  await B.close();

  const hostContext = await newContext("PIN host");
  const joinerContext = await newContext("PIN joiner");
  const pinInvitation = invite(true);
  const host = await join(
    hostContext,
    pinInvitation,
    "correct-horse-battery-staple",
  );
  const joiner = await join(
    joinerContext,
    pinInvitation,
    "correct-horse-battery-staplf",
  );
  const pinPages = [host, joiner];
  const failed = await waitFor(
    "both clients show terminal PIN failure",
    () =>
      Promise.all(
        pinPages.map((page) => page.evaluate(roomState, pinInvitation.roomUrl)),
      ),
    (states) =>
      states.every((state) =>
        Object.values(state?.handshakes ?? {}).some(
          (status) =>
            status.status === "failed" &&
            /pin-mismatch|pin-throttled/.test(status.reason),
        ),
      ),
    60000,
  );
  const pinPcCounts = failed.map((state) => state.counters.pcCreated);
  const pinStart = Date.now();
  let samples = 0;
  while (Date.now() - pinStart < 120000) {
    for (const [index, page] of pinPages.entries()) {
      const state = await page.evaluate(roomState, pinInvitation.roomUrl);
      assert.equal(
        state.counters.pcCreated,
        pinPcCounts[index],
        "PIN failure must not create replacement transports",
      );
      assert(
        Object.values(state.handshakes).some(
          (status) =>
            status.status === "failed" &&
            /pin-mismatch|pin-throttled/.test(status.reason),
        ),
        "PIN failure must remain in SDK state",
      );
      assert(
        !Object.values(state.handshakes).some(
          (status) => status.status === "authenticated",
        ),
        "wrong PIN must never authenticate",
      );
      const banner = page
        .getByRole("status")
        .filter({ hasText: /PIN did not match|Too many PIN attempts/i });
      assert(await banner.isVisible(), "PIN failure banner must stay visible");
    }
    samples++;
    await delay(1000);
  }
  report.scenarios.wrongPin = {
    passed: true,
    observedMs: Date.now() - pinStart,
    samples,
    pcCreated: pinPcCounts,
  };
  log(
    "PASS wrong-PIN failure remains visible without transport churn",
    report.scenarios.wrongPin,
  );
  await joiner
    .getByRole("button", { name: "Enter the PIN again", exact: true })
    .click();
  const retryPin = joiner.getByLabel("Room PIN", { exact: false });
  await retryPin.fill("correct-horse-battery-staple");
  await joiner.getByRole("button", { name: "Connect", exact: true }).click();
  await authenticatedPair(pinPages, pinInvitation.roomUrl);
  await sendThroughUi(
    joiner,
    host,
    `corrected-pin-${randomBytes(6).toString("hex")}`,
  );
  report.scenarios.correctedPin = { passed: true };
  log(
    "PASS deliberate corrected-PIN retry authenticates and exchanges a message",
  );
  await hostContext.close();
  await joinerContext.close();
  assert.deepEqual(report.errors, [], "browser page errors are failures");
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = error.stack ?? String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await stopServer();
  closeSync(serverLog);
  report.finished = new Date().toISOString();
  writeFileSync(
    path.join(output, "result.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  log("report", path.join(output, "result.json"));
}
