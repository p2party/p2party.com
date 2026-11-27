import test from "node:test";
import assert from "node:assert/strict";
import {
  randomBytes,
  createPrivateKey,
  generateKeyPairSync,
} from "node:crypto";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { CompactEncrypt, base64url } from "jose";
import { nodeSigner } from "@p2party/ledger-client/node";
import { receiveOwner, readHandle } from "@p2party/ledger-client";
import { Wallet } from "./companion/wallet.mjs";
import {
  CHAIN,
  GENESIS,
  PROOF_CHAIN,
  HEADER,
  unpackArchive,
} from "../format.mjs";
import { assertVerified, verifyNative } from "./native-verifier.mjs";
import { restoreWallet } from "../browser/core.mjs";
import { importSigner } from "../browser/keys.mjs";

test("browser restores the actual companion archive across both suites; wrong credentials, headers, tag mutations, roots and tampering fail closed", async () => {
  const companion = Wallet.create(1);
  companion.add(2);
  const { archive } = await companion.backup();
  const code = companion.recoveryCode();
  await companion.confirm(archive, code);
  const browser = await restoreWallet(archive, code);
  assert.deepEqual(browser.accounts, companion.state().wallet.accounts);
  assert.equal(browser.walletId, companion.state().wallet.walletId);
  assert.equal(browser.revision, 2);
  const secondCompanion = await Wallet.restore(archive, code);
  secondCompanion.add(1);
  const refreshed = (await secondCompanion.backup()).archive;
  await secondCompanion.confirm(refreshed, code);
  const reopened = await restoreWallet(refreshed, code);
  assert.deepEqual(reopened.accounts, secondCompanion.state().wallet.accounts);
  reopened.lock();
  secondCompanion.destroy();
  const { data, key } = await unpackArchive(archive, code);
  const corruptions = [
    (d) => {
      d.receives[1].key = d.receives[0].key;
    },
    (d) => {
      const key = base64url.decode(d.receives[1].key);
      key[key.length - 1] ^= 1;
      d.receives[1].key = base64url.encode(key);
    },
    (d) => {
      d.receives[0].nonce = d.receives[1].nonce;
    },
    (d) => {
      d.receives[1] = d.receives[0];
    },
    (d) => {
      d.genesis = "0x" + randomBytes(32).toString("hex");
    },
    (d) => {
      d.receives[0].commitment = "0x" + randomBytes(64).toString("hex");
    },
  ];
  for (const corrupt of corruptions) {
    const changed = structuredClone(data);
    corrupt(changed);
    const changedArchive = await new CompactEncrypt(
      Buffer.from(JSON.stringify(changed)),
    )
      .setProtectedHeader(HEADER)
      .encrypt(key);
    await assert.rejects(restoreWallet(changedArchive, code));
  }
  const f = archive.split(".");
  f[4] = (f[4][0] === "A" ? "B" : "A") + f[4].slice(1);
  await assert.rejects(restoreWallet(f.join("."), code));
  await assert.rejects(restoreWallet(archive.slice(1), code));
  await assert.rejects(
    restoreWallet(archive, "P2W1-" + randomBytes(32).toString("base64url")),
  );
  assert.deepEqual(browser.accounts, companion.state().wallet.accounts);
  browser.lock();
  await assert.rejects(
    browser.prove(browser.accounts[0].commitment),
    /Open the wallet/,
  );
  key.fill(0);
  companion.destroy();
});

test(
  "browser keys produce independently valid native signatures for both suites on disposable nonexistent inputs",
  {
    skip:
      !process.env.P2PARTY_WALLET_VERIFIER &&
      "Set P2PARTY_WALLET_VERIFIER to verify against the C implementation.",
  },
  async () => {
    const companion = Wallet.create(1);
    companion.add(2);
    const { archive } = await companion.backup();
    const code = companion.recoveryCode();
    companion.destroy();
    const browser = await restoreWallet(archive, code);
    for (const [i, account] of browser.accounts.entries()) {
      const proof = await browser.prove(account.commitment);
      assert.equal(proof.chainId, PROOF_CHAIN);
      assertVerified(proof, account);
      assert.equal(verifyNative(proof, account, CHAIN).status, 1);
      const { suite, commitment } = browser.accounts[1 - i];
      const input = {
        suite: account.suite,
        commitment: account.commitment,
        id: "0x" + randomBytes(64).toString("hex"),
        weight: "0x1",
        createdHeight: "0x0",
        spentHeight: null,
      };
      const request = {
        chainId: CHAIN,
        genesis: GENESIS,
        input,
        recipient: { suite, commitment },
        expiryHeight: "0x1",
      };
      const review = browser.reviewTransfer(request);
      assert.equal(review.weight, "1");
      assert.equal(review.readHandle, readHandle(request.recipient));
      assert.throws(() =>
        browser.reviewTransfer({ ...request, chainId: PROOF_CHAIN }),
      );
      const payment = await browser.signPayment(request);
      assert.equal(payment.chainId, CHAIN);
      assertVerified(payment, account);
    }
    browser.lock();
  },
);

function tlv(tag, bytes) {
  if (bytes.length < 128)
    return Buffer.concat([Buffer.from([tag, bytes.length]), bytes]);
  const len = Buffer.alloc(3);
  len[0] = 0x82;
  len.writeUInt16BE(bytes.length, 1);
  return Buffer.concat([Buffer.from([tag]), len, bytes]);
}
test("DER parser handles ML-DSA seed, expanded and checked combined representations and rejects trailing or wrong-suite records", () => {
  const seed = randomBytes(32);
  const { secretKey, publicKey } = ml_dsa65.keygen(seed);
  const expand = tlv(4, secretKey);
  const both = tlv(0x30, Buffer.concat([tlv(4, seed), expand]));
  const prefix = Buffer.from("020100300b0609608648016503040312", "hex");
  const enveloped = (encoded) =>
    tlv(0x30, Buffer.concat([prefix, tlv(4, encoded)]));
  const nonce = randomBytes(32);
  let expected;
  for (const encoded of [tlv(0x80, seed), expand, both]) {
    const der = enveloped(encoded),
      signer = importSigner(der, 1);
    assert.deepEqual(signer.publicKey, publicKey);
    const native = createPrivateKey({ key: der, type: "pkcs8", format: "der" });
    expected = receiveOwner(nodeSigner(native), nonce);
    assert.deepEqual(receiveOwner(signer, nonce), expected);
    assert.throws(() => importSigner(Buffer.concat([der, Buffer.alloc(1)]), 1));
    assert.throws(() => importSigner(der, 2));
    signer.lock();
  }
  const mutated = Buffer.from(both);
  mutated[12] ^= 1;
  assert.throws(() => importSigner(enveloped(mutated), 1));
  const foreign = generateKeyPairSync("ed25519").privateKey.export({
    type: "pkcs8",
    format: "der",
  });
  assert.throws(() => importSigner(foreign, 1));
});
