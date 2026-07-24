import { describe, expect, test } from "bun:test";

const stored = new Map<string, string>();
const localStorageStub: Storage = {
  get length() {
    return stored.size;
  },
  clear: () => stored.clear(),
  getItem: (key) => stored.get(key) ?? null,
  key: (index) => [...stored.keys()][index] ?? null,
  removeItem: (key) => {
    stored.delete(key);
  },
  setItem: (key, value) => {
    stored.set(key, value);
  },
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageStub });

const { default: p2party } = await import("p2party");
const {
  forgetRoomAccess,
  getTransientRoomPin,
  getTransientRoomPolicy,
  parseRoomPolicyInvite,
  rememberRoomAccess,
  resolveRoomInvite,
  roomInvitePath,
} = await import("../src/protocol/roomAccess");
const { immediateRoomPolicy } = await import("../src/protocol/v3");

describe("room invitation routing", () => {
  const capability = Uint8Array.from(
    { length: 32 },
    (_, index) => (index * 17 + 3) & 0xff,
  );
  const compact = p2party.encodeRoomCapabilityBase64Url(capability);
  const canonicalRoomUrl = p2party.normalizeRoomCapability(compact);

  test("keeps capability after the fragment while query policy stays public", () => {
    const path = roomInvitePath(
      canonicalRoomUrl,
      immediateRoomPolicy("pin", "hybrid-mlkem1024"),
    );
    const [publicRequest, fragment] = path.split("#");

    expect(publicRequest).toBe("/r?auth=pin&pq=1024");
    expect(publicRequest).not.toContain(compact);
    expect(publicRequest).not.toContain(canonicalRoomUrl);
    expect(fragment).toBe(`v1.${compact}`);

    const resolved = resolveRoomInvite(
      "/r",
      `#${fragment}`,
      "?v=3&auth=pin&pq=1024",
    );
    expect(resolved.kind).toBe("valid");
    if (resolved.kind !== "valid") throw new Error("invite did not resolve");
    expect(resolved.roomUrl).toBe(canonicalRoomUrl);
    expect(resolved.policy.authMode).toBe("pin");
    expect(resolved.policy.pqMode).toBe("hybrid-mlkem1024");
  });

  test("uses the shortest fragment URL for the exact default policy", () => {
    const path = roomInvitePath(
      canonicalRoomUrl,
      immediateRoomPolicy("nopin", "hybrid-mlkem768"),
    );
    expect(path).toBe(`/r#v1.${compact}`);

    const resolved = resolveRoomInvite("/r", `#v1.${compact}`, "");
    expect(resolved.kind).toBe("valid");
    if (resolved.kind !== "valid") throw new Error("invite did not resolve");
    expect(resolved.policy.authMode).toBe("nopin");
    expect(resolved.policy.pqMode).toBe("hybrid-mlkem768");
    expect(resolved.specifiedPolicy).toEqual({
      wireVersion: true,
      authMode: true,
      pqMode: true,
    });
  });

  test("rejects every capability-bearing HTTP room path", () => {
    expect(resolveRoomInvite(`/rooms/${canonicalRoomUrl}`, "", "").kind).toBe(
      "none",
    );
    expect(resolveRoomInvite(`/rooms/${compact}`, "", "").kind).toBe("none");
    expect(resolveRoomInvite(`/rooms/v1.${compact}`, "", "").kind).toBe("none");
  });

  test("keys transient policy and PIN state by canonical capability", () => {
    const policy = immediateRoomPolicy("pin", "hybrid-mlkem512");
    const pin = new TextEncoder().encode("correct horse");
    rememberRoomAccess(compact, policy, pin);

    expect(getTransientRoomPolicy(canonicalRoomUrl)).toEqual(policy);
    expect(getTransientRoomPin(canonicalRoomUrl)).toEqual(pin);

    forgetRoomAccess(canonicalRoomUrl);
    expect(getTransientRoomPolicy(compact)).toBeUndefined();
    expect(getTransientRoomPin(compact)).toBeUndefined();
    pin.fill(0);
  });

  test("rejects ambiguous or unsupported public policy", () => {
    expect(() => parseRoomPolicyInvite("?pq=768&pq=1024")).toThrow(
      "must occur once",
    );
    expect(() => parseRoomPolicyInvite("?pq=2048")).toThrow("unsupported");
    expect(() => parseRoomPolicyInvite("?v=2")).toThrow("protocol v3");
    expect(() => parseRoomPolicyInvite("?secret=value")).toThrow(
      "Unsupported room invitation parameter",
    );
    expect(() =>
      roomInvitePath(canonicalRoomUrl, {
        ...immediateRoomPolicy("nopin"),
        wireVersion: 2 as 3,
      }),
    ).toThrow("protocol v3");
  });
});
