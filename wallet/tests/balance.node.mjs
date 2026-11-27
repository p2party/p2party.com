import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import checkpoint from "../../public/wallet/snapshot/checkpoint.json" with { type: "json" };
import {
  initialBalance,
  isPublicBalance,
  presentPublicBalance,
  readSnapshotFile,
} from "../browser/balance.mjs";
import { verifyPublicHistory } from "../browser/public-ledger.mjs";
import { restoreWallet } from "../browser/core.mjs";
import { CHAIN, GENESIS, Wallet } from "./companion/wallet.mjs";
import { CANONICAL_GENESIS, snapshotFingerprint } from "../snapshot.mjs";
import { assertVerified } from "./native-verifier.mjs";

function packet(base, snapshot = base.snapshot, receipts = []) {
  return {
    type: "p2party.wallet.snapshot.v1",
    chainId: CHAIN,
    genesisHash: CANONICAL_GENESIS,
    fromHeight: base.snapshot.height,
    headHeight: snapshot.height,
    receipts,
    snapshot,
  };
}
async function testWallet() {
  const wallet = Wallet.create(1);
  wallet.add(2);
  wallet.add(1);
  const kit = await wallet.backup();
  await wallet.confirm(kit.archive, wallet.recoveryCode());
  const browser = await restoreWallet(kit.archive, wallet.recoveryCode());
  return { wallet, browser };
}
function changeUnit(snapshot, index, account, id = snapshot.units[index].id) {
  snapshot.units[index] = {
    id,
    suite: account.suite,
    commitment: account.commitment,
    weight: "0x1",
  };
}
function payment(wallet, input, { suite, commitment }, expiryHeight = "0x10") {
  return wallet.signPayment({
    chainId: CHAIN,
    genesis: GENESIS,
    input: { ...input, createdHeight: "0x0", spentHeight: null },
    recipient: { suite, commitment },
    expiryHeight,
  });
}

test("opening an unfunded wallet has a known zero at the shipped height; matched totals and stale/conflicting imports stay distinct", async () => {
  const { browser } = await testWallet();
  const zero = initialBalance(browser);
  assert.equal(isPublicBalance(zero), true);
  assert.equal(isPublicBalance({ ...zero }), false);
  assert.equal(zero.amount, "0");
  assert.equal(zero.height, "3");
  assert.equal(zero.observedAt, checkpoint.observedAt);
  const latest = structuredClone(checkpoint.snapshot);
  latest.height = "0x4";
  changeUnit(latest, 0, browser.accounts[0]);
  changeUnit(latest, 1, browser.accounts[1]);
  const funded = readSnapshotFile(browser, latest, zero);
  assert.equal(funded.amount, "2");
  assert.equal(isPublicBalance(funded), false);
  await assert.rejects(presentPublicBalance(funded), /Refresh against/);
  await assert.rejects(presentPublicBalance({ ...zero }), /Refresh against/);
  latest.units.reverse();
  assert.deepEqual(readSnapshotFile(browser, latest, funded), funded);
  const changed = structuredClone(latest);
  changed.units[3].id = "0x" + randomBytes(64).toString("hex");
  assert.throws(() => readSnapshotFile(browser, changed, funded), /disagree/);
  assert.throws(
    () => readSnapshotFile(browser, checkpoint.snapshot, funded),
    /older/,
  );
  const conflict = structuredClone(checkpoint.snapshot);
  changeUnit(conflict, 0, browser.accounts[0]);
  assert.throws(
    () => readSnapshotFile(browser, conflict, undefined),
    /disagree/,
  );
  assert.throws(() => readSnapshotFile(browser, null, undefined));
  browser.lock();
  assert.throws(() => initialBalance(browser), /Open your wallet/);
});

test("shipped prefix plus public receipts reproduces canonical membership, rejects invalid signatures, double spends and stale destinations", async () => {
  const { wallet, browser } = await testWallet();
  const [alice, bob, carol] = browser.accounts;
  // Trust only disposable local creation here; shipped code accepts solely the baked-in checkpoint.
  const base = structuredClone(checkpoint);
  changeUnit(base.snapshot, 0, alice);
  const first = await payment(wallet, base.snapshot.units[0], bob);
  const next = structuredClone(base.snapshot);
  next.height = "0x4";
  changeUnit(next, 0, bob, first.outputId);
  const second = await payment(wallet, next.units[0], carol);
  const final = structuredClone(next);
  final.height = "0x5";
  changeUnit(final, 0, carol, second.outputId);
  const valid = packet(base, final, [first.wire, second.wire]);
  const verified = await verifyPublicHistory(base, valid);
  assert.equal(browser.balance(verified).amount, "1");
  assert.equal(snapshotFingerprint(verified), snapshotFingerprint(final));
  if (process.env.P2PARTY_WALLET_VERIFIER) {
    assertVerified(first, alice);
    assertVerified(second, bob);
  }
  const late = await payment(wallet, base.snapshot.units[0], bob, "0x1");
  const retained = await payment(wallet, base.snapshot.units[0], base.spent[0]);
  const reuse = await payment(wallet, next.units[0], alice);
  for (const altered of [
    { ...valid, fromHeight: "0x2" },
    { ...valid, genesisHash: GENESIS },
    { ...valid, headHeight: "0x6" },
    { ...valid, receipts: [second.wire, first.wire] },
    { ...valid, receipts: [first.wire, first.wire] },
    { ...valid, receipts: [first.wire, reuse.wire] },
    packet(base, next, [retained.wire]),
    packet(base, next, [late.wire]),
    {
      ...valid,
      snapshot: {
        ...final,
        units: final.units.map((u, i) =>
          i === 1 ? { ...u, suite: u.suite === 1 ? 2 : 1 } : u,
        ),
      },
    },
    {
      ...valid,
      receipts: [
        first.wire,
        second.wire.slice(0, -1) + (second.wire.endsWith("a") ? "b" : "a"),
      ],
    },
    {
      ...valid,
      receipts: [
        first.wire.slice(0, 362) +
          (first.wire[362] === "a" ? "b" : "a") +
          first.wire.slice(363),
        second.wire,
      ],
    },
    { ...valid, receipts: Array(257).fill(first.wire) },
  ])
    await assert.rejects(verifyPublicHistory(base, altered));
  const aborted = AbortSignal.abort();
  await assert.rejects(verifyPublicHistory(base, valid, aborted));
  assert.equal(
    snapshotFingerprint(await verifyPublicHistory(base, valid)),
    snapshotFingerprint(final),
  );
  wallet.destroy();
  browser.lock();
});

test("original public three-receipt checkpoint checks its own zero-length extension", async () => {
  const observed = await verifyPublicHistory(checkpoint, packet(checkpoint));
  assert.equal(
    snapshotFingerprint(observed),
    "372f97170a0968aeddfc2f16e30bab88235bdf7c8cd3d356c91c6327eb1d36b0",
  );
  const counterfeit = structuredClone(checkpoint.snapshot);
  counterfeit.units[0].commitment = "0x" + randomBytes(64).toString("hex");
  await assert.rejects(
    verifyPublicHistory(checkpoint, packet(checkpoint, counterfeit)),
  );
});
