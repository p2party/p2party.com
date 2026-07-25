// Correlation check for scheduled timing cover.
//
// A rate test compares aggregate volume and would never catch one distinctive
// packet emitted at a telling moment — which is exactly the bug that shipped
// (an off-schedule 65-byte receipt at transfer completion). This test asks a
// different question:
//
//   Does ANY packet-size class occur preferentially near a transfer
//   completion, compared with what its own base rate predicts?
//
// Method: run several transfers at randomised gaps inside one capture, record
// each completion instant from the receiver, then for every observed packet
// size compute
//
//   lift = (share of that size's packets falling inside a ±W window)
//        / (share of total capture time those windows occupy)
//
// lift ≈ 1 means the size is spread evenly and reveals nothing. lift >> 1
// means that size clusters around completions — a correlation leak, however
// few packets it involves. A Poisson tail bound gives each lift a p-value so
// small-count classes cannot raise a false alarm on their own.
//
// HONEST LIMITS: loopback, one preset, one payload size, and completion times
// are polled (±POLL_MS). The window W must exceed that jitter to be fair.
import { chromium } from "playwright";
import { spawn, execFileSync } from "child_process";
import { randomBytes } from "crypto";
import { existsSync, unlinkSync } from "fs";

const APP = process.env.APP_URL ?? "http://localhost:5190";
const SIGNALING = process.env.SIGNALING_URL ?? "";
const PCAP = process.env.PCAP_PATH ?? "/tmp/p2party-correlation.pcap";
const TRANSFERS = Number(process.env.TRANSFERS ?? "6");
const PAYLOAD_BYTES = Number(process.env.PAYLOAD_BYTES ?? String(256 * 1024));
const WINDOW_MS = Number(process.env.WINDOW_MS ?? "400");
const POLL_MS = 40;
const PRESET = { cadence: 10_000, lanes: 2, frames: 16, epochs: 1 };

const log = (...a) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

/** Poisson upper tail: P(X >= observed) when expected is the mean. */
const poissonTail = (observed, expected) => {
  if (observed <= 0) return 1;
  if (expected <= 0) return 0;
  // Sum the lower tail, then complement; expected stays small here.
  let term = Math.exp(-expected);
  let cumulative = term;
  for (let k = 1; k < observed; k++) {
    term *= expected / k;
    cumulative += term;
  }
  return Math.max(0, Math.min(1, 1 - cumulative));
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
  await new Promise((r) => setTimeout(r, 1500));
  if (tcpdump.exitCode !== null) throw new Error("tcpdump exited early");

  const browser = await chromium.launch({ headless: true });
  const completions = [];
  let captureStart = 0;
  let captureEnd = 0;
  try {
    const probe = await browser.newContext();
    const probePage = await probe.newPage();
    await probePage.goto(APP, { waitUntil: "networkidle" });
    const policyParam = await probePage.evaluate((p) => {
      // Use the library's canonical codec — the same one the app decodes
      // with — so the harness can never build a policy param the app rejects.
      return window.p2party.encodeRoomCapabilityBase64Url(
        window.p2party.encodeRoomPolicyV1(p),
      );
    }, scheduledPolicy);
    await probe.close();
    const roomPath = `${APP}/r?policy=${policyParam}#v1.${capability.toString("base64url")}`;

    const contexts = [];
    for (const tag of ["A", "B"]) {
      const context = await browser.newContext();
      if (SIGNALING)
        await context.addInitScript((url) => {
          localStorage.setItem("signalingServerUrl", JSON.stringify(url));
        }, SIGNALING);
      const page = await context.newPage();
      page.on("pageerror", (e) =>
        log(`${tag} pageerror: ${e.message.slice(0, 120)}`),
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

    const deadline = Date.now() + 90000;
    let active = false;
    while (Date.now() < deadline && !active) {
      active = await contexts[0].page.evaluate((url) => {
        const P = window.p2party;
        const room = (P.roomSelector(P.store.getState()) || []).find(
          (r) => r.url === url,
        );
        return Object.values(room?.coverStatusByPeer ?? {}).some(
          (s) => s === "active",
        );
      }, roomUrl);
      if (!active) await contexts[0].page.waitForTimeout(400);
    }
    if (!active) throw new Error("scheduled cover never became active");
    // Let the schedule reach steady state before anything is measured.
    await contexts[0].page.waitForTimeout(PRESET.cadence * PRESET.epochs);
    captureStart = Date.now();
    log("cover steady — correlation run begins");

    const roomId = await contexts[0].page.evaluate((url) => {
      const P = window.p2party;
      return (
        (P.roomSelector(P.store.getState()) || []).find((r) => r.url === url)
          ?.id ?? ""
      );
    }, roomUrl);

    // Watch the RECEIVER for completions, sampling finely enough that the
    // recorded instant is well inside the correlation window.
    await contexts[1].page.evaluate(
      ({ url, poll }) => {
        window.__completions = [];
        const seen = new Set();
        window.__completionTimer = setInterval(() => {
          const P = window.p2party;
          const room = (P.roomSelector(P.store.getState()) || []).find(
            (r) => r.url === url,
          );
          for (const m of room?.messages ?? []) {
            if (!m.merkleRootHex || seen.has(m.merkleRootHex)) continue;
            if (m.totalSize > 0 && m.savedSize >= m.totalSize) {
              seen.add(m.merkleRootHex);
              window.__completions.push(Date.now());
            }
          }
        }, poll);
      },
      { url: roomUrl, poll: POLL_MS },
    );

    for (let i = 0; i < TRANSFERS; i++) {
      await contexts[0].page.evaluate(
        ({ roomId, bytes, seed }) => {
          const data = new Uint8Array(bytes);
          for (let j = 0; j < data.length; j++)
            data[j] = (j * 31 + seed * 7 + 11) & 0xff;
          const file = new File([data], `t${String(seed)}.bin`, {
            type: "application/octet-stream",
          });
          window.p2party.sendMessage(file, "main", roomId);
          return true;
        },
        { roomId, bytes: PAYLOAD_BYTES, seed: i },
      );
      log(`transfer ${String(i + 1)}/${String(TRANSFERS)} started`);
      // Randomised spacing so completions never align with the cover cycle.
      const gap = 9_000 + Math.floor(Math.random() * 7_000);
      await contexts[0].page.waitForTimeout(gap);
    }
    // Let the last transfer finish and settle inside the capture.
    await contexts[0].page.waitForTimeout(12_000);
    captureEnd = Date.now();

    const observed = await contexts[1].page.evaluate(() => {
      clearInterval(window.__completionTimer);
      return window.__completions ?? [];
    });
    completions.push(...observed);
    log(`recorded ${String(completions.length)} completions`);

    for (const { context } of contexts) await context.close();
  } finally {
    await browser.close();
    tcpdump.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 1200));
  }

  if (completions.length === 0)
    throw new Error("no completions recorded — nothing to correlate against");

  // ---- analysis ----
  const raw = execFileSync(
    "tshark",
    ["-r", PCAP, "-T", "fields", "-e", "frame.time_epoch", "-e", "udp.length"],
    { maxBuffer: 512 * 1024 * 1024, encoding: "utf8" },
  );
  const startSec = captureStart / 1000;
  const endSec = captureEnd / 1000;
  const windowSec = WINDOW_MS / 1000;
  const marks = completions.map((t) => t / 1000).sort((a, b) => a - b);

  // Union of the ±W windows, so overlapping windows are not double counted.
  const merged = [];
  for (const mark of marks) {
    const lo = mark - windowSec;
    const hi = mark + windowSec;
    const last = merged[merged.length - 1];
    if (last && lo <= last[1]) last[1] = Math.max(last[1], hi);
    else merged.push([lo, hi]);
  }
  const windowSpan = merged.reduce(
    (total, [lo, hi]) =>
      total +
      (Math.min(hi, endSec) - Math.max(lo, startSec) > 0
        ? Math.min(hi, endSec) - Math.max(lo, startSec)
        : 0),
    0,
  );
  const totalSpan = endSec - startSec;
  const windowFraction = windowSpan / totalSpan;

  const inWindow = (ts) => merged.some(([lo, hi]) => ts >= lo && ts <= hi);
  const bySize = new Map();
  let totalPackets = 0;
  for (const line of raw.split("\n")) {
    if (!line) continue;
    const [t, len] = line.split("\t");
    const ts = Number(t);
    const size = Number(len);
    if (!Number.isFinite(ts) || !Number.isFinite(size)) continue;
    if (ts < startSec || ts > endSec) continue;
    totalPackets++;
    const entry = bySize.get(size) ?? { total: 0, near: 0 };
    entry.total++;
    if (inWindow(ts)) entry.near++;
    bySize.set(size, entry);
  }

  const classes = [...bySize.entries()]
    .map(([size, { total, near }]) => {
      const expected = total * windowFraction;
      const lift = expected > 0 ? near / expected : 0;
      return {
        size,
        packets: total,
        near,
        expected: Number(expected.toFixed(2)),
        lift: Number(lift.toFixed(2)),
        pValue: Number(poissonTail(near, expected).toExponential(2)),
      };
    })
    .sort((a, b) => b.lift - a.lift);

  const report = {
    capture: PCAP,
    completions: completions.length,
    windowMs: WINDOW_MS,
    captureSpanSec: Number(totalSpan.toFixed(1)),
    windowFraction: Number(windowFraction.toFixed(4)),
    totalPackets,
    distinctSizes: classes.length,
    // A class is suspicious only if it is BOTH clustered and unlikely by chance.
    suspicious: classes.filter(
      (c) => c.lift >= 2 && c.pValue < 0.01 && c.near >= 3,
    ),
    topByLift: classes.slice(0, 8),
  };
  console.log(JSON.stringify(report, null, 2));

  if (report.suspicious.length > 0) {
    for (const c of report.suspicious)
      log(
        `⚠️  size ${String(c.size)} B clusters at completions: ${String(c.near)} of ${String(c.packets)} packets in ${String((windowFraction * 100).toFixed(1))}% of the time (lift ${String(c.lift)}, p=${String(c.pValue)})`,
      );
    process.exit(1);
  }
  log(
    `✅ CORRELATION: no packet-size class clusters at transfer completions (${String(classes.length)} sizes, ${String(completions.length)} completions, ±${String(WINDOW_MS)} ms)`,
  );
};

run().catch((error) => {
  log(`❌ FAILED: ${error.message}`);
  process.exit(1);
});
