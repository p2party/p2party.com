import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
  verify,
} from "node:crypto";
import { base64url } from "jose";
import {
  receiveOwner,
  readHandle,
  signTransfer,
  transferIds,
} from "@p2party/ledger-client";
import { nodeSigner } from "@p2party/ledger-client/node";

import {
  CHAIN,
  GENESIS,
  PROOF_CHAIN,
  packArchive,
  ALGORITHMS,
  MAX_RECORDS,
  WalletError,
  checkSuite,
  exactFields,
  requireWallet,
  bytes,
  unpackArchive,
  reviewPayment,
} from "./format.mjs";
export {
  CHAIN,
  GENESIS,
  PROOF_CHAIN,
  MAX_ARCHIVE,
  WalletError,
  exactFields,
} from "./format.mjs";
function record(privateKey, nonce, expectedSuite) {
  const signer = nodeSigner(privateKey);
  checkSuite(signer.suite);
  if (signer.suite !== expectedSuite || nonce.length !== 32)
    throw new Error("Wrong receive material");
  const owner = receiveOwner(signer, nonce);
  return {
    privateKey,
    nonce,
    owner,
    descriptor: { ...owner, readHandle: readHandle(owner) },
  };
}
function newRecord(suite) {
  checkSuite(suite);
  return record(
    generateKeyPairSync(ALGORITHMS.get(suite)).privateKey,
    randomBytes(32),
    suite,
  );
}
function serialized(entry) {
  const der = entry.privateKey.export({ type: "pkcs8", format: "der" });
  try {
    return {
      ...entry.owner,
      key: der.toString("base64url"),
      nonce: base64url.encode(entry.nonce),
    };
  } finally {
    der.fill(0);
  }
}
function restoreRecord(value) {
  if (!exactFields(value, ["key", "nonce", "suite", "commitment"]))
    throw new Error("Wrong record");
  checkSuite(value.suite);
  const der = bytes(value.key, 32, 12 * 1024);
  const nonce = bytes(value.nonce, 32, 32);
  try {
    const key = createPrivateKey({ key: der, type: "pkcs8", format: "der" });
    const canonical = key.export({ type: "pkcs8", format: "der" });
    try {
      if (!canonical.equals(der)) throw new Error("Unexpected PKCS8 data");
    } finally {
      canonical.fill(0);
    }
    const entry = record(key, nonce, value.suite);
    if (entry.owner.commitment !== value.commitment)
      throw new Error("Commitment mismatch");
    return entry;
  } catch (error) {
    nonce.fill(0);
    throw error;
  } finally {
    der.fill(0);
  }
}
function encodeCode(key) {
  return "P2W1-" + key.toString("base64url");
}
export class Wallet {
  #key;
  #entries;
  #id;
  #confirmed;
  constructor(key, id, entries, confirmed) {
    this.#key = key;
    this.#id = id;
    this.#entries = entries;
    this.#confirmed = confirmed;
  }
  static create(suite) {
    return new Wallet(randomBytes(32), randomUUID(), [newRecord(suite)], 0);
  }
  static importLegacy(receives) {
    requireWallet(
      receives.length > 0 && receives.length <= MAX_RECORDS,
      "Choose between one and 64 receive records.",
    );
    const entries = receives.map(({ privateKey, nonce, commitment }) => {
      try {
        const key = createPrivateKey({
          key: privateKey,
          type: "pkcs8",
          format: "der",
        });
        const entry = record(key, Buffer.from(nonce), nodeSigner(key).suite);
        if (entry.owner.commitment !== commitment) throw new Error();
        return entry;
      } catch {
        throw new WalletError(
          "A signing key and nonce do not open their expected public commitment.",
        );
      }
    });
    requireWallet(
      new Set(entries.map((entry) => entry.owner.commitment)).size ===
        entries.length,
      "Each receive record must be distinct.",
    );
    return new Wallet(randomBytes(32), randomUUID(), entries, 0);
  }
  static async restore(archive, code) {
    const { key, data } = await unpackArchive(archive, code);
    const entries = [];
    try {
      for (const item of data.receives) entries.push(restoreRecord(item));
      return new Wallet(
        Buffer.from(key),
        data.walletId,
        entries,
        entries.length,
      );
    } catch {
      for (const entry of entries) entry.nonce.fill(0);
      throw new WalletError(
        "Could not open this Testnet 1 backup. Check the file and its recovery code.",
      );
    } finally {
      key.fill(0);
    }
  }
  state() {
    return {
      wallet: {
        walletId: this.#id,
        revision: this.#entries.length,
        backedUp: this.#confirmed === this.#entries.length,
        accounts: this.#entries
          .slice(0, this.#confirmed)
          .map((entry) => ({ ...entry.descriptor })),
        pendingReceives: this.#entries.length - this.#confirmed,
      },
    };
  }
  recoveryCode() {
    return encodeCode(this.#key);
  }
  add(suite) {
    requireWallet(
      this.#entries.length < MAX_RECORDS,
      "This wallet already contains 64 receive requests.",
    );
    this.#entries.push(newRecord(suite));
  }
  async backup() {
    const revision = this.#entries.length;
    const archive = await packArchive(
      {
        version: 1,
        chainId: CHAIN,
        genesis: GENESIS,
        walletId: this.#id,
        revision,
        receives: this.#entries.map(serialized),
      },
      this.#key,
    );
    return {
      archive,
      filename: "p2party-testnet1-" + this.#id + "-r" + revision + ".jwe",
    };
  }
  async confirm(archive, code) {
    const recovered = await Wallet.restore(archive, code);
    try {
      requireWallet(
        recovered.#id === this.#id &&
          recovered.#entries.length === this.#entries.length &&
          timingSafeEqual(recovered.#key, this.#key) &&
          recovered.#entries.every(
            (entry, index) =>
              entry.owner.commitment ===
                this.#entries[index].owner.commitment &&
              entry.owner.suite === this.#entries[index].owner.suite &&
              entry.privateKey.equals(this.#entries[index].privateKey) &&
              timingSafeEqual(entry.nonce, this.#entries[index].nonce),
          ),
        "Choose the latest backup from this wallet.",
      );
      this.#confirmed = this.#entries.length;
    } finally {
      recovered.destroy();
    }
  }
  reviewTransfer(request) {
    return reviewPayment(request, this.state().wallet.accounts);
  }
  async signPayment(request) {
    this.reviewTransfer(request);
    return await this.#sign(
      CHAIN,
      request.input,
      request.recipient,
      BigInt(request.expiryHeight),
    );
  }
  async prove(commitment) {
    const entry = this.#entries
      .slice(0, this.#confirmed)
      .find((item) => item.owner.commitment === commitment);
    requireWallet(entry, "Select a receive request from a checked backup.");
    const signer = nodeSigner(entry.privateKey);
    const recipient = receiveOwner(signer, randomBytes(32));
    const inputId = "0x" + randomBytes(64).toString("hex");
    const input = {
      ...entry.owner,
      id: inputId,
      weight: "0x1",
      createdHeight: "0x0",
      spentHeight: null,
    };
    return this.#sign(PROOF_CHAIN, input, recipient, 1n);
  }
  async #sign(chainId, input, recipient, expiryHeight) {
    const entry = this.#entries
      .slice(0, this.#confirmed)
      .find(
        ({ owner }) =>
          owner.commitment === input.commitment && owner.suite === input.suite,
      );
    requireWallet(entry, "Choose a receive request from a checked backup.");
    const signer = nodeSigner(entry.privateKey);
    const wire = await signTransfer(
      { chainId, input, recipient, expiryHeight },
      signer,
      entry.nonce,
    );
    const { id: moveId, outputId, inputId } = transferIds(wire, chainId);
    // Verify independently with the public key, before telling the user the proof succeeded.
    const raw = Buffer.from(wire.slice(2), "hex");
    const bodyLength = 244 + signer.publicKey.length;
    const tag = Buffer.from("move/body");
    const digest = createHash("sha512")
      .update(Buffer.from([tag.length]))
      .update(tag)
      .update(raw.subarray(0, bodyLength))
      .digest();
    requireWallet(
      verify(
        null,
        digest,
        createPublicKey(entry.privateKey),
        raw.subarray(bodyLength),
      ),
      "The offline signature did not verify.",
    );
    return {
      ...entry.descriptor,
      moveId,
      outputId,
      wire,
      chainId,
      inputId,
      recipient,
    };
  }
  destroy() {
    this.#key.fill(0);
    for (const entry of this.#entries) entry.nonce.fill(0);
    this.#entries = [];
    this.#confirmed = 0;
  }
}
