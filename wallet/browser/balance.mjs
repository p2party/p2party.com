import checkpoint from "../../public/wallet/snapshot/checkpoint.json" with { type: "json" };
import { WalletError } from "../format.mjs";
import { snapshotFingerprint } from "../snapshot.mjs";
import prefix from "./checkpoint-history.json" with { type: "json" };
import { catchUpSession } from "./catch-up.mjs";
import { reconcileReceives } from "./reconcile.mjs";
const evidenceByReport = new WeakMap();
export function receiveStatus(report, account) {
  return (
    evidenceByReport
      .get(report)
      ?.get(account.suite + ":" + account.commitment) ?? {
      state: "unknown",
      height: null,
      verified: false,
    }
  );
}
function attach(report, wallet, evidence) {
  evidenceByReport.set(report, reconcileReceives(wallet.accounts, evidence));
  return report;
}

// Provenance is local object identity. Imported JSON cannot mark its amount as replay-verified.
const publicReports = new WeakSet();
export const isPublicBalance = (report) => publicReports.has(report);
function publicReport(fields) {
  const report = Object.freeze(fields);
  publicReports.add(report);
  return report;
}
const floor = {
  height: BigInt(checkpoint.snapshot.height).toString(),
  fingerprint: snapshotFingerprint(checkpoint.snapshot),
};
export function publicBridgeAvailable() {
  return (
    window.isSecureContext &&
    ["https:", "http:"].includes(location.protocol) &&
    window.top === window.self
  );
}
export function initialBalance(wallet) {
  return attach(
    publicReport({
      ...wallet.balance(checkpoint.snapshot),
      observedAt: checkpoint.observedAt,
    }),
    wallet,
    {
      snapshot: checkpoint.snapshot,
      created: new Map(prefix.map((item) => [item.outputId, item.height])),
      spent: new Map(
        checkpoint.spent.map((unit) => [
          unit.commitment,
          {
            ...unit,
            createdHeight:
              prefix.find((r) => r.outputId === unit.id)?.height ?? "0x0",
            spentHeight: prefix.find((r) => r.inputId === unit.id)?.height,
          },
        ]),
      ),
    },
  );
}
function compareHead(before, next) {
  if (!before) return;
  if (BigInt(next.height) < BigInt(before.height))
    throw new WalletError(
      "This snapshot is older than the balance already checked.",
    );
  if (next.height === before.height && next.fingerprint !== before.fingerprint)
    throw new WalletError(
      "Two snapshots disagree at the same height. The previous balance was kept.",
    );
}
export function readSnapshotFile(wallet, snapshot, previous) {
  const report = wallet.balance(snapshot);
  compareHead(floor, report);
  compareHead(previous, report);
  return attach(report, wallet, { snapshot });
}

// Only public history messages cross this boundary. Keep wallet objects and
// receive commitments out of the network-capable worker.
export async function requestPublicSnapshot(wallet, previous, signal) {
  signal?.throwIfAborted();
  if (!publicBridgeAvailable())
    throw new WalletError("Open the hosted wallet to check for new payments.");
  const worker = new Worker("/wallet/snapshot/worker.mjs", { type: "module" });
  const session = catchUpSession(checkpoint);
  const failure = () =>
    new WalletError(
      "The public payment history could not be verified. Try again.",
    );
  let timer, abort, evidence;
  try {
    evidence = await new Promise((resolve, reject) => {
      const renew = () => {
        clearTimeout(timer);
        timer = setTimeout(() => reject(failure()), 45000);
      };
      abort = () => reject(new WalletError("Balance check cancelled."));
      signal?.addEventListener("abort", abort, { once: true });
      worker.onerror = () => reject(failure());
      worker.onmessageerror = () => reject(failure());
      worker.onmessage = async ({ data }) => {
        try {
          if (data?.type === "error") throw failure();
          const result = await session.accept(data, signal);
          if (result.evidence) resolve(result.evidence);
          else {
            worker.postMessage(result.ack);
            renew();
          }
        } catch (error) {
          reject(error);
        }
      };
      worker.postMessage({ type: "sync" });
      renew();
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    worker.terminate();
    session.cancel();
  }
  signal?.throwIfAborted();
  const checked = wallet.balance(evidence.snapshot);
  compareHead(floor, checked);
  compareHead(previous, checked);
  return attach(
    publicReport({ ...checked, observedAt: new Date().toISOString() }),
    wallet,
    evidence,
  );
}
export async function presentPublicBalance(report, signal) {
  if (!isPublicBalance(report))
    throw new WalletError(
      "Refresh against the public validator before sharing this total.",
    );
  signal?.throwIfAborted();
  try {
    sessionStorage.setItem(
      "p2party.testnet1.shared-balance.v1",
      JSON.stringify({
        amount: report.amount,
        height: report.height,
      }),
    );
    window.dispatchEvent(new Event("p2party-shared-balance"));
  } catch {
    throw new WalletError(
      "This browser could not save the balance for this tab.",
    );
  }
}
