import { base64url, CompactEncrypt, compactDecrypt } from "jose";
import { readHandle } from "@p2party/ledger-client";
export const CHAIN =
  "0x09a0ffa8e6af6aeb11d26671c6c76648965d60509cc3b7a1a4b454b6ec73c760";
export const GENESIS =
  "0x38d42d50a5a6d5ceb43fd6f63235e542716b1df5ccff59161c5fd7810aed17c6";
export const PROOF_CHAIN =
  "0x672e21c7b187a36b7f61f219ceb1d3c34fbf3eb5d39ec9723a7ed168fd0fc7a1";
export const MAX_ARCHIVE = 2 * 1024 * 1024;
export const HEADER = { alg: "dir", enc: "A256GCM", typ: "p2party-wallet+jwe" };
const PROTECTED = base64url.encode(
  new TextEncoder().encode(JSON.stringify(HEADER)),
);
export const ALGORITHMS = new Map([
  [1, "ml-dsa-65"],
  [2, "slh-dsa-sha2-192s"],
]);
export const MAX_RECORDS = 64;
const utf8 = new TextDecoder("utf-8", { fatal: true });
export class WalletError extends Error {}
export function requireWallet(ok, message) {
  if (!ok) throw new WalletError(message);
}
export function exactFields(value, names) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === names.length &&
    names.every((name) => Object.hasOwn(value, name))
  );
}
export function checkSuite(suite) {
  requireWallet(
    ALGORITHMS.has(suite),
    "Select a supported Testnet 1 signing suite.",
  );
}
export function bytes(value, min, max) {
  if (
    typeof value !== "string" ||
    value.length > Math.ceil((max * 4) / 3) ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  )
    throw new Error("Invalid encoding");
  const out = base64url.decode(value);
  if (out.length < min || out.length > max || base64url.encode(out) !== value)
    throw new Error("Invalid encoding");
  return out;
}
// Both native and browser writers use the same authenticated envelope and fresh JOSE IV.
export async function packArchive(data, key) {
  const plain = new TextEncoder().encode(JSON.stringify(data));
  try {
    return await new CompactEncrypt(plain)
      .setProtectedHeader(HEADER)
      .encrypt(key);
  } finally {
    plain.fill(0);
  }
}
export async function unpackArchive(archive, code) {
  let key, plaintext;
  try {
    if (
      typeof archive !== "string" ||
      archive.length > MAX_ARCHIVE ||
      !archive.startsWith(PROTECTED + "..")
    )
      throw new Error();
    const fields = archive.split(".");
    if (
      fields.length !== 5 ||
      fields[2].length !== 16 ||
      fields[4].length !== 22 ||
      /[^A-Za-z0-9_-]/.test(fields.slice(2).join(""))
    )
      throw new Error();
    // Reject non-canonical encodings, including modified unused tag bits.
    bytes(fields[4], 16, 16);
    const ciphertext = bytes(fields[3], 1, MAX_ARCHIVE);
    ciphertext.fill(0);
    if (typeof code !== "string" || !/^P2W1-[A-Za-z0-9_-]{43}$/.test(code))
      throw new Error();
    key = bytes(code.slice(5), 32, 32);
    ({ plaintext } = await compactDecrypt(archive, key, {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    }));
    const data = JSON.parse(utf8.decode(plaintext));
    if (
      !exactFields(data, [
        "version",
        "chainId",
        "genesis",
        "walletId",
        "revision",
        "receives",
      ]) ||
      data.version !== 1 ||
      data.chainId !== CHAIN ||
      data.genesis !== GENESIS ||
      typeof data.walletId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        data.walletId,
      ) ||
      !Array.isArray(data.receives) ||
      data.receives.length < 1 ||
      data.receives.length > MAX_RECORDS ||
      data.revision !== data.receives.length
    )
      throw new Error();

    if (
      data.receives.some(
        (v) =>
          !exactFields(v, ["key", "nonce", "suite", "commitment"]) ||
          !ALGORITHMS.has(v.suite),
      ) ||
      new Set(data.receives.map((v) => v.commitment)).size !==
        data.receives.length
    )
      throw new Error();
    return { key, data };
  } catch {
    key?.fill(0);
    throw new WalletError(
      "Could not open this Testnet 1 backup. Check the file and its recovery code.",
    );
  } finally {
    plaintext?.fill(0);
  }
}
export function reviewPayment(request, accounts) {
  requireWallet(
    exactFields(request, [
      "chainId",
      "genesis",
      "input",
      "recipient",
      "expiryHeight",
    ]) &&
      request.chainId === CHAIN &&
      request.genesis === GENESIS,
    "Choose a transfer request for Testnet 1.",
  );
  const { input, recipient, expiryHeight } = request;
  const isId = (value) =>
    typeof value === "string" &&
    value.length === 130 &&
    /^0x[0-9a-f]{128}$/.test(value);
  const isQuantity = (value) =>
    typeof value === "string" &&
    value.length <= 18 &&
    /^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/.test(value) &&
    "0x" + BigInt(value).toString(16) === value;
  requireWallet(
    exactFields(input, [
      "id",
      "suite",
      "commitment",
      "weight",
      "createdHeight",
      "spentHeight",
    ]) &&
      isId(input.id) &&
      isId(input.commitment) &&
      isQuantity(input.weight) &&
      isQuantity(input.createdHeight) &&
      input.spentHeight === null,
    "Provide the complete unspent unit from demos_getUnit.",
  );
  const weight = BigInt(input.weight);
  requireWallet(
    weight > 0n && (weight & (weight - 1n)) === 0n,
    "The input must be a whole native unit of valid weight.",
  );
  requireWallet(
    accounts.some(
      (owner) =>
        owner.commitment === input.commitment && owner.suite === input.suite,
    ),
    "This backup cannot spend the selected input.",
  );
  requireWallet(
    exactFields(recipient, ["suite", "commitment"]) &&
      isId(recipient.commitment) &&
      recipient.commitment !== input.commitment,
    "Provide a fresh full recipient commitment and suite.",
  );
  checkSuite(recipient.suite);
  requireWallet(
    isQuantity(expiryHeight) &&
      BigInt(expiryHeight) > BigInt(input.createdHeight),
    "Choose a finite expiry after the input creation height.",
  );
  return {
    chainId: CHAIN,
    genesis: GENESIS,
    inputId: input.id,
    source: input.commitment,
    sourceSuite: input.suite,
    weight: weight.toString(),
    recipient: { ...recipient },
    readHandle: readHandle(recipient),
    expiry: BigInt(expiryHeight).toString(),
  };
}
