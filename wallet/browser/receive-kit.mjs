import { base64url } from "jose";
import { receiveOwner } from "@p2party/ledger-client";
import {
  CHAIN,
  GENESIS,
  MAX_RECORDS,
  WalletError,
  checkSuite,
  packArchive,
  unpackArchive,
} from "../format.mjs";
import { generateNativeReceive } from "./keys.mjs";

const codeFor = (bytes) => "P2W1-" + base64url.encode(bytes);
function freshRecord(suite) {
  checkSuite(suite);
  const { der, publicKey } = generateNativeReceive(suite);
  const nonce = crypto.getRandomValues(new Uint8Array(32));
  try {
    const owner = receiveOwner({ suite, publicKey }, nonce);
    return {
      ...owner,
      key: base64url.encode(der),
      nonce: base64url.encode(nonce),
    };
  } finally {
    der.fill(0);
    nonce.fill(0);
  }
}

// The caller gets only ciphertext until a reselected file and separately entered code
// reopen all private records. Cancelling/retrying cannot mutate an already open wallet.
export async function prepareKit(suite, base, restore, onClose) {
  checkSuite(suite);
  const key = base
    ? base.key.slice()
    : crypto.getRandomValues(new Uint8Array(32));
  let live = true,
    confirming = false,
    data,
    archive;
  const cancel = () => {
    if (!live) return;
    live = false;
    key.fill(0);
    archive = null;
    onClose?.(false);
  };
  try {
    if (base) {
      const unpacked = await unpackArchive(base.archive, codeFor(key));
      data = unpacked.data;
      unpacked.key.fill(0);
    } else {
      data = {
        version: 1,
        chainId: CHAIN,
        genesis: GENESIS,
        walletId: crypto.randomUUID(),
        revision: 0,
        receives: [],
      };
    }
    if (data.revision >= MAX_RECORDS)
      throw new WalletError(
        "This wallet already contains 64 receive requests.",
      );
    data.receives.push(freshRecord(suite));
    data.revision++;
    archive = await packArchive(data, key);
    const { walletId, revision } = data;
    return Object.freeze({
      get archive() {
        return live ? archive : null;
      },
      filename: archiveFilename(walletId, revision),
      getRecoveryCode() {
        if (!live || base)
          throw new WalletError(
            "Use this wallet's separately saved recovery code.",
          );
        return codeFor(key);
      },
      cancel,
      async confirm(fileContents, code) {
        if (!live || confirming)
          throw new WalletError(
            "This pending backup has closed or is being checked.",
          );
        if (typeof fileContents !== "string" || fileContents !== archive)
          throw new WalletError(
            "Choose the exact updated backup you just downloaded.",
          );
        confirming = true;
        try {
          const next = await restore(fileContents, code);
          if (!live) {
            next.lock();
            throw new WalletError("Backup check cancelled.");
          }
          live = false;
          key.fill(0);
          archive = null;
          onClose?.(true);
          return next;
        } finally {
          confirming = false;
        }
      },
    });
  } catch (error) {
    cancel();
    throw error;
  } finally {
    if (data)
      for (const rec of data.receives) {
        rec.nonce = "";
        rec.key = "";
      }
  }
}

export function archiveFilename(walletId, revision) {
  return "p2party-testnet1-" + walletId + "-r" + revision + ".jwe";
}
