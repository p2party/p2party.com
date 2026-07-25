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
const { immediateRoomPolicy, scheduledRoomPolicy, SCHEDULED_COVER_PRESETS } =
  await import("../src/protocol/v4");

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
      "?v=4&auth=pin&pq=1024",
    );
    expect(resolved.kind).toBe("valid");
    if (resolved.kind !== "valid") throw new Error("invite did not resolve");
    expect(resolved.roomUrl).toBe(canonicalRoomUrl);
    expect(resolved.policy.authMode).toBe("pin");
    expect(resolved.policy.pqMode).toBe("hybrid-mlkem1024");

    const retired = resolveRoomInvite(
      "/r",
      `#${fragment}`,
      "?v=3&auth=pin&pq=1024",
    );
    expect(retired.kind).toBe("invalid");
    if (retired.kind !== "invalid") throw new Error("v3 invite resolved");
    expect(retired.error).toContain("retired protocol v3");
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
    // A bare fragment link pins nothing down: defaults must not be reported
    // as explicit choices, or saved PIN/non-768 rooms hit the conflict path.
    expect(resolved.specifiedPolicy).toEqual({
      wireVersion: false,
      authMode: false,
      pqMode: false,
      coverMode: false,
    });
  });

  test("a scheduled room invite carries the complete policy and round-trips", () => {
    for (const preset of SCHEDULED_COVER_PRESETS) {
      const policy = scheduledRoomPolicy("pin", "hybrid-mlkem1024", preset);
      // The preset must satisfy the library's canonical validation.
      expect(
        p2party.decodeRoomPolicyV1(p2party.encodeRoomPolicyV1(policy)),
      ).toEqual(policy);

      const path = roomInvitePath(canonicalRoomUrl, policy);
      const [publicRequest, fragment] = path.split("#");
      expect(publicRequest).toMatch(/^\/r\?policy=[A-Za-z0-9_-]{43}$/u);
      expect(publicRequest).not.toContain("auth=");
      expect(publicRequest).not.toContain(compact);

      const resolved = resolveRoomInvite(
        "/r",
        `#${fragment}`,
        publicRequest.slice("/r".length),
      );
      expect(resolved.kind).toBe("valid");
      if (resolved.kind !== "valid") throw new Error("invite did not resolve");
      expect(resolved.roomUrl).toBe(canonicalRoomUrl);
      expect(resolved.policy).toEqual(policy);
      expect(resolved.specifiedPolicy).toEqual({
        wireVersion: true,
        authMode: true,
        pqMode: true,
        coverMode: true,
      });
    }
  });

  test("rejects contradictory or malformed full-policy invitations", () => {
    const policy = scheduledRoomPolicy(
      "nopin",
      "hybrid-mlkem768",
      SCHEDULED_COVER_PRESETS[0],
    );
    const search = roomInvitePath(canonicalRoomUrl, policy)
      .split("#")[0]
      .slice("/r".length);

    expect(() => parseRoomPolicyInvite(`${search}&auth=pin`)).toThrow(
      "cannot combine",
    );
    expect(() => parseRoomPolicyInvite(`${search}&pq=1024`)).toThrow(
      "cannot combine",
    );
    expect(() => parseRoomPolicyInvite("?policy=not-base64url")).toThrow(
      "malformed policy parameter",
    );
    // 43 valid base64url characters that are not a valid policy: the length
    // and alphabet pass, the policy codec rejects the bytes.
    expect(() => parseRoomPolicyInvite(`?policy=${"A".repeat(43)}`)).toThrow(
      "malformed policy parameter",
    );

    // Canonicality is enforced by the library codec the parameter now shares
    // with the capability fragment: the final base64url character carries two
    // unused bits, so a spelling that sets them decodes to the same bytes and
    // would otherwise be an undetectable per-recipient watermark.
    const scheduled = scheduledRoomPolicy(
      "nopin",
      "hybrid-mlkem768",
      SCHEDULED_COVER_PRESETS[0],
    );
    const canonical = roomInvitePath(canonicalRoomUrl, scheduled)
      .split("#")[0]
      .slice("/r?policy=".length);
    expect(() => parseRoomPolicyInvite(`?policy=${canonical}`)).not.toThrow();
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const lastIndex = alphabet.indexOf(canonical.at(-1)!);
    const smuggled =
      canonical.slice(0, -1) + alphabet[(lastIndex & ~0x03) | 0x01];
    expect(smuggled).not.toBe(canonical);
    expect(() => parseRoomPolicyInvite(`?policy=${smuggled}`)).toThrow(
      "malformed policy parameter",
    );
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
    expect(() => parseRoomPolicyInvite("?v=2")).toThrow("protocol v4");
    expect(() => parseRoomPolicyInvite("?v=3")).toThrow("retired protocol v3");
    expect(() => parseRoomPolicyInvite("?secret=value")).toThrow(
      "Unsupported room invitation parameter",
    );
    expect(() =>
      roomInvitePath(canonicalRoomUrl, {
        ...immediateRoomPolicy("nopin"),
        wireVersion: 2 as 4,
      }),
    ).toThrow("protocol v4");
  });
});
