// Two verifications the suite did not previously cover, both against the real
// protocol-v4 signaling server and real WebRTC:
//
//   1. n=3 full app-stack mesh — three browser contexts in one room, every
//      pair authenticated, and a message from one peer delivered byte-exact
//      to BOTH others (the prior suite only ever proved n=2).
//   2. Wrong-PIN backoff — a joiner with the wrong PIN must fail the
//      authenticated handshake, the UI must SAY so (not sit on "Waiting for
//      peers"), and repeated attempts must be throttled with a retry
//      deadline.
//
// Usage: SIGNALING_URL=ws://localhost:3999/ws node e2e/mesh-and-pin.mjs
import { chromium } from "playwright";
import { randomBytes } from "crypto";

const APP = process.env.APP_URL ?? "http://localhost:5190";
const SIGNALING = process.env.SIGNALING_URL ?? "";
const log = (...a) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

const newContext = async (browser, tag) => {
  const context = await browser.newContext();
  if (SIGNALING)
    await context.addInitScript((url) => {
      localStorage.setItem("signalingServerUrl", JSON.stringify(url));
    }, SIGNALING);
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

    // ---------- 2. wrong-PIN backoff ----------
    {
      const capability = randomBytes(32);
      const roomUrl = capability.toString("hex");
      const roomPath = `${APP}/r?auth=pin#v1.${capability.toString("base64url")}`;
      const host = await newContext(browser, "host");
      const joiner = await newContext(browser, "joiner");

      const enterPin = async (page, pin) => {
        await page.goto(roomPath, { waitUntil: "domcontentloaded" });
        const field = page.getByLabel("Room PIN", { exact: false });
        await field.waitFor({ timeout: 30000 });
        await field.fill(pin);
        await page
          .getByRole("button", { name: "Connect", exact: true })
          .click();
      };

      await enterPin(host.page, "correct-horse-battery-staple");
      log("host joined the PIN room with the correct PIN");
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

      // Repeat until the library reports a throttle with a retry deadline.
      let throttled = null;
      for (let attempt = 0; attempt < 6 && !throttled; attempt++) {
        await enterPin(joiner.page, `wrong-${String(attempt)}`);
        throttled = await host.page
          .evaluate((url) => {
            const P = window.p2party;
            const room = (P.roomSelector(P.store.getState()) || []).find(
              (r) => r.url === url,
            );
            const hs = room?.handshakeStatusByPeer ?? {};
            return (
              Object.values(hs).find((v) => v.reason === "pin-throttled") ??
              null
            );
          }, roomUrl)
          .catch(() => null);
        if (!throttled) await host.page.waitForTimeout(1500);
      }
      if (throttled) {
        log(
          `✅ PIN BACKOFF: throttled, retryAfter=${String(throttled.retryAfter)}`,
        );
        if (!throttled.retryAfter)
          failures.push("throttle carried no retry deadline for the countdown");
      } else {
        log(
          "⚠️  PIN BACKOFF: repeated failures never reported pin-throttled to the host",
        );
        failures.push("no pin-throttled state observed after 6 wrong attempts");
      }
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
