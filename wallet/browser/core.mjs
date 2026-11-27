import {
  receiveOwner,
  readHandle,
  signTransfer,
  transferIds,
} from "@p2party/ledger-client";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  bytes,
  CHAIN,
  PROOF_CHAIN,
  unpackArchive,
  reviewPayment,
  WalletError,
} from "../format.mjs";
import { reportedBalance, snapshotFingerprint } from "../snapshot.mjs";
import { prepareKit } from "./receive-kit.mjs";
import { serializePaymentRequest } from "./receive.mjs";
import { importSigner } from "./keys.mjs";

function release(records) {
  for (const { signer, nonce } of records.values()) {
    signer.lock();
    nonce.fill(0);
  }
  records.clear();
}

// Kept in one tab's JS memory only. Loading a replacement fails atomically at the caller.
export async function restoreWallet(archive, code, progress) {
  const { key, data } = await unpackArchive(archive, code);
  const records = new Map();
  try {
    for (const item of data.receives) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const der = bytes(item.key, 32, 12 * 1024);
      let nonce, signer;
      try {
        nonce = bytes(item.nonce, 32, 32);
        signer = importSigner(der, item.suite);
        const owner = receiveOwner(signer, nonce);
        if (owner.commitment !== item.commitment) throw new Error();
        records.set(owner.commitment, {
          signer,
          nonce,
          descriptor: Object.freeze({
            ...owner,
            readHandle: readHandle(owner),
          }),
        });
      } catch (error) {
        nonce?.fill(0);
        signer?.lock();
        throw error;
      } finally {
        der.fill(0);
        item.key = "";
        item.nonce = "";
      }
      progress?.(records.size, data.revision);
    }
  } catch {
    key.fill(0);
    release(records);
    throw new WalletError(
      "Could not verify the keys and receive requests in this backup.",
    );
  }
  return openedWallet(records, data.walletId, data.revision, { key, archive });
}

export function prepareNewWallet(suite) {
  return prepareKit(suite, null, restoreWallet);
}

function openedWallet(records, walletId, revision, base) {
  let pending = null,
    preparing = false;
  function lock() {
    const stage = pending;
    pending = null;
    stage?.cancel();
    base.key.fill(0);
    base.archive = null;
    release(records);
  }
  async function prepareReceive(suite) {
    if (!records.size)
      throw new WalletError("Open the wallet to create a receive request.");
    if (pending || preparing)
      throw new WalletError("Finish or cancel the current backup first.");
    preparing = true;
    try {
      const stage = await prepareKit(
        suite,
        base,
        restoreWallet,
        (confirmed) => {
          pending = null;
          if (confirmed) lock();
        },
      );
      if (!records.size) {
        stage.cancel();
        throw new WalletError("The wallet was closed.");
      }
      pending = stage;
      return stage;
    } finally {
      preparing = false;
    }
  }
  const accounts = Object.freeze(
    [...records.values()].map(({ descriptor }) => descriptor),
  );
  function entry(commitment) {
    const value = records.get(commitment);
    if (!value)
      throw new WalletError(
        "Open the wallet and choose one of its receive requests.",
      );
    return value;
  }
  async function signed(chainId, input, recipient, expiryHeight) {
    const { signer, nonce, descriptor } = entry(input.commitment);
    const wire = await signTransfer(
      { chainId, input, recipient, expiryHeight },
      signer,
      nonce,
    );
    const { id: moveId, inputId, outputId } = transferIds(wire, chainId);
    return {
      ...descriptor,
      wire,
      moveId,
      inputId,
      outputId,
      chainId,
      recipient,
    };
  }
  function reviewTransfer(request) {
    if (records.size === 0)
      throw new WalletError("Open your wallet to review a transfer.");
    return reviewPayment(request, accounts);
  }
  return Object.freeze({
    accounts,
    revision,
    walletId,
    reviewTransfer,
    prepareReceive,
    paymentRequest(commitment) {
      const { suite } = entry(commitment).descriptor;
      return serializePaymentRequest({ suite, commitment });
    },
    balance(snapshot) {
      if (records.size === 0)
        throw new WalletError("Open your wallet to check its balance.");
      const report = reportedBalance(snapshot, accounts);
      return { ...report, fingerprint: snapshotFingerprint(snapshot) };
    },
    async prove(commitment) {
      const {
        signer,
        descriptor: { suite },
      } = entry(commitment);
      const recipient = receiveOwner(
        signer,
        crypto.getRandomValues(new Uint8Array(32)),
      );
      const id = "0x" + bytesToHex(crypto.getRandomValues(new Uint8Array(64)));
      return signed(
        PROOF_CHAIN,
        {
          id,
          suite,
          commitment,
          weight: "0x1",
          createdHeight: "0x0",
          spentHeight: null,
        },
        recipient,
        1n,
      );
    },
    async signPayment(request) {
      reviewTransfer(request);
      return signed(
        CHAIN,
        request.input,
        request.recipient,
        BigInt(request.expiryHeight),
      );
    },
    lock,
  });
}
