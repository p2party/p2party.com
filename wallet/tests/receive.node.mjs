import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";
import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import {
  receiveOwner,
  signTransfer,
  transferIds,
} from "@p2party/ledger-client";
import { nodeSigner } from "@p2party/ledger-client/node";
import { Wallet, CHAIN, GENESIS } from "./companion/wallet.mjs";
import { unpackArchive } from "../format.mjs";
import { assertVerified } from "./native-verifier.mjs";
import { prepareNewWallet, restoreWallet } from "../browser/core.mjs";
import {
  composeTransfer,
  parsePaymentRequest,
  requestQrDataUrl,
} from "../browser/receive.mjs";
import { catchUpSession } from "../browser/catch-up.mjs";
import { reconcileReceives } from "../browser/reconcile.mjs";
import {
  initialBalance,
  readSnapshotFile,
  receiveStatus,
} from "../browser/balance.mjs";
import checkpoint from "../../public/wallet/snapshot/checkpoint.json" with { type: "json" };
import prefix from "../browser/checkpoint-history.json" with { type: "json" };
import { CANONICAL_GENESIS } from "../snapshot.mjs";

const id = () => "0x" + randomBytes(64).toString("hex"),
  nonce = () => randomBytes(32);
test("browser creation and backup refresh protect both suites and the lower-level native wallet can restore and spend either request", async () => {
  const first = await prepareNewWallet(1);
  assert.deepEqual(
    Object.keys(first).sort(),
    ["archive", "filename", "getRecoveryCode", "confirm", "cancel"].sort(),
  );
  const code = first.getRecoveryCode(),
    firstFile = first.archive;
  await assert.rejects(first.confirm(firstFile, "bad"), /code/);
  const initial = await first.confirm(firstFile, code);
  const second = await initial.prepareReceive(2);
  assert.throws(() => second.getRecoveryCode(), /original|separately/);
  const secondFile = second.archive;
  await assert.rejects(initial.prepareReceive(1), /Finish or cancel/);
  await assert.rejects(second.confirm(firstFile, code), /exact updated/);
  await assert.rejects(second.confirm(secondFile, "bad"), /code/);
  assert.equal(initial.accounts.length, 1);
  assert.equal(
    parsePaymentRequest(initial.paymentRequest(initial.accounts[0].commitment))
      .recipient.suite,
    1,
  );
  const wallet = await second.confirm(secondFile, code);
  assert.equal(wallet.walletId, initial.walletId);
  assert.throws(
    () => initial.paymentRequest(initial.accounts[0].commitment),
    /Open/,
  );
  const companion = await Wallet.restore(secondFile, code);
  assert.deepEqual(companion.state().wallet.accounts, wallet.accounts);
  for (const account of wallet.accounts) {
    const requestText = wallet.paymentRequest(account.commitment);
    const request = parsePaymentRequest(requestText);
    assert.deepEqual(Object.keys(request.recipient).sort(), [
      "commitment",
      "suite",
    ]);
    assert.equal(request.weight, "0x1");
    assert.equal(request.chainId, CHAIN);
    assert.equal(request.genesis, GENESIS);
    assert.equal(request.recipient.commitment, account.commitment);
    assert.match(requestQrDataUrl(requestText), /^data:image\/gif;base64,/);
    const proof = await companion.prove(account.commitment);
    if (process.env.P2PARTY_WALLET_VERIFIER) assertVerified(proof, account);
    const peer = wallet.accounts.find((a) => a !== account);
    const input = {
      id: id(),
      suite: peer.suite,
      commitment: peer.commitment,
      weight: "0x1",
      createdHeight: "0x0",
      spentHeight: null,
    };
    const proposal = composeTransfer(input, requestText, "0x7");
    assert.equal(
      wallet.reviewTransfer(proposal).recipient.commitment,
      account.commitment,
    );
    if (process.env.P2PARTY_WALLET_VERIFIER)
      assertVerified(await wallet.signPayment(proposal), peer);
    for (const change of [
      { genesis: "wrong" },
      { chainId: "wrong" },
      { weight: "0x2" },
      { version: 2 },
      { privateKey: "forbidden" },
      { recipient: { ...request.recipient, nonce: "forbidden" } },
      { recipient: { suite: 3, commitment: account.commitment } },
    ])
      assert.throws(() =>
        parsePaymentRequest(JSON.stringify({ ...request, ...change })),
      );
    assert.throws(() =>
      parsePaymentRequest(
        requestText.replace('"suite":', '"suite":2,"suite":'),
      ),
    );
    assert.throws(() => requestQrDataUrl(secondFile));
  }
  const cancelled = await wallet.prepareReceive(1);
  const candidate = cancelled.archive;
  cancelled.cancel();
  await assert.rejects(cancelled.confirm(candidate, code), /closed/);
  const step = await wallet.prepareReceive(1);
  const refreshed = step.archive;
  const expanded = await step.confirm(refreshed, code);
  const { data, key } = await unpackArchive(refreshed, code);
  key.fill(0);
  assert.notEqual(data.receives[0].key, data.receives[2].key);
  assert.notEqual(data.receives[0].nonce, data.receives[2].nonce);
  const old = await restoreWallet(firstFile, code);
  assert.equal(old.accounts.length, 1);
  assert.equal(expanded.accounts.length, 3);
  old.lock();
  expanded.lock();
  companion.destroy();
});

test("closing the wallet while a staged revision reopens cannot reactivate it or reveal its new request", async () => {
  const fresh = await prepareNewWallet(2);
  const code = fresh.getRecoveryCode();
  const current = await fresh.confirm(fresh.archive, code);
  const stage = await current.prepareReceive(1);
  const both = stage.archive;
  const checking = stage.confirm(both, code);
  current.lock();
  await assert.rejects(checking, /cancelled/);
  assert.equal(stage.archive, null);
  await assert.rejects(current.prepareReceive(1), /Open/);
});

const hx = (n) => "0x" + n.toString(16),
  kind = "p2party.wallet.catchup.";
const publicNonce = randomBytes(32).toString("hex");
const start = (headHeight, headMoveId) => ({
  type: kind + "start.v1",
  nonce: publicNonce,
  chainId: CHAIN,
  genesisHash: CANONICAL_GENESIS,
  fromHeight: "0x3",
  headHeight,
  headMoveId,
});
const page = (afterHeight, receipts) => ({
  type: kind + "page.v1",
  nonce: publicNonce,
  afterHeight,
  receipts,
});
const done = (snapshot) => ({
  type: kind + "done.v1",
  nonce: publicNonce,
  snapshot,
});
test("reconnecting after 257 offline receipts discovers an incoming unit, another already spent, and an unused backed-up request", async () => {
  const seed = await prepareNewWallet(2);
  const code = seed.getRecoveryCode();
  const original = await seed.confirm(seed.archive, code);
  const pending = await original.prepareReceive(1);
  const saved = pending.archive;
  const recipient = await pending.confirm(saved, code);
  const [toSpend, toHold] = recipient.accounts;
  const sender = nodeSigner(generateKeyPairSync("ml-dsa-65").privateKey);
  const base = structuredClone(checkpoint);
  let n = nonce(),
    owner = receiveOwner(sender, n);
  let input = {
    id: id(),
    ...owner,
    weight: "0x1",
    createdHeight: "0x0",
    spentHeight: null,
  };
  base.snapshot.units[0] = { id: input.id, ...owner, weight: "0x1" };
  const wires = [];
  let last;
  for (let i = 0; i < 257; i++) {
    const nextNonce = nonce(),
      next =
        i === 0
          ? toSpend
          : i === 256
            ? toHold
            : receiveOwner(sender, nextNonce);
    const dest = { suite: next.suite, commitment: next.commitment };
    const wire =
      i === 1
        ? (
            await recipient.signPayment({
              chainId: CHAIN,
              genesis: GENESIS,
              input,
              recipient: dest,
              expiryHeight: "0x990",
            })
          ).wire
        : await signTransfer(
            { chainId: CHAIN, input, recipient: dest, expiryHeight: 0n },
            sender,
            n,
          );
    const ids = transferIds(wire, CHAIN);
    if (process.env.P2PARTY_WALLET_VERIFIER && [0, 1, 256].includes(i))
      assertVerified(
        { ...ids, moveId: ids.id, wire, chainId: CHAIN, recipient: dest },
        input,
      );
    wires.push(wire);
    last = ids.id;
    input = {
      id: ids.outputId,
      ...dest,
      weight: "0x1",
      createdHeight: hx(i + 4),
      spentHeight: null,
    };
    n = nextNonce;
  }
  recipient.lock();
  const snapshot = structuredClone(base.snapshot);
  snapshot.height = hx(260);
  snapshot.units[0] = {
    id: input.id,
    suite: input.suite,
    commitment: input.commitment,
    weight: "0x1",
  };
  const replacement = await restoreWallet(saved, code),
    stream = catchUpSession(base);
  const head = start(snapshot.height, last);
  assert.equal((await stream.accept(head)).ack.height, "0x3");
  for (let i = 0; i < wires.length; i += 32) {
    const result = await stream.accept(page(hx(3 + i), wires.slice(i, i + 32)));
    assert.equal(result.ack.height, hx(3 + Math.min(i + 32, 257)));
    assert.equal(result.evidence, undefined);
    assert.deepEqual(
      Object.keys(result.ack).sort(),
      ["type", "nonce", "height"].sort(),
    );
  }
  const { evidence } = await stream.accept(done(snapshot));
  const unused = { suite: 1, commitment: id() };
  const states = reconcileReceives([...replacement.accounts, unused], evidence);
  const lookup = (a) => states.get(a.suite + ":" + a.commitment);
  assert.equal(lookup(toSpend).state, "spent");
  assert.equal(lookup(toSpend).receivedHeight, "4");
  assert.equal(lookup(toSpend).spentHeight, "5");
  assert.equal(lookup(toHold).state, "received");
  assert.equal(lookup(toHold).unit.createdHeight, hx(260));
  assert.equal(lookup(toHold).unit.id, input.id);
  assert.equal(lookup(unused).state, "awaiting");
  assert.equal(replacement.balance(evidence.snapshot).amount, "1");
  const file = readSnapshotFile(
    replacement,
    snapshot,
    initialBalance(replacement),
  );
  assert.equal(receiveStatus(file, toSpend).state, "unknown");
  assert.equal(receiveStatus(file, toHold).verified, false);
  assert.equal(receiveStatus(file, toHold).unit, undefined);
  const pendingSender = await replacement.prove(toHold.commitment);
  if (process.env.P2PARTY_WALLET_VERIFIER)
    assertVerified(pendingSender, toHold);
  replacement.lock();
});

test("catch-up rejects gap, rollback, conflicting target, unsolicited or oversized pages and early completion", async () => {
  const good = start("0x3", prefix.at(-1).id);
  for (const msgs of [
    [page("0x3", [])],
    [{ ...good, headHeight: "0x2" }],
    [{ ...good, genesisHash: GENESIS }],
    [good, { ...done(checkpoint.snapshot), nonce: "wrong" }],
    [good, good],
    [{ ...good, headMoveId: id() }, done(checkpoint.snapshot)],
    [start("0x4", id()), done(checkpoint.snapshot)],
    [start("0x5", id()), page("0x4", ["00"])],
    [start("0x99", id()), page("0x3", Array(33).fill("00"))],
  ]) {
    const s = catchUpSession(checkpoint);
    await assert.rejects(async () => {
      for (const m of msgs) await s.accept(m);
    });
    await assert.rejects(s.accept(good));
  }
  const s = catchUpSession(checkpoint);
  await s.accept(good);
  await assert.rejects(
    s.accept(done(checkpoint.snapshot), AbortSignal.abort()),
  );
  const complete = catchUpSession(checkpoint);
  await complete.accept(good);
  assert.equal(
    (await complete.accept(done(checkpoint.snapshot))).evidence.snapshot.height,
    "0x3",
  );
});

test("pinned receipt metadata accounts for every spent public genesis input and derived output at the shipped height", async () => {
  const genesis = JSON.parse(
    await readFile(
      new URL("../../public/downloads/testnet-1/genesis.json", import.meta.url),
    ),
  );
  const live = new Set(genesis.units.map((item) => item.id)),
    spent = new Set();
  assert.equal(hx(prefix.length), checkpoint.snapshot.height);
  for (const [i, receipt] of prefix.entries()) {
    assert.equal(receipt.height, hx(i + 1));
    assert.equal(live.delete(receipt.inputId), true);
    assert.equal(spent.has(receipt.inputId), false);
    spent.add(receipt.inputId);
    const tag = Buffer.from("unit/id");
    const output = createHash("sha512")
      .update(Buffer.from([tag.length]))
      .update(tag)
      .update(Buffer.from(receipt.id.slice(2), "hex"))
      .update(Buffer.alloc(4))
      .digest("hex");
    assert.equal(receipt.outputId, "0x" + output);
    assert.equal(live.has(receipt.outputId), false);
    live.add(receipt.outputId);
  }
  assert.deepEqual([...spent].sort(), checkpoint.spent.map((s) => s.id).sort());
  assert.deepEqual(
    [...live].sort(),
    checkpoint.snapshot.units.map((u) => u.id).sort(),
  );
});
