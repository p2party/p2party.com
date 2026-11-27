// Accept the canonical PKCS#8 envelopes written by Node/OpenSSL. DER tags, lengths and
// parameterless algorithm OIDs are fixed by RFC 9881 §5 (ML) and RFC 9909 §5 (SLH).
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { slh_dsa_sha2_192s } from "@noble/post-quantum/slh-dsa.js";
import { hexToBytes, concatBytes } from "@noble/hashes/utils.js";

const ML_PREFIX = hexToBytes("020100300b0609608648016503040312");
const SLH_PREFIX = hexToBytes("020100300b0609608648016503040316");
function equal(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
// Return exactly one DER value, rejecting nonminimal lengths, extra objects and truncation.
function single(input, tag) {
  if (input.length < 2 || input[0] !== tag)
    throw new Error("Invalid native key");
  let size = input[1],
    start = 2;
  if (size & 128) {
    const n = size & 127;
    if (n < 1 || n > 2 || input.length < 2 + n || input[2] === 0)
      throw new Error("Invalid native key");
    size = 0;
    for (let i = 0; i < n; i++) size = size * 256 + input[start++];
    if (size < 128) throw new Error("Invalid native key");
  }
  if (size !== input.length - start) throw new Error("Invalid native key");
  return input.subarray(start);
}
function mlKeys(encoded) {
  if (encoded[0] === 0x80) return ml_dsa65.keygen(single(encoded, 0x80));
  if (encoded[0] === 0x04) {
    const raw = single(encoded, 0x04);
    if (raw.length !== ml_dsa65.lengths.secretKey)
      throw new Error("Invalid ML key length");
    const publicKey = ml_dsa65.getPublicKey(raw);
    // The expanded-only representation has no seed. Test correspondence using a fresh
    // local proof before trusting it. Most companion exports contain the seed only.
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    if (!ml_dsa65.verify(ml_dsa65.sign(challenge, raw), challenge, publicKey))
      throw new Error("Inconsistent ML key");
    return { secretKey: raw.slice(), publicKey };
  }
  const both = single(encoded, 0x30);
  const seed = single(both.subarray(0, 34), 0x04);
  const expanded = single(both.subarray(34), 0x04);
  const keys = ml_dsa65.keygen(seed);
  if (!equal(keys.secretKey, expanded)) {
    keys.secretKey.fill(0);
    throw new Error("Inconsistent ML key");
  }
  return keys;
}
export function importSigner(der, suite) {
  const outer = single(der, 0x30);
  const prefix = suite === 1 ? ML_PREFIX : SLH_PREFIX;
  if (
    (suite !== 1 && suite !== 2) ||
    !equal(outer.subarray(0, prefix.length), prefix)
  )
    throw new Error("Wrong signing suite");
  const raw = single(outer.subarray(prefix.length), 0x04);
  const algorithm = suite === 1 ? ml_dsa65 : slh_dsa_sha2_192s;
  let keys;
  if (suite === 1) keys = mlKeys(raw);
  else {
    if (raw.length !== algorithm.lengths.secretKey)
      throw new Error("Invalid SLH key length");
    // Rebuild PK.root from SK.seed, SK.prf and PK.seed; getPublicKey only extracts the stored root.
    keys = algorithm.keygen(raw.subarray(0, algorithm.lengths.seed));
    if (!equal(keys.secretKey, raw)) {
      keys.secretKey.fill(0);
      throw new Error("Inconsistent SLH key");
    }
  }
  const { publicKey, secretKey } = keys;
  return {
    suite,
    publicKey,
    sign(digest) {
      const signature = algorithm.sign(digest, secretKey);
      if (!algorithm.verify(signature, digest, publicKey))
        throw new Error("Signature verification failed");
      return signature;
    },
    lock() {
      secretKey.fill(0);
    },
  };
}

// RFC 9881 seed-only ML-DSA and RFC 9909 raw expanded SLH-DSA inside PKCS#8.
// The outer DER lengths, version and OIDs are fixed for these two standard representations.
export function generateNativeReceive(suite) {
  if (suite !== 1 && suite !== 2) throw new Error("Unsupported signing suite.");
  const algorithm = suite === 1 ? ml_dsa65 : slh_dsa_sha2_192s;
  const seed = crypto.getRandomValues(new Uint8Array(algorithm.lengths.seed));
  let keys;
  try {
    keys = algorithm.keygen(seed);
    const der =
      suite === 1
        ? concatBytes(
            hexToBytes("3034"),
            ML_PREFIX,
            hexToBytes("04228020"),
            seed,
          )
        : concatBytes(
            hexToBytes("3072"),
            SLH_PREFIX,
            hexToBytes("0460"),
            keys.secretKey,
          );
    return { der, publicKey: keys.publicKey };
  } finally {
    seed.fill(0);
    keys?.secretKey.fill(0);
  }
}
