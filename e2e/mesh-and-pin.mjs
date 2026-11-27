// Two verifications the suite did not previously cover, both against the real
// protocol-v5 signaling server and real WebRTC:
//
//   1. n=3 full app-stack mesh — three browser contexts in one room, every
//      pair authenticated, and a message from one peer delivered byte-exact
//      to BOTH others (the prior suite only ever proved n=2).
//   2. Wrong-PIN recovery — a joiner with the wrong PIN must fail the
//      authenticated handshake, the UI must SAY so (not sit on "Waiting for
//      peers"). Explicit PIN re-entry on both clients must restore the edge.
//      A persisted backoff must disable retry and show its deadline.
//
// Usage: SIGNALING_URL=ws://localhost:3999/ws node e2e/mesh-and-pin.mjs
import { chromium } from "playwright";
import { createHash, randomBytes } from "crypto";

const APP = process.env.APP_URL ?? "http://localhost:5190";
const SIGNALING = process.env.SIGNALING_URL ?? "";
const STUN = process.env.STUN_URL;
const log = (...a) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

const newContext = async (browser, tag) => {
  const context = await browser.newContext();
  if (SIGNALING)
    await context.addInitScript(
      ({ url, stun }) => {
        localStorage.setItem("signalingServerUrl", JSON.stringify(url));
        if (
          stun ||
          ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
        )
          localStorage.setItem(
            "stunServerUrls",
            JSON.stringify(stun ? [stun] : []),
          );
      },
      { url: SIGNALING, stun: STUN },
    );
  const page = await context.newPage();
  page.on("pageerror", (e) =>
    log(`${tag} pageerror:`, e.message.slice(0, 160)),
  );
  return { context, page };
};

const waitFor = async (page, fn, arg, { timeout = 60000, label }) => {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await page.evaluate(fn, arg);
    if (last) return last;
    await page.waitForTimeout(400);
  }
  throw new Error(`timeout: ${label} (last=${JSON.stringify(last)})`);
};

const roomState = (url) => {
  const P = window.p2party;
  if (!P?.store) return null;
  const room = (P.roomSelector(P.store.getState()) || []).find(
    (r) => r.url === url,
  );
  if (!room) return null;
  return {
    id: room.id,
    peers: room.peers.length,
    handshakes: room.handshakeStatusByPeer ?? {},
    messages: room.messages.length,
  };
};

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    // ---------- 1. n=3 mesh ----------
    {
      const capability = randomBytes(32);
      const roomUrl = capability.toString("hex");
      const roomPath = `${APP}/r#v1.${capability.toString("base64url")}`;
      const ctxs = [];
      for (const tag of ["A", "B", "C"])
        ctxs.push(await newContext(browser, tag));

      for (const [i, { page }] of ctxs.entries()) {
        await page.goto(roomPath, { waitUntil: "domcontentloaded" });
        await page
          .getByRole("button", { name: "Connect", exact: true })
          .click({ timeout: 30000 });
        log(`peer ${String(i)} connected`);
      }

      // Every peer must see BOTH others, and every edge must authenticate.
      for (const [i, { page }] of ctxs.entries()) {
        const state = await waitFor(
          page,
          (url) => {
            const P = window.p2party;
            if (!P?.store) return null;
            const room = (P.roomSelector(P.store.getState()) || []).find(
              (r) => r.url === url,
            );
            if (!room || room.peers.length < 2) return null;
            const hs = room.handshakeStatusByPeer ?? {};
            const authed = room.peers.filter(
              (p) => hs[p.peerId]?.status === "authenticated",
            ).length;
            return authed >= 2 ? { peers: room.peers.length, authed } : null;
          },
          roomUrl,
          {
            label: `peer ${String(i)} sees 2 authenticated edges`,
            timeout: 90000,
          },
        );
        log(`peer ${String(i)} mesh: ${JSON.stringify(state)}`);
      }
      log("✅ n=3 MESH: every peer authenticated both of its edges");

      // A sends one message; B and C must both receive the exact bytes.
      const payload = `mesh-${roomUrl.slice(0, 8)}-${"x".repeat(64)}`;
      const roomId = (await ctxs[0].page.evaluate(roomState, roomUrl)).id;
      await ctxs[0].page.evaluate(
        ({ text, roomId }) => window.p2party.sendMessage(text, "main", roomId),
        { text: payload, roomId },
      );
      log("peer 0 sent a message to the room");

      for (const [i, { page }] of ctxs.slice(1).entries()) {
        const got = await waitFor(
          page,
          async ({ url, expect }) => {
            const P = window.p2party;
            const room = (P.roomSelector(P.store.getState()) || []).find(
              (r) => r.url === url,
            );
            if (!room) return null;
            for (const m of room.messages) {
              if (!m.merkleRootHex) continue;
              const res = await P.readMessage(m.merkleRootHex);
              if (res.percentage === 100 && res.message === expect)
                return { ok: true, cells: m.chunksReceivedTotal ?? 0 };
            }
            return null;
          },
          { url: roomUrl, expect: payload },
          {
            label: `peer ${String(i + 1)} receives the message`,
            timeout: 90000,
          },
        );
        log(
          `peer ${String(i + 1)} received byte-exact: ${JSON.stringify(got)}`,
        );
      }
      log("✅ n=3 DELIVERY: one send reached both remote peers byte-exact");
      for (const { context } of ctxs) await context.close();
    }

    // ---------- 2. wrong-PIN recovery ----------
    {
      const capability = randomBytes(32);
      const roomUrl = capability.toString("hex");
      const roomPath = `${APP}/r#v1.${capability.toString("base64url")}&auth=pin`;
      const host = await newContext(browser, "host");
      const joiner = await newContext(browser, "joiner");

      const enterPin = async (page, pin) => {
        const field = page.getByLabel("Room PIN", { exact: false });
        await field.waitFor({ timeout: 30000 });
        await field.fill(pin);
        await page
          .getByRole("button", { name: "Connect", exact: true })
          .click();
      };

      await host.page.goto(roomPath, { waitUntil: "domcontentloaded" });
      await enterPin(host.page, "correct-horse-battery-staple");
      log("host joined the PIN room with the correct PIN");
      await joiner.page.goto(roomPath, { waitUntil: "domcontentloaded" });
      await enterPin(joiner.page, "definitely-the-wrong-pin");
      log("joiner attempted with a WRONG PIN");

      // The library must classify the failure, and the UI must show it.
      const failure = await waitFor(
        host.page,
        (url) => {
          const P = window.p2party;
          const room = (P.roomSelector(P.store.getState()) || []).find(
            (r) => r.url === url,
          );
          const hs = room?.handshakeStatusByPeer ?? {};
          const failed = Object.values(hs).find((v) => v.status === "failed");
          return failed ?? null;
        },
        roomUrl,
        { label: "host records a failed handshake", timeout: 90000 },
      );
      log(`host handshake failure: ${JSON.stringify(failure)}`);
      if (
        failure.reason !== "pin-mismatch" &&
        failure.reason !== "pin-throttled"
      )
        failures.push(
          `expected a PIN failure reason, got ${String(failure.reason)}`,
        );

      const banner = await host.page
        .getByRole("status")
        .first()
        .textContent()
        .catch(() => null);
      log(`host banner: ${JSON.stringify(banner)}`);
      if (!banner || !/PIN|settings|reach/i.test(banner))
        failures.push("the failure banner did not render an explanation");
      else
        log(
          "✅ WRONG PIN: the UI states the reason instead of waiting forever",
        );

      // The joiner is the side that actually got it wrong, and the side the
      // failure used to be invisible on: its edge is torn down, signaling
      // drops the peer, and a banner keyed on the roster had nothing left to
      // render. It must see the reason AND a way back to the PIN field.
      const joinerRoster = await joiner.page.evaluate(roomState, roomUrl);
      log(
        `joiner roster: ${JSON.stringify(joinerRoster?.peers ?? null)} peer(s)`,
      );
      const joinerBanner = await joiner.page
        .getByRole("status")
        .first()
        .textContent()
        .catch(() => null);
      log(`joiner banner: ${JSON.stringify(joinerBanner)}`);
      if (!joinerBanner || !/PIN/i.test(joinerBanner))
        failures.push("the joiner was not told its PIN was wrong");
      else log("✅ WRONG PIN: the joiner is told, not left in an empty room");

      // Each client retains its own terminal failure until the user retries.
      // Open both dialogs before re-entering the PIN so neither misses the
      // retry while its peer is still showing the previous attempt.
      for (const { page } of [joiner, host]) {
        const button = page.getByRole("button", {
          name: /Enter the PIN again|Try again in/,
        });
        await button.click({ timeout: 30000 });
        const field = page.getByLabel("Room PIN");
        await field.waitFor();
        if (
          (await field.inputValue()) !== "" ||
          /already loaded/i.test(
            (await field.getAttribute("placeholder")) ?? "",
          )
        )
          throw new Error("PIN retry retained the rejected secret");
      }
      await Promise.all(
        [joiner, host].map(({ page }) =>
          enterPin(page, "correct-horse-battery-staple"),
        ),
      );
      for (const { page } of [host, joiner]) {
        await waitFor(
          page,
          (url) => {
            const P = window.p2party;
            const room = P.roomSelector(P.store.getState()).find(
              (r) => r.url === url,
            );
            return room?.peers.some(
              (peer) =>
                room.handshakeStatusByPeer?.[peer.peerId]?.status ===
                "authenticated",
            );
          },
          roomUrl,
          {
            label: "explicit PIN re-entry restores a verified edge",
            timeout: 30000,
          },
        );
      }
      log("✅ PIN RETRY: both peers authenticated after explicit PIN re-entry");
      // Resume a persisted per-identity backoff in a fresh room. Driving the
      // retry button on the host clears its limits by design, and repeating a
      // rejected peer's handshake without user consent is also disallowed.
      const nextCapability = randomBytes(32);
      const nextPath = `${APP}/r#v1.${nextCapability.toString("base64url")}&auth=pin`;
      const locator = createHash("sha512")
        .update(nextCapability.toString("hex"))
        .digest("hex");
      await Promise.all([host, joiner].map(({ page }) => page.goto(APP)));
      await host.page.goto(nextPath);
      await enterPin(host.page, "correct-horse-battery-staple");
      await host.page.getByLabel("Room PIN").waitFor({ state: "hidden" });
      const retryAfter = Date.now() + 60_000;
      await host.page.evaluate(
        ({ locator, peer, retryAfter }) =>
          new Promise((resolve, reject) => {
            const open = indexedDB.open("p2party");
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const tx = db.transaction("meta", "readwrite");
              tx.objectStore("meta").put(
                { failures: 10, retryAfter },
                `pinAttempts:v2:${locator.length}:${locator}:${peer}`,
              );
              tx.oncomplete = () => {
                db.close();
                resolve();
              };
              tx.onabort = () => {
                db.close();
                reject(tx.error);
              };
            };
          }),
        { locator, peer: failure.peerPublicKey, retryAfter },
      );
      await joiner.page.goto(nextPath);
      await enterPin(joiner.page, "correct-horse-battery-staple");
      const countdown = host.page.getByRole("button", { name: /Try again in/ });
      await countdown.waitFor({ timeout: 20000 });
      if (!(await countdown.isDisabled()))
        throw new Error("PIN retry enabled before its deadline");
      const state = await host.page.evaluate(
        roomState,
        nextCapability.toString("hex"),
      );
      if (
        !Object.values(state.handshakes).some(
          (hs) => hs.reason === "pin-throttled" && hs.retryAfter === retryAfter,
        )
      )
        throw new Error("PIN backoff lost its persisted deadline");
      log(
        "✅ PIN BACKOFF: the host enforced the saved deadline and disabled retry",
      );
      await host.context.close();
      await joiner.context.close();
    }
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    for (const f of failures) log(`❌ ${f}`);
    process.exit(1);
  }
  log("✅ ALL CHECKS PASSED");
};

run().catch((error) => {
  log(`❌ FAILED: ${error.message}`);
  process.exit(1);
});
