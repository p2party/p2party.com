import { describe, expect, test } from "bun:test";

// Type-only: erased at compile time, so it cannot import the SDK before the
// localStorage stub below is in place.
import type { RoomPolicyV1 } from "../src/protocol/v4";

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
  forgetRoomPin,
  getTransientRoomPin,
  getTransientRoomPolicy,
  hasTransientRoomPin,
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

  /** Split a produced invite path the way a browser splits a location. */
  const splitInvitePath = (
    path: string,
  ): { pathname: string; search: string; hash: string } => {
    const hashIndex = path.indexOf("#");
    const beforeHash = hashIndex < 0 ? path : path.slice(0, hashIndex);
    const hash = hashIndex < 0 ? "" : path.slice(hashIndex);
    const searchIndex = beforeHash.indexOf("?");
    return {
      pathname: searchIndex < 0 ? beforeHash : beforeHash.slice(0, searchIndex),
      search: searchIndex < 0 ? "" : beforeHash.slice(searchIndex),
      hash,
    };
  };

  const resolvePath = (path: string) => {
    const { pathname, search, hash } = splitInvitePath(path);
    return resolveRoomInvite(pathname, hash, search);
  };

  test("a PIN room's invitation sends no query string at all", () => {
    const path = roomInvitePath(canonicalRoomUrl, immediateRoomPolicy("pin"));

    // Everything before the "#" is what the browser puts on the wire, so the
    // room's shape has to live after it, next to the capability: a query
    // string would tell the origin server and every CDN in front of it, once
    // per invitation click, that this room is PIN-protected.
    expect(path).toBe(`/r#v1.${compact}&auth=pin`);
    expect(path).not.toContain("?");
    expect(splitInvitePath(path).search).toBe("");

    const resolved = resolvePath(path);
    expect(resolved.kind).toBe("valid");
    if (resolved.kind !== "valid") throw new Error("invite did not resolve");
    expect(resolved.roomUrl).toBe(canonicalRoomUrl);
    expect(resolved.policy.authMode).toBe("pin");
    expect(resolved.specifiedPolicy.authMode).toBe(true);
  });

  test("a non-default ML-KEM suite stays out of the query string too", () => {
    const path = roomInvitePath(
      canonicalRoomUrl,
      immediateRoomPolicy("nopin", "hybrid-mlkem512"),
    );

    expect(path).toBe(`/r#v1.${compact}&pq=512`);
    expect(path).not.toContain("?");

    const resolved = resolvePath(path);
    expect(resolved.kind).toBe("valid");
    if (resolved.kind !== "valid") throw new Error("invite did not resolve");
    expect(resolved.policy.pqMode).toBe("hybrid-mlkem512");
    expect(resolved.specifiedPolicy.pqMode).toBe(true);
  });

  test("an invitation that still states its policy in the query is refused", () => {
    // The query form is gone: nothing writes it and nothing reads it. A link
    // that still states a policy there cannot be honoured -- and must not be
    // quietly honoured as the default either, because a PIN room's joiner
    // resolved to the default "nopin" shape walks into an authenticated
    // handshake that fails for a reason the screen never shows. Name the
    // problem instead, the way the retired-protocol-v3 branch already does.
    for (const search of [
      "?auth=pin",
      "?v=4",
      "?pq=1024",
      "?v=4&auth=pin&pq=1024",
      `?policy=${"A".repeat(43)}`,
      "?v=3&auth=pin&pq=1024",
    ]) {
      const stale = resolveRoomInvite("/r", `#v1.${compact}`, search);
      expect(`${search} -> ${stale.kind}`).toBe(`${search} -> invalid`);
      if (stale.kind !== "invalid") throw new Error("stale invite resolved");
      expect(stale.error).toContain("older build");
      expect(stale.error).toContain("fresh invitation");
    }
  });

  test("a query that never carried a policy is treated exactly as before", () => {
    // Only the four policy parameters changed home, so nothing else about a
    // query string changes meaning: an empty one still resolves, and an
    // unrelated parameter is still refused by name.
    for (const search of ["", "?"]) {
      const bare = resolveRoomInvite("/r", `#v1.${compact}`, search);
      expect(bare.kind).toBe("valid");
      if (bare.kind !== "valid") throw new Error("invite did not resolve");
      expect(bare.roomUrl).toBe(canonicalRoomUrl);
      expect(bare.policy.authMode).toBe("nopin");
    }

    const junk = resolveRoomInvite("/r", `#v1.${compact}`, "?secret=value");
    expect(junk.kind).toBe("invalid");
    if (junk.kind !== "invalid") throw new Error("invite resolved");
    expect(junk.error).toContain("Unsupported room invitation parameter");
  });

  test("the retired protocol v3 is rejected", () => {
    const retired = resolveRoomInvite(
      "/r",
      `#v1.${compact}&v=3&auth=pin&pq=1024`,
      "",
    );
    expect(retired.kind).toBe("invalid");
    if (retired.kind !== "invalid") throw new Error("v3 invite resolved");
    expect(retired.error).toContain("retired protocol v3");
  });

  test("an unknown or repeated fragment parameter is rejected", () => {
    const unknown = resolveRoomInvite("/r", `#v1.${compact}&secret=value`, "");
    expect(unknown.kind).toBe("invalid");
    if (unknown.kind !== "invalid") throw new Error("invite resolved");
    expect(unknown.error).toContain("Unsupported room invitation parameter");

    // The single-occurrence rule travels with it.
    const twice = resolveRoomInvite("/r", `#v1.${compact}&pq=768&pq=1024`, "");
    expect(twice.kind).toBe("invalid");
    if (twice.kind !== "invalid") throw new Error("invite resolved");
    expect(twice.error).toContain("must occur once");
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
      // The whole 32-byte policy - cadence, lanes, frames, duration and all -
      // is the most identifying thing an invitation carries after the
      // capability, and it too now rides behind the "#".
      expect(path).toMatch(
        /^\/r#v1\.[A-Za-z0-9_-]{43}&policy=[A-Za-z0-9_-]{43}$/u,
      );
      expect(path).not.toContain("?");
      expect(splitInvitePath(path).search).toBe("");

      const resolved = resolvePath(path);
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
    // What the fragment carries after the capability, which is the only
    // thing this parser is ever handed.
    const stated = roomInvitePath(canonicalRoomUrl, policy)
      .split("&")
      .slice(1)
      .join("&");

    expect(() => parseRoomPolicyInvite(`${stated}&auth=pin`)).toThrow(
      "cannot combine",
    );
    expect(() => parseRoomPolicyInvite(`${stated}&pq=1024`)).toThrow(
      "cannot combine",
    );
    expect(() => parseRoomPolicyInvite("policy=not-base64url")).toThrow(
      "malformed policy parameter",
    );
    // 43 valid base64url characters that are not a valid policy: the length
    // and alphabet pass, the policy codec rejects the bytes.
    expect(() => parseRoomPolicyInvite(`policy=${"A".repeat(43)}`)).toThrow(
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
    const canonical = roomInvitePath(canonicalRoomUrl, scheduled).slice(
      `/r#v1.${compact}&policy=`.length,
    );
    expect(() => parseRoomPolicyInvite(`policy=${canonical}`)).not.toThrow();
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const lastIndex = alphabet.indexOf(canonical.at(-1)!);
    const smuggled =
      canonical.slice(0, -1) + alphabet[(lastIndex & ~0x03) | 0x01];
    expect(smuggled).not.toBe(canonical);
    expect(() => parseRoomPolicyInvite(`policy=${smuggled}`)).toThrow(
      "malformed policy parameter",
    );
  });

  test("round-trips every room shape through the fragment alone", () => {
    const cases: { name: string; policy: RoomPolicyV1 }[] = [
      { name: "immediate", policy: immediateRoomPolicy("nopin") },
      { name: "pin", policy: immediateRoomPolicy("pin") },
      {
        name: "non-default suite",
        policy: immediateRoomPolicy("nopin", "hybrid-mlkem1024"),
      },
      {
        name: "pin + non-default suite",
        policy: immediateRoomPolicy("pin", "hybrid-mlkem512"),
      },
      {
        name: "scheduled",
        policy: scheduledRoomPolicy(
          "pin",
          "hybrid-mlkem1024",
          SCHEDULED_COVER_PRESETS[0],
        ),
      },
    ];

    for (const { name, policy } of cases) {
      const path = roomInvitePath(canonicalRoomUrl, policy);
      expect(`${name}: ${path}`).not.toContain("?");

      const resolved = resolvePath(path);
      expect(resolved.kind).toBe("valid");
      if (resolved.kind !== "valid")
        throw new Error(`${name} invite did not resolve`);
      expect(resolved.roomUrl).toBe(canonicalRoomUrl);
      expect(resolved.policy).toEqual(policy);
      // The specified flags survive too: they are what stops a saved room's
      // policy from being overwritten by a link that never mentioned it.
      expect(resolved.specifiedPolicy).toEqual({
        wireVersion: policy.coverMode === "scheduled",
        authMode: policy.coverMode === "scheduled" || policy.authMode === "pin",
        pqMode:
          policy.coverMode === "scheduled" ||
          policy.pqMode !== "hybrid-mlkem768",
        coverMode: policy.coverMode === "scheduled",
      });
    }
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

  test("a rejected PIN is dropped without losing the room policy", () => {
    // Retrying after "PIN did not match" has to start from an empty field, or
    // the retry is silently the same value. The policy is not the user's
    // mistake and must survive: it is what tells the join dialog to ask for a
    // PIN at all, and it is fixed when the room is created.
    const policy = immediateRoomPolicy("pin", "hybrid-mlkem512");
    const pin = new TextEncoder().encode("wrong horse");
    rememberRoomAccess(compact, policy, pin);

    forgetRoomPin(canonicalRoomUrl);
    expect(getTransientRoomPin(compact)).toBeUndefined();
    expect(hasTransientRoomPin(compact)).toBe(false);
    expect(getTransientRoomPolicy(compact)).toEqual(policy);

    // ...and the next attempt is remembered normally.
    const retry = new TextEncoder().encode("correct horse");
    rememberRoomAccess(compact, policy, retry);
    expect(getTransientRoomPin(canonicalRoomUrl)).toEqual(retry);

    forgetRoomAccess(canonicalRoomUrl);
    pin.fill(0);
    retry.fill(0);
  });

  test("rejects ambiguous or unsupported public policy", () => {
    expect(() => parseRoomPolicyInvite("pq=768&pq=1024")).toThrow(
      "must occur once",
    );
    expect(() => parseRoomPolicyInvite("pq=2048")).toThrow("unsupported");
    expect(() => parseRoomPolicyInvite("v=2")).toThrow("protocol v4");
    expect(() => parseRoomPolicyInvite("v=3")).toThrow("retired protocol v3");
    expect(() => parseRoomPolicyInvite("secret=value")).toThrow(
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
