// Real-WebRTC E2E: two headless Chromium contexts load the actual p2party.com
// app, connect through the real signaling server, form a WebRTC mesh, and
// exchange a text message and a file. The freshly-built local WASM is served in
// place of the CDN copy (SRI matches the rebuilt bundle).
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { randomBytes } from "crypto";

const APP = process.env.APP_URL ?? "http://localhost:5190";
const WASM = readFileSync(
  new URL("../node_modules/p2party/lib/libcrypto.wasm", import.meta.url),
);

// 64-char room url (the route requires exactly 64 chars).
const roomUrl = randomBytes(32).toString("hex");
const roomPath = `${APP}/rooms/${roomUrl}`;

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

async function setupContext(browser, tag) {
  const context = await browser.newContext();
  // Instrument the WebRTC data channel so we can PROVE the transfer went over
  // WebRTC and not the WS-relay fallback: the relay path never calls
  // RTCDataChannel.send, so a 64KiB-frame send here is proof of the real path.
  await context.addInitScript(() => {
    window.__dc = { sends: 0, bytes: 0, maxLen: 0, count64: 0, count65536: 0 };
    // Record bufferedAmount at the moment each data channel is closed — must be
    // 0, else close() wiped un-flushed writes (the drain-before-close race).
    window.__closes = [];
    const origClose = RTCDataChannel.prototype.close;
    RTCDataChannel.prototype.close = function () {
      try {
        window.__closes.push(this.bufferedAmount);
      } catch {}
      return origClose.apply(this, arguments);
    };
    // Loss injection: once armed, drop the first 65536-byte frame before it
    // reaches the wire (simulating a lost load-bearing chunk). Not counted,
    // because an on-path observer never sees it — retransmit must recover it.
    // Count RTCPeerConnection instances so a resume test can prove a FULL
    // reconnect (a brand-new pc) happened, not merely an ICE restart (same pc).
    window.__pcCount = 0;
    const OrigPC = window.RTCPeerConnection;
    class CountingPC extends OrigPC {
      constructor(...args) {
        super(...args);
        window.__pcCount++;
      }
    }
    if (OrigPC.generateCertificate)
      CountingPC.generateCertificate = OrigPC.generateCertificate.bind(OrigPC);
    window.RTCPeerConnection = CountingPC;
    // When armed, block the WS-relay of DATA frames (type "message") so a
    // transfer can only complete over the P2P data channel — this makes the
    // resume test prove P2P resume instead of being masked by relay. Signaling
    // frames (peers/description/candidate) are never blocked.
    window.__blockRelay = false;
    window.__relayBlocked = 0;
    const OrigWS = window.WebSocket;
    class GatedWS extends OrigWS {
      send(data) {
        try {
          if (
            window.__blockRelay &&
            typeof data === "string" &&
            data.includes('"type":"message"')
          ) {
            window.__relayBlocked++;
            return;
          }
        } catch {}
        return super.send(data);
      }
    }
    window.WebSocket = GatedWS;
    window.__dropArmed = false;
    window.__dropped = false;
    const origSend = RTCDataChannel.prototype.send;
    RTCDataChannel.prototype.send = function (data) {
      const len =
        data && data.byteLength != null
          ? data.byteLength
          : (data && data.length) || 0;
      if (len === 65536 && window.__dropArmed && !window.__dropped) {
        window.__dropped = true;
        return; // dropped before the wire — not sent, not counted
      }
      try {
        window.__dc.sends++;
        window.__dc.bytes += len;
        if (len > window.__dc.maxLen) window.__dc.maxLen = len;
        if (len === 64) window.__dc.count64++;
        else if (len === 65536) window.__dc.count65536++;
      } catch {}
      return origSend.apply(this, arguments);
    };
  });
  await context.route(/cdn\.p2party\.com\/@[^/]+\/libcrypto\.wasm/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/wasm",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: WASM,
    }),
  );
  const page = await context.newPage();
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|wasm|integrity|denied|retransmit/i.test(t))
      log(`${tag} console:`, t);
  });
  page.on("pageerror", (e) => log(`${tag} pageerror:`, e.message));
  return { context, page };
}

async function waitFor(page, fn, arg, { timeout = 60000, interval = 500, label }) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await page.evaluate(fn, arg);
    if (last) return last;
    await page.waitForTimeout(interval);
  }
  throw new Error(`timeout waiting for: ${label} (last=${JSON.stringify(last)})`);
}

// Evaluated in-page: helpers over the live window.p2party the app uses.
const roomState = (url) => {
  const P = window.p2party;
  if (!P || !P.store) return null;
  const rooms = P.roomSelector(P.store.getState()) || [];
  const r = rooms.find((x) => x.url === url);
  if (!r) return null;
  return {
    id: r.id,
    peers: (r.peers || []).map((p) => ({
      peerId: p.peerId,
      state: p.connectionState ?? p.state ?? null,
    })),
    channels: (r.channels || []).map((c) => c.label),
    messageCount: (r.messages || []).length,
  };
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const A = await setupContext(browser, "A");
  const B = await setupContext(browser, "B");

  try {
    log("room:", roomUrl);

    // 1. Load the real app in both contexts and accept the consent dialog.
    for (const [tag, { page }] of [["A", A], ["B", B]]) {
      await page.goto(roomPath, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Connect" }).click({ timeout: 30000 });
      log(`${tag} clicked Connect`);
    }

    // 2. Wait until the SDK is verified and each side sees the other peer.
    for (const [tag, { page }] of [["A", A], ["B", B]]) {
      const s = await waitFor(
        page,
        (url) => {
          const st = ((r) => r)(
            (function () {
              const P = window.p2party;
              if (!P || !P.store) return null;
              const rooms = P.roomSelector(P.store.getState()) || [];
              const r = rooms.find((x) => x.url === url);
              if (!r || !r.id) return null;
              return r.peers && r.peers.length > 0 ? { id: r.id, peers: r.peers.length } : null;
            })(),
          );
          return st;
        },
        roomUrl,
        { label: `${tag} sees a peer`, timeout: 60000 },
      );
      log(`${tag} connected:`, JSON.stringify(s));
    }

    // Dump the state shape once so we can see connection fields.
    log("A state:", JSON.stringify(await A.page.evaluate(roomState, roomUrl)));
    log("B state:", JSON.stringify(await B.page.evaluate(roomState, roomUrl)));

    const roomId = (await A.page.evaluate(roomState, roomUrl)).id;
    const bPeerId = await B.page.evaluate(() =>
      window.p2party.keyPairSelector(window.p2party.store.getState()).peerId,
    );
    log("roomId:", roomId, "B peerId:", bPeerId);

    // 3. A sends a text message over the mesh's "main" channel (what the app does).
    const TEXT = "hello-over-webrtc-" + roomUrl.slice(0, 8);
    await A.page.evaluate(
      ({ text, roomId }) => window.p2party.sendMessage(text, "main", roomId),
      { text: TEXT, roomId },
    );
    log("A sent text");

    // 4. B waits for the message, reads it, asserts full receipt + content.
    const got = await waitFor(
      B.page,
      async (url) => {
        const P = window.p2party;
        const rooms = P.roomSelector(P.store.getState()) || [];
        const r = rooms.find((x) => x.url === url);
        if (!r) return null;
        const m = r.messages.find((x) => x.merkleRootHex);
        if (!m || !m.merkleRootHex) return null;
        const res = await P.readMessage(m.merkleRootHex);
        if (res.percentage !== 100) return null;
        return {
          percentage: res.percentage,
          message: typeof res.message === "string" ? res.message : "[blob]",
        };
      },
      roomUrl,
      { label: "B receives text", timeout: 60000 },
    );
    log("B received text:", JSON.stringify(got));
    if (got.message !== TEXT) throw new Error(`text mismatch: got ${got.message}`);
    log("✅ TEXT transfer verified over WebRTC");

    // 5. A sends a FILE (multi-chunk, exercises decoys + chunk pipeline). Use a
    // deterministic payload so B can verify byte-exact receipt.
    const FILE_BYTES = 40000; // ~1 real chunk + decoys under default minChunks=3
    const fileMr = await A.page.evaluate(
      ({ roomId, n }) => {
        const bytes = new Uint8Array(n);
        for (let i = 0; i < n; i++) bytes[i] = (i * 7 + 13) & 0xff;
        const file = new File([bytes], "payload.bin", {
          type: "application/octet-stream",
        });
        return window.p2party.sendMessage(file, "main", roomId).then(() => n);
      },
      { roomId, n: FILE_BYTES },
    );
    log("A sent file bytes:", fileMr);

    const gotFile = await waitFor(
      B.page,
      async ({ url, expectBytes }) => {
        const P = window.p2party;
        const rooms = P.roomSelector(P.store.getState()) || [];
        const r = rooms.find((x) => x.url === url);
        if (!r) return null;
        // the file message is a Blob (non-text), find one whose read completes
        for (const m of r.messages) {
          if (!m.merkleRootHex) continue;
          const res = await P.readMessage(m.merkleRootHex);
          if (res.percentage !== 100) continue;
          if (res.message instanceof Blob && res.message.size === expectBytes) {
            const buf = new Uint8Array(await res.message.arrayBuffer());
            let ok = true;
            for (let i = 0; i < buf.length; i++)
              if (buf[i] !== ((i * 7 + 13) & 0xff)) {
                ok = false;
                break;
              }
            return {
              size: res.message.size,
              byteExact: ok,
              filename: res.filename,
              chunksReceivedTotal: res.chunksReceivedTotal,
              chunksReceivedReal: res.chunksReceivedReal,
            };
          }
        }
        return null;
      },
      { url: roomUrl, expectBytes: FILE_BYTES },
      { label: "B receives file", timeout: 90000 },
    );
    log("B received file:", JSON.stringify(gotFile));
    if (!gotFile.byteExact) throw new Error("file bytes did not match");
    log("✅ FILE transfer verified byte-exact over WebRTC");
    // Telemetry: total frames seen (incl. decoys) vs real chunks — the
    // obfuscation made visible to a human. (Decoys before the first real chunk
    // aren't attributed yet, so we only require real>=1 and log the split.)
    log(
      `TELEMETRY (receiver): chunksReceivedTotal=${gotFile.chunksReceivedTotal} chunksReceivedReal=${gotFile.chunksReceivedReal}`,
    );
    if (!(gotFile.chunksReceivedReal >= 1))
      throw new Error("telemetry: real chunk count not exposed");

    // Read-receipt count-uniformity, checked BEFORE the retransmit test (whose
    // resends add dup frames): every forward data-channel frame (real + decoy)
    // draws a receipt plus a final per message, so count64 > count65536.
    // Pre-fix (receipts for real chunks only) it is count64 < count65536.
    await A.page.waitForTimeout(2000); // let trailing receipts flush
    const dcU_A = await A.page.evaluate(() => window.__dc);
    const dcU_B = await B.page.evaluate(() => window.__dc);
    log(
      `receipt counts — A forward 64KiB frames: ${dcU_A.count65536}, B 64B receipts: ${dcU_B.count64}`,
    );
    if (!(dcU_B.count64 > dcU_A.count65536)) {
      throw new Error(
        `receipt-count leak: B sent ${dcU_B.count64} 64-byte receipts vs A's ${dcU_A.count65536} forward frames (uniform requires receipts > frames)`,
      );
    }
    log(
      "✅ RECEIPT UNIFORMITY: reverse receipts > forward frames (every frame receipted)",
    );

    // 5b. Selective retransmit: a large all-real-chunks file (~300KB > minChunks,
    // so no decoys) with one load-bearing frame dropped once. The sender must
    // resend ONLY that missing chunk and complete byte-exact.
    await A.page.evaluate(() => {
      window.__dropArmed = true;
    });
    const BIG_BYTES = 300000;
    await A.page.evaluate(
      ({ roomId, n }) => {
        const bytes = new Uint8Array(n);
        for (let i = 0; i < n; i++) bytes[i] = (i * 31 + 7) & 0xff;
        const file = new File([bytes], "big.bin", {
          type: "application/octet-stream",
        });
        return window.p2party.sendMessage(file, "main", roomId).then(() => n);
      },
      { roomId, n: BIG_BYTES },
    );
    log("A sent big file (one load-bearing frame dropped)");

    const gotBig = await waitFor(
      B.page,
      async ({ url, expectBytes }) => {
        const P = window.p2party;
        const rooms = P.roomSelector(P.store.getState()) || [];
        const r = rooms.find((x) => x.url === url);
        if (!r) return null;
        for (const m of r.messages) {
          if (!m.merkleRootHex) continue;
          const res = await P.readMessage(m.merkleRootHex);
          if (res.percentage !== 100) continue;
          if (res.message instanceof Blob && res.message.size === expectBytes) {
            const buf = new Uint8Array(await res.message.arrayBuffer());
            let ok = true;
            for (let i = 0; i < buf.length; i++)
              if (buf[i] !== ((i * 31 + 7) & 0xff)) {
                ok = false;
                break;
              }
            return { size: res.message.size, byteExact: ok };
          }
        }
        return null;
      },
      { url: roomUrl, expectBytes: BIG_BYTES },
      { label: "B receives big file after selective retransmit", timeout: 90000 },
    );
    const wasDropped = await A.page.evaluate(() => window.__dropped);
    log(
      `big file: dropped a frame = ${wasDropped}, received byte-exact = ${gotBig.byteExact}`,
    );
    if (!wasDropped)
      throw new Error("test setup: no frame was dropped, cannot prove retransmit");
    if (!gotBig.byteExact)
      throw new Error("big file corrupted despite retransmit");
    log("✅ RETRANSMIT: dropped load-bearing chunk recovered byte-exact (selective)");

    // Sender telemetry: the reconcile that recovered the dropped chunk surfaces
    // as a retransmit count on the sender's message.
    const bigRetransmits = await A.page.evaluate(
      async ({ n }) => {
        const P = window.p2party;
        const rooms = P.roomSelector(P.store.getState()) || [];
        for (const r of rooms)
          for (const m of r.messages) {
            if (m.totalSize === n && m.merkleRootHex) {
              const res = await P.readMessage(m.merkleRootHex);
              return res.retransmits ?? -1;
            }
          }
        return -1;
      },
      { n: BIG_BYTES },
    );
    log(`TELEMETRY (sender): retransmits for the big file = ${bigRetransmits}`);
    if (!(bigRetransmits >= 1))
      throw new Error(
        `telemetry: expected >= 1 retransmit after the drop, got ${bigRetransmits}`,
      );
    log("✅ TELEMETRY: sender retransmit count exposed");

    // 5c. Big file: the streaming send-side SHA-512 hashes the file from disk in
    // HASH_WINDOW_BYTES (1 MiB) windows without ever holding the whole file in
    // RAM. A 16 MiB payload spans ~16 hash windows and ~275 chunks — a wrong
    // incremental hash would corrupt the message identity / merkle and fail the
    // byte-exact check. On the receive side each real chunk is written straight
    // into a pre-sized OPFS file at its offset as it arrives (out of order), so
    // a wrong offset / uniformSize would leave a zero-gap and fail byte-exact.
    const HUGE_BYTES = 16 * 1024 * 1024;
    await A.page.evaluate(
      ({ roomId, n }) => {
        const bytes = new Uint8Array(n);
        for (let i = 0; i < n; i++) bytes[i] = (i * 97 + 41) & 0xff;
        const file = new File([bytes], "huge.bin", {
          type: "application/octet-stream",
        });
        return window.p2party.sendMessage(file, "main", roomId).then(() => n);
      },
      { roomId, n: HUGE_BYTES },
    );
    log("A sent 16 MiB file (streaming send-side hash, multi-window)");
    const gotHuge = await waitFor(
      B.page,
      async ({ url, expectBytes }) => {
        const P = window.p2party;
        const rooms = P.roomSelector(P.store.getState()) || [];
        const r = rooms.find((x) => x.url === url);
        if (!r) return null;
        for (const m of r.messages) {
          if (!m.merkleRootHex || m.totalSize !== expectBytes) continue;
          const res = await P.readMessage(m.merkleRootHex);
          if (res.percentage !== 100) continue;
          if (res.message instanceof Blob && res.message.size === expectBytes) {
            const buf = new Uint8Array(await res.message.arrayBuffer());
            let ok = true;
            for (let i = 0; i < buf.length; i++)
              if (buf[i] !== ((i * 97 + 41) & 0xff)) {
                ok = false;
                break;
              }
            // The OPFS path returns a File; the in-memory Blob fallback returns
            // a plain Blob. instanceof File tells them apart.
            return {
              size: res.message.size,
              byteExact: ok,
              opfsUsed: res.message instanceof File,
            };
          }
        }
        return null;
      },
      { url: roomUrl, expectBytes: HUGE_BYTES },
      { label: "B receives 16 MiB file", timeout: 120000, interval: 1000 },
    );
    if (!gotHuge.byteExact)
      throw new Error("16 MiB file corrupted — streaming hash mismatch?");
    log(
      `✅ BIG FILE: 16 MiB transfer byte-exact (streaming send-side SHA-512 over ~16 windows); opfsReassembly=${gotHuge.opfsUsed}`,
    );
    if (!gotHuge.opfsUsed)
      throw new Error(
        "16 MiB file was reassembled in-memory (Blob), not streamed to OPFS — Component B did not engage",
      );
    log("✅ OPFS RECEIVE: big file reassembled to a disk-backed OPFS file (never built in RAM)");

    // OPFS concurrency + idempotency safety: (1) concurrent reads for the same
    // completed file must be coalesced so BOTH stay on OPFS (a lock collision
    // would silently fall back to a whole-file-in-RAM Blob); (2) a re-read must
    // not re-truncate/re-stream the content-addressed file, so a File handed out
    // earlier stays byte-readable.
    const opfsSafety = await B.page.evaluate(
      async ({ url, n }) => {
        const P = window.p2party;
        const rooms = P.roomSelector(P.store.getState()) || [];
        const r = rooms.find((x) => x.url === url);
        const m = (r?.messages || []).find(
          (x) => x.totalSize === n && x.merkleRootHex,
        );
        if (!m) return { found: false };
        const mr = m.merkleRootHex;
        const [c1, c2] = await Promise.all([
          P.readMessage(mr),
          P.readMessage(mr),
        ]);
        const bothOpfs =
          c1.message instanceof File && c2.message instanceof File;
        const held = (await P.readMessage(mr)).message;
        await P.readMessage(mr); // would truncate+rewrite without the guard
        let heldReadable = false;
        try {
          const buf = new Uint8Array(await held.arrayBuffer());
          heldReadable = buf.length === n;
        } catch {
          heldReadable = false;
        }
        // Metadata-only read (materialize=false) must NOT materialize the file:
        // returns metadata with an empty message (used for list previews/bubbles).
        const meta = await P.readMessage(mr, undefined, false);
        const metaOnly =
          meta.message === "" && meta.size === n && meta.percentage === 100;
        return { found: true, bothOpfs, heldReadable, metaOnly };
      },
      { url: roomUrl, n: HUGE_BYTES },
    );
    if (!opfsSafety.found)
      throw new Error("16 MiB message not found for OPFS safety check");
    if (!opfsSafety.bothOpfs)
      throw new Error(
        "concurrent reads did not both use OPFS — coalescing failed (RAM fallback)",
      );
    if (!opfsSafety.heldReadable)
      throw new Error(
        "a re-read invalidated an earlier File — idempotency guard failed (NotReadableError)",
      );
    if (!opfsSafety.metaOnly)
      throw new Error(
        "readMessage(materialize=false) did not return metadata-only (message must be empty)",
      );
    log(
      "✅ OPFS SAFETY: concurrent reads coalesced (both OPFS) + re-read kept the earlier File readable + metadata-only read skips materialization",
    );

    // 6. Prove it was the real WebRTC data channel, not the WS-relay fallback.
    const dcA = await A.page.evaluate(() => window.__dc);
    const dcB = await B.page.evaluate(() => window.__dc);
    log("A datachannel stats:", JSON.stringify(dcA));
    log("B datachannel stats:", JSON.stringify(dcB));
    if (!(dcA.sends > 0 && dcA.maxLen >= 65536)) {
      throw new Error(
        `no 64KiB frames sent over the data channel — transfer used the relay fallback (dcA=${JSON.stringify(dcA)})`,
      );
    }
    log("✅ NO FALLBACK: 64KiB frames confirmed on the WebRTC data channel");

    // 8. Drain-before-close: every data-channel close must happen at
    // bufferedAmount === 0, so no un-flushed write is wiped.
    const closesA = await A.page.evaluate(() => window.__closes);
    const closesB = await B.page.evaluate(() => window.__closes);
    const allCloses = [...closesA, ...closesB];
    log(
      `channel closes — A: [${closesA}], B: [${closesB}] (total ${allCloses.length})`,
    );
    const dirty = allCloses.filter((b) => b !== 0);
    if (dirty.length > 0) {
      throw new Error(
        `close-before-drain race: ${dirty.length} channel(s) closed with bufferedAmount > 0 (${dirty})`,
      );
    }
    if (allCloses.length === 0) {
      throw new Error(
        "no per-message channel close observed — cannot confirm drain-before-close",
      );
    }
    log("✅ DRAIN-BEFORE-CLOSE: all channels closed at bufferedAmount === 0");

    // 9. Resume-on-reconnect: a large all-real file whose transfer is cut by a
    // FULL peer reconnect (a brand-new RTCPeerConnection) mid-flight. Without
    // resume, the sender's reconcile loop breaks on the dead channel and the
    // frames buffered in it are never resent, so B stalls < 100%. Resume must
    // re-open the per-message channel on the fresh connection, have B re-emit its
    // stored receipts, and complete byte-exact. Run LAST: its hard-disconnect
    // closes legitimately leave bufferedAmount > 0, so it must not pollute the
    // drain-before-close invariant above.
    const RESUME_RECV_TIMEOUT = Number(process.env.RESUME_TIMEOUT ?? 150000);
    const RES_BYTES = 5_000_000; // ~90 real 64KiB frames — still in flight at cut
    // Block the WS-relay of data frames on BOTH peers so the ONLY way the
    // transfer can finish is over a re-established P2P channel — this proves P2P
    // resume, not relay masking.
    await A.page.evaluate(() => {
      window.__blockRelay = true;
    });
    await B.page.evaluate(() => {
      window.__blockRelay = true;
    });
    const pcBeforeA = await A.page.evaluate(() => window.__pcCount);
    const resBaseline = await A.page.evaluate(() => window.__dc.count65536);
    await A.page.evaluate(
      ({ roomId, n }) => {
        const bytes = new Uint8Array(n);
        for (let i = 0; i < n; i++) bytes[i] = (i * 131 + 17) & 0xff;
        const file = new File([bytes], "resume.bin", {
          type: "application/octet-stream",
        });
        // Fire-and-forget: sendMessage resolves only when the WHOLE transfer
        // completes, so awaiting it would defeat mid-flight injection.
        window.__resumeSend = window.p2party.sendMessage(file, "main", roomId);
        return true;
      },
      { roomId, n: RES_BYTES },
    );
    log("A started resume-file send (in flight)");

    // Wait until it is genuinely mid-flight (frames going out over the channel).
    await waitFor(
      A.page,
      (base) => window.__dc.count65536 >= base + 20,
      resBaseline,
      { label: "A resume-file mid-flight", timeout: 60000, interval: 200 },
    );
    const framesAtCut = await A.page.evaluate(() => window.__dc.count65536);
    log(`A mid-flight at ${framesAtCut} forward frames — forcing full reconnect`);

    // Force a FULL reconnect: tear down A's connection to B (closes pc + all
    // channels). The 'main' onclose drives re-establishment with a new pc.
    await A.page.evaluate(
      (pid) => window.p2party.disconnectFromPeer(pid),
      bPeerId,
    );
    log("A disconnected from B — reconnect + resume must finish the transfer");

    const gotResume = await waitFor(
      B.page,
      async ({ url, expectBytes }) => {
        const P = window.p2party;
        const rooms = P.roomSelector(P.store.getState()) || [];
        const r = rooms.find((x) => x.url === url);
        if (!r) return null;
        for (const m of r.messages) {
          if (!m.merkleRootHex || m.totalSize !== expectBytes) continue;
          const res = await P.readMessage(m.merkleRootHex);
          if (res.percentage !== 100) continue;
          if (res.message instanceof Blob && res.message.size === expectBytes) {
            const buf = new Uint8Array(await res.message.arrayBuffer());
            let ok = true;
            for (let i = 0; i < buf.length; i++)
              if (buf[i] !== ((i * 131 + 17) & 0xff)) {
                ok = false;
                break;
              }
            return {
              size: res.message.size,
              byteExact: ok,
              retransmits: res.retransmits,
            };
          }
        }
        return null;
      },
      { url: roomUrl, expectBytes: RES_BYTES },
      {
        label: "B receives resume file after full reconnect",
        timeout: RESUME_RECV_TIMEOUT,
        interval: 1000,
      },
    );
    const pcAfterA = await A.page.evaluate(() => window.__pcCount);
    const framesAfter = await A.page.evaluate(() => window.__dc.count65536);
    const relayBlockedA = await A.page.evaluate(() => window.__relayBlocked);
    // retransmits is SENDER-side telemetry — read it from A (not B).
    const resumeRetransmits = await A.page.evaluate(
      async ({ n }) => {
        const P = window.p2party;
        const rooms = P.roomSelector(P.store.getState()) || [];
        for (const r of rooms)
          for (const m of r.messages)
            if (m.totalSize === n && m.merkleRootHex) {
              const res = await P.readMessage(m.merkleRootHex);
              return res.retransmits ?? -1;
            }
        return -1;
      },
      { n: RES_BYTES },
    );
    log(
      `resume: byteExact=${gotResume.byteExact} pcBefore=${pcBeforeA} pcAfter=${pcAfterA} framesAtCut=${framesAtCut} framesAfter=${framesAfter} relayBlocked=${relayBlockedA} senderRetransmits=${resumeRetransmits}`,
    );
    if (!gotResume.byteExact)
      throw new Error("resume file corrupted after reconnect");
    if (!(pcAfterA > pcBeforeA))
      throw new Error(
        `no new RTCPeerConnection — an ICE restart, not a full reconnect (before=${pcBeforeA} after=${pcAfterA})`,
      );
    // With relay blocked, completion is only possible if P2P resume resent the
    // missing frames over the re-established channel — so more forward frames
    // must have gone out after the cut.
    if (!(framesAfter > framesAtCut))
      throw new Error(
        `no P2P resend after reconnect (framesAtCut=${framesAtCut} framesAfter=${framesAfter}) — resume did not carry data`,
      );
    if (!(relayBlockedA > 0))
      throw new Error(
        "relay was never exercised — cannot conclude the transfer avoided the relay fallback",
      );
    if (!(resumeRetransmits >= 1))
      throw new Error(
        `resume not surfaced in sender telemetry (retransmits=${resumeRetransmits}) — expected >= 1`,
      );
    log(
      "✅ RESUME-ON-RECONNECT: in-flight transfer completed byte-exact over a re-established P2P channel (new pc, relay blocked)",
    );

    // 10. No send-buffer leak: after every send completes, the sender's
    // newChunks (the padded outbound body) must be reclaimed from IndexedDB.
    // (Regression guard for the completion-path newChunks leak — a bug the
    // byte-exactness checks alone cannot see.) Poll briefly: the completion
    // delete is async after the final receipt.
    const leftover = await waitFor(
      A.page,
      async () => {
        const P = window.p2party;
        const rooms = P.roomSelector(P.store.getState()) || [];
        let total = 0;
        const hashes = new Set();
        for (const r of rooms)
          for (const m of r.messages)
            if (m.sha512Hex && m.fromPeerId && !hashes.has(m.sha512Hex)) {
              hashes.add(m.sha512Hex);
              total += await P.getSendChunksCount(m.sha512Hex);
            }
        // waitFor resolves on truthy; return a sentinel object once drained.
        return total === 0 ? { drained: true } : null;
      },
      null,
      { label: "A send-buffer (newChunks) reclaimed", timeout: 30000, interval: 1000 },
    );
    log(`✅ NO SEND-BUFFER LEAK: sender newChunks reclaimed after completion (${JSON.stringify(leftover)})`);

    // 11. Reload persistence: the RECEIVE-side OPFS file + IndexedDB have-set
    // (leaf hashes) persist across a full page reload — the worker is torn down
    // and its open sync-access-handle is gone, yet the bytes are on disk. After B
    // reloads and re-consents, the completed 16 MiB file must still be served
    // BYTE-EXACT straight from its persisted OPFS file (getReceiveFile reopens
    // it), proving received bytes survive a reload — the basis of reload-resume,
    // where remaining zero-gaps are filled on the next connection.
    log("Reloading B to prove the received file survives a page reload...");
    await B.page.reload({ waitUntil: "domcontentloaded" });
    try {
      await B.page
        .getByRole("button", { name: "Connect" })
        .click({ timeout: 15000 });
    } catch {
      /* consent may be remembered — no dialog to accept */
    }
    const reloaded = await waitFor(
      B.page,
      async ({ url, expectBytes }) => {
        const P = window.p2party;
        if (!P || !P.store) return null;
        const rooms = P.roomSelector(P.store.getState()) || [];
        const r = rooms.find((x) => x.url === url);
        if (!r) return null;
        for (const m of r.messages) {
          if (!m.merkleRootHex || m.totalSize !== expectBytes) continue;
          const res = await P.readMessage(m.merkleRootHex);
          if (res.percentage !== 100) continue;
          if (res.message instanceof Blob && res.message.size === expectBytes) {
            const buf = new Uint8Array(await res.message.arrayBuffer());
            let ok = true;
            for (let i = 0; i < buf.length; i++)
              if (buf[i] !== ((i * 97 + 41) & 0xff)) {
                ok = false;
                break;
              }
            return { byteExact: ok, opfsUsed: res.message instanceof File };
          }
        }
        return null;
      },
      { url: roomUrl, expectBytes: HUGE_BYTES },
      {
        label: "B re-reads 16 MiB file after reload",
        timeout: 60000,
        interval: 1000,
      },
    );
    if (!reloaded.byteExact)
      throw new Error(
        "16 MiB file NOT byte-exact after reload — OPFS/have-set did not persist",
      );
    if (!reloaded.opfsUsed)
      throw new Error(
        "16 MiB file after reload served from a RAM Blob, not OPFS — persisted-file reopen failed",
      );
    log(
      "✅ RELOAD PERSISTENCE: 16 MiB file survived a page reload, served byte-exact from persisted OPFS",
    );

    await browser.close();
    log("DONE — all transfers verified over real WebRTC");
    process.exit(0);
  } catch (e) {
    log("❌ FAILED:", e.message);
    try {
      log("A final:", JSON.stringify(await A.page.evaluate(roomState, roomUrl)));
      log("B final:", JSON.stringify(await B.page.evaluate(roomState, roomUrl)));
    } catch {}
    await browser.close();
    process.exit(1);
  }
})();
