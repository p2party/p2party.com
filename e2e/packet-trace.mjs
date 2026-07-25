// Packet-trace analysis of scheduled timing cover.
//
// The claim under test: in a scheduled-cover room, an on-path observer who
// sees only the encrypted transport cannot tell an IDLE room from one that is
// carrying a real message — same cell sizes, same emission schedule.
//
// Method: capture loopback UDP (the DTLS/SCTP carrying every WebRTC data
// channel) while two browser contexts hold a scheduled-cover room, split the
// capture into an idle phase and a sending phase by wall-clock, and compare
// the packet-size and inter-arrival distributions of the two phases.
//
// HONEST LIMITS, stated up front:
//   * Loopback is not a network path. There is no NAT, no MTU pressure, and
//     no competing traffic; a real observer sees more jitter, not less.
//   * This measures the SHAPE of what the transport emits. It is evidence
//     about the cover schedule, NOT a formal indistinguishability proof, and
//     it says nothing about an adversary correlating across many sessions.
//   * Phase attribution is by timestamp, so a cell straddling the boundary
//     lands in whichever phase its packet timestamp falls in.
//
// Usage:
//   SIGNALING_URL=ws://localhost:3999/ws node e2e/packet-trace.mjs
import { chromium } from "playwright";
import { spawn, execFileSync } from "child_process";
import { randomBytes } from "crypto";
import { existsSync, unlinkSync } from "fs";

const APP = process.env.APP_URL ?? "http://localhost:5190";
const SIGNALING = process.env.SIGNALING_URL ?? "";
const PCAP = process.env.PCAP_PATH ?? "/tmp/p2party-cover.pcap";
const IDLE_MS = Number(process.env.IDLE_MS ?? "24000");
const SEND_MS = Number(process.env.SEND_MS ?? "24000");
// 10 s cycles / 2 lanes / 16 cells — the shortest shipped preset, so a
// capture window of ~24 s spans a couple of full cycles.
const PRESET = { cadence: 10_000, lanes: 2, frames: 16, epochs: 1 };

const log = (...a) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

/**
 * Build the ?policy= parameter with the LIBRARY's own codec rather than a
 * hand-rolled byte layout — a guessed layout silently produces an invalid
 * invitation, and the app then never reaches the connect flow.
 */
const encodePolicyParam = async (page, policy) =>
  page.evaluate((p) => {
    const bytes = window.p2party.encodeRoomPolicyV1(p);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }, policy);

const stats = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((t, v) => t + v, 0);
  const mean = sum / sorted.length;
  const variance =
    sorted.reduce((t, v) => t + (v - mean) ** 2, 0) / sorted.length;
  const q = (p) =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return {
    n: sorted.length,
    mean: Number(mean.toFixed(2)),
    sd: Number(Math.sqrt(variance).toFixed(2)),
    min: sorted[0],
    p50: q(0.5),
    p95: q(0.95),
    max: sorted[sorted.length - 1],
  };
};

/** Total-variation distance between two discrete distributions. */
const totalVariation = (a, b) => {
  const keys = new Set([...a.keys(), ...b.keys()]);
  const sumA = [...a.values()].reduce((t, v) => t + v, 0) || 1;
  const sumB = [...b.values()].reduce((t, v) => t + v, 0) || 1;
  let tv = 0;
  for (const k of keys)
    tv += Math.abs((a.get(k) ?? 0) / sumA - (b.get(k) ?? 0) / sumB);
  return tv / 2;
};

const histogram = (values) => {
  const h = new Map();
  for (const v of values) h.set(v, (h.get(v) ?? 0) + 1);
  return h;
};

const run = async () => {
  if (existsSync(PCAP)) unlinkSync(PCAP);
  const capability = randomBytes(32);
  const roomUrl = capability.toString("hex");
  const scheduledPolicy = {
    version: 1,
    revision: 0,
    wireVersion: 4,
    authMode: "nopin",
    pqMode: "hybrid-mlkem768",
    rendezvousMode: "legacy-signaling",
    coverMode: "scheduled",
    coverCadenceMs: PRESET.cadence,
    coverLanes: PRESET.lanes,
    coverFramesPerCell: PRESET.frames,
    coverDurationEpochs: PRESET.epochs,
  };

  log("starting loopback capture …");
  const tcpdump = spawn(
    "tcpdump",
    ["-i", "lo0", "-n", "-s", "128", "-w", PCAP, "udp"],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let capError = "";
  tcpdump.stderr.on("data", (d) => {
    capError += String(d);
  });
  await new Promise((r) => setTimeout(r, 1500));
  if (tcpdump.exitCode !== null)
    throw new Error(`tcpdump exited early: ${capError.slice(0, 200)}`);

  const browser = await chromium.launch({ headless: true });
  let phaseBoundary = 0;
  let sendStart = 0;
  try {
    // Derive the invite parameter from the app's own encoder.
    const probe = await browser.newContext();
    const probePage = await probe.newPage();
    await probePage.goto(APP, { waitUntil: "networkidle" });
    const policyParam = await encodePolicyParam(probePage, scheduledPolicy);
    await probe.close();
    const roomPath = `${APP}/r?policy=${policyParam}#v1.${capability.toString("base64url")}`;
    log(`scheduled-cover invite: /r?policy=${policyParam.slice(0, 12)}…`);

    const contexts = [];
    for (const tag of ["A", "B"]) {
      const context = await browser.newContext();
      if (SIGNALING)
        await context.addInitScript((url) => {
          localStorage.setItem("signalingServerUrl", JSON.stringify(url));
        }, SIGNALING);
      const page = await context.newPage();
      page.on("pageerror", (e) =>
        log(`${tag} pageerror: ${e.message.slice(0, 140)}`),
      );
      contexts.push({ context, page, tag });
    }

    for (const { page, tag } of contexts) {
      await page.goto(roomPath, { waitUntil: "domcontentloaded" });
      await page
        .getByRole("button", { name: "Connect" })
        .click({ timeout: 30000 });
      log(`${tag} connected`);
    }

    // Wait for the scheduled-cover runtime to report an active edge.
    const deadline = Date.now() + 90000;
    let covered = false;
    while (Date.now() < deadline && !covered) {
      covered = await contexts[0].page.evaluate((url) => {
        const P = window.p2party;
        const room = (P.roomSelector(P.store.getState()) || []).find(
          (r) => r.url === url,
        );
        const cover = Object.values(room?.coverStatusByPeer ?? {});
        return cover.some((s) => s === "active" || s === "starting");
      }, roomUrl);
      if (!covered) await contexts[0].page.waitForTimeout(500);
    }
    if (!covered) throw new Error("scheduled cover never started");
    log("cover runtime active — idle phase begins");

    const idleStart = Date.now();
    await contexts[0].page.waitForTimeout(IDLE_MS);
    phaseBoundary = Date.now();
    log(`idle phase captured (${String(phaseBoundary - idleStart)} ms)`);

    // Sending phase: push a real payload through the same cover schedule.
    const roomId = await contexts[0].page.evaluate((url) => {
      const P = window.p2party;
      return (
        (P.roomSelector(P.store.getState()) || []).find((r) => r.url === url)
          ?.id ?? ""
      );
    }, roomUrl);
    sendStart = Date.now();
    await contexts[0].page.evaluate(
      ({ roomId }) => {
        const bytes = new Uint8Array(512 * 1024);
        for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 7) & 0xff;
        const file = new File([bytes], "trace.bin", {
          type: "application/octet-stream",
        });
        window.__traceSend = window.p2party.sendMessage(file, "main", roomId);
        return true;
      },
      { roomId },
    );
    log("real 512 KiB transfer started — sending phase begins");
    await contexts[0].page.waitForTimeout(SEND_MS);
    log("sending phase captured");

    // The comparison is only meaningful if the payload REALLY moved: a send
    // that silently failed would make the two phases identical for the wrong
    // reason.
    const deliveredBytes = await contexts[1].page.evaluate(
      async ({ url, expect }) => {
        const P = window.p2party;
        const room = (P.roomSelector(P.store.getState()) || []).find(
          (r) => r.url === url,
        );
        if (!room) return 0;
        let best = 0;
        for (const m of room.messages) {
          if (!m.merkleRootHex || m.totalSize !== expect) continue;
          const res = await P.readMessage(m.merkleRootHex, undefined, false);
          best = Math.max(best, Math.round((res.percentage / 100) * expect));
        }
        return best;
      },
      { url: roomUrl, expect: 512 * 1024 },
    );
    log(
      `receiver holds ${String(deliveredBytes)} / ${String(512 * 1024)} bytes of the real payload`,
    );
    if (deliveredBytes === 0)
      throw new Error(
        "the real transfer never reached the peer — the phase comparison would be meaningless",
      );

    for (const { context } of contexts) await context.close();
  } finally {
    await browser.close();
    tcpdump.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 1200));
  }

  // ---- analysis ----
  const raw = execFileSync(
    "tshark",
    ["-r", PCAP, "-T", "fields", "-e", "frame.time_epoch", "-e", "udp.length"],
    { maxBuffer: 256 * 1024 * 1024, encoding: "utf8" },
  );
  const boundarySec = phaseBoundary / 1000;
  const sendSec = sendStart / 1000;
  const idle = [];
  const sending = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    const [t, len] = line.split("\t");
    const ts = Number(t);
    const size = Number(len);
    if (!Number.isFinite(ts) || !Number.isFinite(size)) continue;
    if (ts < boundarySec) idle.push({ ts, size });
    else if (ts >= sendSec) sending.push({ ts, size });
  }
  const gaps = (rows) => {
    const g = [];
    for (let i = 1; i < rows.length; i++)
      g.push(Number(((rows[i].ts - rows[i - 1].ts) * 1000).toFixed(3)));
    return g;
  };

  const idleSizes = idle.map((r) => r.size);
  const sendSizes = sending.map((r) => r.size);
  const report = {
    capture: PCAP,
    preset: PRESET,
    idle: {
      packets: idle.length,
      size: stats(idleSizes),
      gapMs: stats(gaps(idle)),
    },
    sending: {
      packets: sending.length,
      size: stats(sendSizes),
      gapMs: stats(gaps(sending)),
    },
    sizeDistanceTV: Number(
      totalVariation(histogram(idleSizes), histogram(sendSizes)).toFixed(4),
    ),
    distinctSizes: {
      idle: new Set(idleSizes).size,
      sending: new Set(sendSizes).size,
    },
    packetRateRatio:
      idle.length > 0
        ? Number(
            (
              sending.length /
              Math.max(1, SEND_MS / 1000) /
              (idle.length / Math.max(1, IDLE_MS / 1000))
            ).toFixed(3),
          )
        : null,
  };
  console.log(JSON.stringify(report, null, 2));

  // A cover schedule that hides the payload should keep BOTH the packet rate
  // and the size distribution close between phases.
  const verdict = [];
  if (report.packetRateRatio !== null && report.packetRateRatio > 1.25)
    verdict.push(
      `packet rate rose ${String(report.packetRateRatio)}x while sending — the schedule did not absorb the payload`,
    );
  if (report.sizeDistanceTV > 0.15)
    verdict.push(
      `packet-size distributions differ (total variation ${String(report.sizeDistanceTV)})`,
    );
  if (verdict.length === 0)
    log("✅ TRACE: idle and sending phases are close in rate and size profile");
  else for (const v of verdict) log(`⚠️  ${v}`);
};

run().catch((error) => {
  log(`❌ FAILED: ${error.message}`);
  process.exit(1);
});
