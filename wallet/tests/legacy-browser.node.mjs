import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { test } from "node:test";
import { receiveOwner } from "@p2party/ledger-client";
import { nodeSigner } from "@p2party/ledger-client/node";
import { convertLegacy } from "../browser/legacy-browser.mjs";
import { restoreWallet } from "../browser/core.mjs";
import { Wallet } from "./companion/wallet.mjs";

for (const algorithm of ["ml-dsa-65", "slh-dsa-sha2-192s"]) {
  test(
    "migrate original native files for " +
      algorithm +
      " into a portable backup",
    async () => {
      const native = generateKeyPairSync(algorithm).privateKey;
      const der = native.export({ type: "pkcs8", format: "der" });
      const nonce = randomBytes(32),
        signer = nodeSigner(native);
      const owner = receiveOwner(signer, nonce);
      const kit = await convertLegacy(der, nonce, owner.commitment);
      const desktop = await Wallet.restore(kit.archive, kit.code);
      const browser = await restoreWallet(kit.archive, kit.code);
      try {
        assert.equal(
          desktop.state().wallet.accounts[0].commitment,
          owner.commitment,
        );
        assert.equal(browser.accounts[0].commitment, owner.commitment);
        assert.equal(
          (await browser.prove(owner.commitment)).suite,
          signer.suite,
        );
      } finally {
        desktop.destroy();
        browser.lock();
      }
      await assert.rejects(
        convertLegacy(der, randomBytes(32), owner.commitment),
        /do not open/,
      );
      await assert.rejects(
        convertLegacy(der, nonce, "0x00"),
        /full receive commitment/,
      );
      await assert.rejects(
        convertLegacy(new Uint8Array(10), nonce, owner.commitment),
        /supported/,
      );
    },
  );
}
