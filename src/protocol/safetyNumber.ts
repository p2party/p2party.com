/**
 * Out-of-band identity verification ("safety numbers").
 *
 * The handshake proves each peer holds the private key for the Ed25519
 * identity it presented. It cannot prove that identity belongs to the person
 * you think it does — in a no-PIN room a malicious signaling operator can
 * present a different identity to each side and mediate both. The only defence
 * is for two humans to compare a value derived from both public keys over a
 * channel the operator does not control.
 *
 * The construction follows Signal's displayable-fingerprint design:
 *
 *   fingerprint(key, id) = first 30 bytes of SHA-512 iterated ITERATIONS times
 *                          over (version_be16 ‖ key ‖ id)
 *
 * and the shared number is the two fingerprints concatenated in a canonical
 * (sorted) order, so both sides render identical digits without agreeing on who
 * is "first".
 *
 * The iteration count is the load-bearing part. Only 60 decimal digits are
 * shown, so a single hash would let an attacker grind a key whose fingerprint
 * matches a target. Iterating makes each grinding attempt thousands of times
 * more expensive; it is not decoration.
 */

const ITERATIONS = 5200;
const VERSION = 0;
/** 30 bytes -> 6 chunks of 5 bytes -> 6 groups of 5 digits per party. */
const FINGERPRINT_BYTES = 30;
const CHUNK_BYTES = 5;
const DIGITS_PER_CHUNK = 5;

const hexToBytes = (hex: string): Uint8Array => {
  const normalized = hex.trim().toLowerCase();
  if (normalized.length === 0 || normalized.length % 2 !== 0)
    throw new Error("identity key must be an even-length hex string");
  if (!/^[0-9a-f]+$/.test(normalized))
    throw new Error("identity key must be hexadecimal");
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  return out;
};

const sha512 = async (bytes: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(
    await globalThis.crypto.subtle.digest(
      "SHA-512",
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
    ),
  );

/**
 * Signal's iterated fingerprint. Each round re-appends the original key so the
 * chain cannot be shortcut by starting from an intermediate digest.
 */
const fingerprint = async (
  publicKeyHex: string,
  identifier: string,
): Promise<string> => {
  const key = hexToBytes(publicKeyHex);
  const id = new TextEncoder().encode(identifier);

  const seed = new Uint8Array(2 + key.length + id.length);
  seed[0] = (VERSION >> 8) & 0xff;
  seed[1] = VERSION & 0xff;
  seed.set(key, 2);
  seed.set(id, 2 + key.length);

  let digest = await sha512(seed);
  for (let i = 1; i < ITERATIONS; i++) {
    const round = new Uint8Array(digest.length + key.length);
    round.set(digest, 0);
    round.set(key, digest.length);
    digest = await sha512(round);
  }

  let digits = "";
  for (let offset = 0; offset < FINGERPRINT_BYTES; offset += CHUNK_BYTES) {
    // Big-endian over 5 bytes: max 2^40, well inside a safe JS integer.
    let value = 0;
    for (let i = 0; i < CHUNK_BYTES; i++)
      value = value * 256 + digest[offset + i];
    digits += (value % 100000).toString().padStart(DIGITS_PER_CHUNK, "0");
  }
  return digits;
};

export interface SafetyNumber {
  /** 60 digits, no separators. Compare this, or the grouped form. */
  readonly digits: string;
  /** 12 groups of 5 digits, for reading aloud. */
  readonly groups: readonly string[];
}

/**
 * Both peers call this with their own key first and get the same result: the
 * two fingerprints are concatenated in lexicographic order, not in call order.
 */
export const computeSafetyNumber = async (
  localPublicKeyHex: string,
  localPeerId: string,
  remotePublicKeyHex: string,
  remotePeerId: string,
): Promise<SafetyNumber> => {
  const [local, remote] = await Promise.all([
    fingerprint(localPublicKeyHex, localPeerId),
    fingerprint(remotePublicKeyHex, remotePeerId),
  ]);
  const digits = local < remote ? local + remote : remote + local;
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += DIGITS_PER_CHUNK)
    groups.push(digits.slice(i, i + DIGITS_PER_CHUNK));
  return { digits, groups };
};

/** Render an identity key the way a human can compare it character by character. */
export const formatKeyForDisplay = (publicKeyHex: string): string =>
  (publicKeyHex.match(/.{1,4}/g) ?? []).join(" ");
