import { describe, expect, test } from "bun:test";
import { createHash, randomBytes } from "node:crypto";

import { sha256 } from "../src/lib/sha256";

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString("hex");
const reference = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

describe("sha256", () => {
  test("matches the FIPS 180-4 example digests", () => {
    const utf8 = (text: string) => new TextEncoder().encode(text);
    expect(hex(sha256(utf8("")))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(hex(sha256(utf8("abc")))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(
      hex(
        sha256(
          utf8("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
        ),
      ),
    ).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });

  test("matches node's SHA-256 across every padding boundary", () => {
    // 0..300 bytes crosses the 55/56/64-byte boundaries where the length
    // field spills into a second block, several times over.
    for (let length = 0; length <= 300; length += 1) {
      const input = new Uint8Array(randomBytes(length));
      expect(`${String(length)}: ${hex(sha256(input))}`).toBe(
        `${String(length)}: ${reference(input)}`,
      );
    }
  });

  test("matches node's SHA-256 on a multi-block input", () => {
    const input = new Uint8Array(randomBytes(100_003));
    expect(hex(sha256(input))).toBe(reference(input));
  });

  test("leaves its input untouched", () => {
    const input = new Uint8Array(randomBytes(77));
    const copy = Uint8Array.from(input);
    sha256(input);
    expect(input).toEqual(copy);
  });
});
