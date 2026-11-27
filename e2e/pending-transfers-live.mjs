// Built site + real vendored SDK + real signaling server. The default boot
// mirrors desync-local-stack.mjs and owns only its child server. To use an
// already running server, provide SIGNALING_URL instead of DATABASE_URL.
// APP_URL=http://127.0.0.1:5840 DATABASE_URL=postgresql://...:6543/... \
//   DESYNC_SERVER_PORT=5841 node e2e/pending-transfers-live.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";

const siteRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const app = process.env.APP_URL ?? "http://127.0.0.1:5840";
const port = Number(process.env.DESYNC_SERVER_PORT ?? 5841);
const signaling = process.env.SIGNALING_URL ?? `ws://127.0.0.1:${port}/ws`;
for (const url of [new URL(app), new URL(signaling)])
  assert(
    ["127.0.0.1", "localhost"].includes(url.hostname),
    "Only a local stack is allowed",
  );
assert(port > 5000 && port <= 65535 && Number.isInteger(port));
const sdk = JSON.parse(
  readFileSync(
    path.join(siteRoot, "node_modules/p2party/package.json"),
    "utf8",
  ),
);
const siteManifest = JSON.parse(
  readFileSync(path.join(siteRoot, "package.json"), "utf8"),
);
const sdkArtifact = siteManifest.dependencies.p2party.slice("file:".length);
const output = path.join(
  siteRoot,
  "logs/desync",
  `pending-ui-${new Date().toISOString().replaceAll(":", "-")}.json`,
);
mkdirSync(path.dirname(output), { recursive: true });
const report = {
  app,
  signaling,
  sdk: sdk.version,
  artifact: sdkArtifact,
  artifactSha256: createHash("sha256")
    .update(readFileSync(path.join(siteRoot, sdkArtifact)))
    .digest("hex"),
  scenarios: {},
  pageErrors: [],
  wasmResponses: [],
  passed: false,
};
let server;
let browser;

async function until(label, read, accept, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  let latest;
  while (Date.now() < deadline) {
    latest = await read();
    if (accept(latest)) return latest;
    await delay(200);
  }
  throw new Error(`${label}: timed out; last=${JSON.stringify(latest)}`);
}

async function startServer() {
  if (process.env.SIGNALING_URL) return;
  const serverRoot = path.resolve(siteRoot, "../p2party-server");
  const serverManifest = JSON.parse(
    readFileSync(path.join(serverRoot, "package.json"), "utf8"),
  );
  const databaseUrl = process.env.DATABASE_URL;
  assert(
    databaseUrl,
    "Set DATABASE_URL to a migrated throwaway database, or SIGNALING_URL to the existing local server",
  );
  const database = new URL(databaseUrl);
  assert(["localhost", "127.0.0.1", "[::1]"].includes(database.hostname));
  assert(
    Number(database.port) > 5000 && Number(database.port) !== 5432,
    "The existing PostgreSQL on5432 is out of scope",
  );
  if (!database.searchParams.has("sslmode"))
    database.searchParams.set("sslmode", "disable");
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => probe.close(resolve));
  const env = {
    ...process.env,
    DATABASE_URL: database.toString(),
    PORT: String(port),
    SIGNALING_HOST: new URL(signaling).host,
  };
  delete env.COTURN_SECRET;
  delete env.COTURN_URLS;
  server = spawn(
    process.env.BUN ?? "bun",
    ["run", "--no-env-file", "src/index.ts"],
    {
      cwd: serverRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", () => undefined);
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  const health = await until(
    "real signaling server health",
    async () => {
      assert.equal(
        server.exitCode,
        null,
        "Owned server exited before readiness",
      );
      try {
        return await (await fetch(`http://127.0.0.1:${port}/health`)).json();
      } catch {
        return null;
      }
    },
    (value) => value?.ok === true || value?.status === "ok" || value?.serverId,
    30_000,
  );
  assert.equal(health.version, serverManifest.version);
  assert.equal(health.protocolVersion, 4);
  report.server = health;
}

async function context(label, dropChunks = false) {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ signaling, dropChunks }) => {
      if (!location.origin.startsWith("http")) return;
      localStorage.setItem("signalingServerUrl", JSON.stringify(signaling));
      if (!dropChunks) return;
      const send = RTCDataChannel.prototype.send;
      window.pendingChunkFault = { seen: 0, dropped: 0 };
      RTCDataChannel.prototype.send = function (data) {
        const bytes =
          data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : ArrayBuffer.isView(data)
              ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
              : null;
        // Observe a real durable partial while preserving handshake, receipt,
        // capability and CANCEL controls. Reinstalled after sender reload.
        if (bytes?.length === 65490 && bytes[0] === 2) {
          window.pendingChunkFault.seen++;
          if (window.pendingChunkFault.seen > 4) {
            window.pendingChunkFault.dropped++;
            return;
          }
        }
        return send.call(this, data);
      };
    },
    { signaling, dropChunks },
  );
  context.on("page", (page) =>
    page.on("pageerror", (error) =>
      report.pageErrors.push(`${label}: ${error.message}`),
    ),
  );
  context.on("response", (response) => {
    if (response.url().includes("libcrypto.wasm"))
      report.wasmResponses.push({
        label,
        url: response.url(),
        status: response.status(),
      });
  });
  return context;
}

function invitation() {
  const bytes = randomBytes(32);
  return {
    capability: bytes.toString("hex"),
    url: `${app}/r#v1.${bytes.toString("base64url")}`,
  };
}

const snapshot = (capability) => {
  const P = window.p2party;
  if (!P?.store) return null;
  const state = P.store.getState();
  const room = P.roomSelector(state).find((room) => room.url === capability);
  return {
    id: room?.id,
    publicKey: P.keyPairSelector(state).publicKey,
    verified: state.signalingServer.isVerified,
    handshakes: room?.handshakeStatusByPeer ?? {},
    messages: room?.messages ?? [],
  };
};

async function join(page, invite, navigate = true) {
  if (navigate) await page.goto(invite.url, { waitUntil: "domcontentloaded" });
  await until(
    "room consent/admission",
    async () => {
      const button = page.getByRole("button", { name: "Connect", exact: true });
      if (await button.isVisible()) await button.click();
      return page.evaluate(snapshot, invite.capability);
    },
    (value) => !!value?.id && value.verified,
    45_000,
  );
}

const navigateInsideApp = (page, url) =>
  page.evaluate((url) => {
    history.pushState(null, "", url);
    dispatchEvent(new PopStateEvent("popstate"));
  }, url);

try {
  await startServer();
  browser = await chromium.launch({ headless: true });
  const senderContext = await context("sender", true),
    receiverContext = await context("receiver");
  const sender = await senderContext.newPage(),
    receiver = await receiverContext.newPage();
  const room = invitation();
  await Promise.all([join(sender, room), join(receiver, room)]);
  const identities = await until(
    "authenticated real peer edge",
    async () =>
      Promise.all(
        [sender, receiver].map((page) =>
          page.evaluate(snapshot, room.capability),
        ),
      ),
    (values) =>
      values.every((value, index) =>
        Object.values(value.handshakes).some(
          (status) =>
            status.status === "authenticated" &&
            status.peerPublicKey === values[1 - index].publicKey,
        ),
      ),
  );
  assert(
    await sender.evaluate(
      () => typeof window.p2party.listPendingMessages === "function",
    ),
    "The built site needs the final outbox-capable SDK",
  );
  const payload = Buffer.alloc(1024 * 1024);
  for (let i = 0; i < payload.length; i++) payload[i] = (i * 17 + 29) & 255;
  const filename = `pending-ui-${randomBytes(4).toString("hex")}.bin`;
  report.payload = {
    filename,
    size: payload.length,
    sha256: createHash("sha256").update(payload).digest("hex"),
  };
  await sender.locator('input[type="file"]').setInputFiles({
    name: filename,
    mimeType: "application/octet-stream",
    buffer: payload,
  });
  const partial = await until(
    "real receiver has partial bytes",
    () => receiver.evaluate(snapshot, room.capability),
    (value) =>
      value.messages.some(
        (message) =>
          message.filename === filename &&
          message.savedSize > 0 &&
          message.savedSize < message.totalSize,
      ),
  );
  const incoming = partial.messages.find(
    (message) => message.filename === filename,
  );
  const before = await sender.evaluate(async (capability) => {
    const room = window.p2party
      .roomSelector(window.p2party.store.getState())
      .find((room) => room.url === capability);
    return window.p2party.listPendingMessages(room.id);
  }, room.capability);
  const pending = before.find((message) => message.filename === filename);
  assert(pending && pending.merkleRootHex === incoming.merkleRootHex);
  report.scenarios.preparedPartial = {
    transferId: pending.transferId,
    root: pending.merkleRootHex,
    received: incoming.savedSize,
  };

  await sender.reload({ waitUntil: "domcontentloaded" });
  await join(sender, room, false);
  await until(
    "same sender identity and exact receiver authenticated after reload",
    () =>
      Promise.all(
        [sender, receiver].map((page) =>
          page.evaluate(snapshot, room.capability),
        ),
      ),
    (values) =>
      values.every(
        (value, index) =>
          value.publicKey === identities[index].publicKey &&
          Object.values(value.handshakes).some(
            (status) =>
              status.status === "authenticated" &&
              status.peerPublicKey === identities[1 - index].publicKey,
          ),
      ),
  );
  const readAttempt = () =>
    sender.evaluate(
      async ({ roomId, transferId }) => ({
        row: (await window.p2party.listPendingMessages(roomId)).find(
          (row) => row.transferId === transferId,
        ),
        fault: { ...window.pendingChunkFault },
      }),
      { roomId: pending.roomId, transferId: pending.transferId },
    );
  const automatic = await until(
    "real automatic resume emits fresh chunk frames after reload",
    readAttempt,
    (value) =>
      value.row?.phase === "sending" &&
      value.fault.seen > 4 &&
      value.fault.dropped > 0,
  );
  report.scenarios.automaticResume = automatic;
  const panel = sender.getByRole("region", {
    name: "Pending transfers",
    exact: true,
  });
  await expect(panel.getByText(filename, { exact: true })).toBeVisible({
    timeout: 45_000,
  });
  report.scenarios.visibleAfterReload = true;
  // The payload is small enough to stay below the receipt-window cap. The
  // real resumed attempt therefore exhausts normally under our frame fault.
  await until(
    "real automatic attempt settles as pending",
    async () => {
      const rows = await sender.evaluate(
        (roomId) => window.p2party.listPendingMessages(roomId),
        pending.roomId,
      );
      return rows.find((row) => row.transferId === pending.transferId);
    },
    (row) => row?.phase === "pending" && row.retryAfter <= Date.now(),
    180_000,
  );
  const retry = panel.getByRole("button", {
    name: "Retry pending transfers",
    exact: true,
  });
  await expect(retry).toBeEnabled();
  const beforeManual = await readAttempt();
  await retry.click();
  const manual = await until(
    "manual retry owns durable send and emits new frames",
    readAttempt,
    (value) =>
      value.row?.phase === "sending" &&
      value.fault.seen > beforeManual.fault.seen,
    15_000,
  );
  report.scenarios.manualResume = manual;
  await expect(
    panel.getByRole("button", { name: "Retrying…", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", {
      name: `Cancel pending ${filename}`,
      exact: true,
    }),
  ).toBeEnabled();

  const secondRoom = invitation();
  await navigateInsideApp(sender, secondRoom.url);
  await join(sender, secondRoom, false);
  await navigateInsideApp(sender, room.url);
  await join(sender, room, false);
  await expect(panel.getByText(filename, { exact: true })).toBeVisible();
  const cancel = panel.getByRole("button", {
    name: `Cancel pending ${filename}`,
    exact: true,
  });
  await expect(cancel).toBeEnabled();
  await expect(
    panel.getByRole("button", { name: "Retrying…", exact: true }),
  ).toBeVisible();
  const atCancel = await readAttempt();
  assert.equal(
    atCancel.row?.phase,
    "sending",
    "Retry must still be in flight when Cancel is clicked",
  );
  assert(
    atCancel.fault.seen > beforeManual.fault.seen,
    "Manual retry must emit real frames",
  );
  report.scenarios.inFlightAtCancel = atCancel;
  await cancel.click();
  await expect(panel.getByText(filename, { exact: true })).toHaveCount(0);
  await until(
    "outbox gone after UI cancellation",
    () =>
      sender.evaluate(
        (roomId) => window.p2party.listPendingMessages(roomId),
        pending.roomId,
      ),
    (rows) => !rows.some((row) => row.transferId === pending.transferId),
  );
  await until(
    "receiver partial removed after explicit UI cancellation",
    () => receiver.evaluate(snapshot, room.capability),
    (value) =>
      !value.messages.some(
        (message) => message.merkleRootHex === pending.merkleRootHex,
      ),
    30_000,
  );
  report.scenarios.cancelDuringManualRetry = true;
  report.scenarios.navigationKeepsCancellationUsable = true;
  assert.deepEqual(report.pageErrors, []);
  for (const label of ["sender", "receiver"])
    assert(
      report.wasmResponses.some(
        (response) =>
          response.label === label &&
          response.status === 200 &&
          response.url ===
            `${new URL(app).origin}/vendor/p2party-${sdk.version}/libcrypto.wasm`,
      ),
    );
  report.passed = true;
  console.log(
    "PASS built-site pending reload, live retry cancellation and room navigation",
  );
} catch (error) {
  report.failure = error.stack ?? String(error);
  process.exitCode = 1;
  console.error(error);
} finally {
  await browser?.close();
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill("SIGTERM");
    await Promise.race([exited, delay(10_000)]);
    if (server.exitCode === null && server.signalCode === null)
      server.kill("SIGKILL");
    await exited;
  }
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log("report", output);
}
