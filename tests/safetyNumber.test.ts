import { describe, expect, test } from "bun:test";

import {
  computeSafetyNumber,
  formatKeyForDisplay,
} from "../src/protocol/safetyNumber";

const KEY_A = "1a".repeat(32);
const KEY_B = "2b".repeat(32);
const KEY_C = "3c".repeat(32);
const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

describe("safety number", () => {
  test("both peers derive the same number regardless of argument order", async () => {
    const fromA = await computeSafetyNumber(KEY_A, ID_A, KEY_B, ID_B);
    const fromB = await computeSafetyNumber(KEY_B, ID_B, KEY_A, ID_A);
    expect(fromA.digits).toBe(fromB.digits);
  });

  test("is 60 digits in 12 groups of 5", async () => {
    const { digits, groups } = await computeSafetyNumber(
      KEY_A,
      ID_A,
      KEY_B,
      ID_B,
    );
    expect(digits).toMatch(/^[0-9]{60}$/);
    expect(groups).toHaveLength(12);
    for (const g of groups) expect(g).toMatch(/^[0-9]{5}$/);
    expect(groups.join("")).toBe(digits);
  });

  test("a different peer key produces a different number", async () => {
    const withB = await computeSafetyNumber(KEY_A, ID_A, KEY_B, ID_B);
    const withC = await computeSafetyNumber(KEY_A, ID_A, KEY_C, ID_B);
    expect(withB.digits).not.toBe(withC.digits);
  });

  test("the peer id is bound, not just the key", async () => {
    const first = await computeSafetyNumber(KEY_A, ID_A, KEY_B, ID_B);
    const second = await computeSafetyNumber(KEY_A, ID_A, KEY_B, ID_A);
    expect(first.digits).not.toBe(second.digits);
  });

  test("rejects malformed identity keys instead of hashing garbage", async () => {
    // Even length, so it reaches the charset check rather than the length one.
    await expect(
      computeSafetyNumber("zzzzzzzz", ID_A, KEY_B, ID_B),
    ).rejects.toThrow(/hexadecimal/);
    await expect(computeSafetyNumber("abc", ID_A, KEY_B, ID_B)).rejects.toThrow(
      /even-length/,
    );
    await expect(computeSafetyNumber("", ID_A, KEY_B, ID_B)).rejects.toThrow();
  });

  test("is case-insensitive about hex input", async () => {
    const lower = await computeSafetyNumber(KEY_A, ID_A, KEY_B, ID_B);
    const upper = await computeSafetyNumber(
      KEY_A.toUpperCase(),
      ID_A,
      KEY_B.toUpperCase(),
      ID_B,
    );
    expect(lower.digits).toBe(upper.digits);
  });

  test("formats a key in readable quads", () => {
    expect(formatKeyForDisplay("aabbccdd")).toBe("aabb ccdd");
    expect(formatKeyForDisplay(KEY_A).split(" ")).toHaveLength(16);
  });
});
