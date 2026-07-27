import p2party from "./sdk";

import {
  immediateRoomPolicy,
  type RoomAuthMode,
  type RoomPqMode,
  type RoomPolicyV1,
} from "./v4";

const transientPins = new Map<string, Uint8Array>();
const transientPolicies = new Map<string, RoomPolicyV1>();

const copyPolicy = (policy: RoomPolicyV1): RoomPolicyV1 => ({ ...policy });
const canonicalRoomKey = (roomUrl: string): string =>
  p2party.normalizeRoomCapability(roomUrl);

export const rememberRoomAccess = (
  roomUrl: string,
  policy: RoomPolicyV1,
  pin?: Uint8Array,
): void => {
  const roomKey = canonicalRoomKey(roomUrl);
  transientPolicies.set(roomKey, copyPolicy(policy));

  const previous = transientPins.get(roomKey);
  previous?.fill(0);
  transientPins.delete(roomKey);

  if (policy.authMode === "pin") {
    if (!(pin instanceof Uint8Array) || pin.length === 0)
      throw new Error("A PIN is required for this room");
    transientPins.set(roomKey, Uint8Array.from(pin));
  } else if (pin !== undefined) {
    throw new Error("A no-PIN room cannot retain a PIN");
  }
};

export const getTransientRoomPin = (
  roomUrl: string,
): Uint8Array | undefined => {
  const pin = transientPins.get(canonicalRoomKey(roomUrl));
  return pin ? Uint8Array.from(pin) : undefined;
};

export const hasTransientRoomPin = (roomUrl: string): boolean =>
  transientPins.has(canonicalRoomKey(roomUrl));

export const getTransientRoomPolicy = (
  roomUrl: string,
): RoomPolicyV1 | undefined => {
  const policy = transientPolicies.get(canonicalRoomKey(roomUrl));
  return policy ? copyPolicy(policy) : undefined;
};

export const forgetRoomAccess = (roomUrl: string): void => {
  const roomKey = canonicalRoomKey(roomUrl);
  transientPins.get(roomKey)?.fill(0);
  transientPins.delete(roomKey);
  transientPolicies.delete(roomKey);
};

export const clearTransientRoomAccess = (): void => {
  for (const pin of transientPins.values()) pin.fill(0);
  transientPins.clear();
  transientPolicies.clear();
};

export interface ParsedRoomPolicyInvite {
  policy: RoomPolicyV1;
  specified: {
    wireVersion: boolean;
    authMode: boolean;
    pqMode: boolean;
    coverMode: boolean;
  };
}

const PQ_QUERY_TO_MODE: Record<string, RoomPqMode> = {
  "512": "hybrid-mlkem512",
  "768": "hybrid-mlkem768",
  "1024": "hybrid-mlkem1024",
};

const pqModeToQuery = (pqMode: RoomPqMode): string => {
  if (pqMode === "hybrid-mlkem512") return "512";
  if (pqMode === "hybrid-mlkem768") return "768";
  return "1024";
};

// The policy parameter is the canonical base64url of the 32-byte RoomPolicyV1
// wire form. The library's capability codec is exactly that — a strict
// 32-byte base64url codec that rejects non-canonical spellings (it checks the
// final sextet's unused bits and re-encodes to compare), so the policy
// parameter reuses it rather than carrying a second implementation.
export const parseRoomPolicyInvite = (
  search: string,
): ParsedRoomPolicyInvite => {
  const params = new URLSearchParams(search);
  const allowed = new Set(["v", "auth", "pq", "policy"]);
  for (const key of params.keys()) {
    if (!allowed.has(key))
      throw new Error(`Unsupported room invitation parameter: ${key}`);
  }

  const single = (name: string): string | undefined => {
    const values = params.getAll(name);
    if (values.length > 1)
      throw new Error(`Room invitation parameter ${name} must occur once`);
    return values[0];
  };

  const version = single("v");
  if (version === "3")
    throw new Error(
      "Room invitation is for the retired protocol v3; ask the sender for a fresh protocol v4 invitation",
    );
  if (version !== undefined && version !== "4")
    throw new Error("Room invitation requires protocol v4");

  const encodedPolicy = single("policy");
  if (encodedPolicy !== undefined) {
    // A full-policy invitation is the single source of truth: the compact
    // auth/pq shorthands must not contradict it, so they may not co-occur.
    if (single("auth") !== undefined || single("pq") !== undefined)
      throw new Error(
        "Room invitation cannot combine a full policy with auth/pq parameters",
      );
    let policy: RoomPolicyV1;
    try {
      policy = p2party.decodeRoomPolicyV1(
        p2party.decodeRoomCapabilityBase64Url(encodedPolicy),
      );
    } catch (cause) {
      throw Object.assign(
        new Error(
          `Room invitation has a malformed policy parameter: ${
            cause instanceof Error ? cause.message : "unreadable"
          }`,
        ),
        { cause },
      );
    }
    return {
      policy,
      specified: {
        wireVersion: true,
        authMode: true,
        pqMode: true,
        coverMode: true,
      },
    };
  }

  const auth = single("auth");
  if (auth !== undefined && auth !== "pin" && auth !== "nopin")
    throw new Error("Room invitation has an unsupported authentication mode");
  const authMode: RoomAuthMode = auth === "pin" ? "pin" : "nopin";

  const pq = single("pq");
  if (
    pq !== undefined &&
    !Object.prototype.hasOwnProperty.call(PQ_QUERY_TO_MODE, pq)
  )
    throw new Error("Room invitation has an unsupported ML-KEM suite");
  const pqMode = pq === undefined ? "hybrid-mlkem768" : PQ_QUERY_TO_MODE[pq];

  return {
    policy: immediateRoomPolicy(authMode, pqMode),
    specified: {
      wireVersion: version !== undefined,
      authMode: auth !== undefined,
      pqMode: pq !== undefined,
      coverMode: false,
    },
  };
};

export const roomInvitePath = (
  roomUrl: string,
  policy: RoomPolicyV1,
): string => {
  if (policy.wireVersion !== 4)
    throw new Error("Room invitation requires protocol v4");
  const capability = p2party.decodeRoomCapability(roomUrl);
  try {
    const fragment = p2party.encodeRoomInviteFragment(capability);
    const params = new URLSearchParams();
    if (policy.coverMode === "scheduled") {
      // A scheduled room MUST share its complete policy: a joiner that guesses
      // the schedule fails the authenticated handshake (policy hash mismatch).
      params.set(
        "policy",
        p2party.encodeRoomCapabilityBase64Url(
          p2party.encodeRoomPolicyV1(policy),
        ),
      );
    } else {
      if (policy.authMode === "pin") params.set("auth", "pin");
      if (policy.pqMode !== "hybrid-mlkem768")
        params.set("pq", pqModeToQuery(policy.pqMode));
    }
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return `/r${query}#${fragment}`;
  } finally {
    capability.fill(0);
  }
};

export const absoluteRoomInviteUrl = (
  roomUrl: string,
  policy: RoomPolicyV1,
): string => {
  const path = roomInvitePath(roomUrl, policy);
  return new URL(path, window.location.origin).toString();
};

export type RoomInviteResolution =
  | { kind: "none" }
  | { kind: "invalid"; error: string }
  | {
      kind: "valid";
      roomUrl: string;
      policy: RoomPolicyV1;
      specifiedPolicy: ParsedRoomPolicyInvite["specified"];
    };

const errorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : "Malformed room invitation";

/** Resolve one fragment invite to the canonical internal server/database key. */
export const resolveRoomInvite = (
  pathname: string,
  hash: string,
  search: string,
): RoomInviteResolution => {
  const isFragmentRoute = pathname === "/r" || pathname === "/r/";
  if (!isFragmentRoute) return { kind: "none" };

  let capability: Uint8Array | undefined;
  try {
    if (hash.length === 0)
      throw new Error("Room invitation fragment is missing");
    capability = p2party.decodeRoomInviteFragment(hash);

    const parsedPolicy = parseRoomPolicyInvite(search);
    const roomUrl = p2party.normalizeRoomCapability(
      p2party.encodeRoomCapabilityBase64Url(capability),
    );
    capability.fill(0);
    capability = undefined;
    return {
      kind: "valid",
      roomUrl,
      policy: parsedPolicy.policy,
      // Report what the invitation actually pinned down: a bare /r#fragment
      // link to a saved PIN/non-768 room must not trip the policy-conflict
      // path merely because defaults were treated as explicit choices.
      specifiedPolicy: parsedPolicy.specified,
    };
  } catch (cause) {
    capability?.fill(0);
    return { kind: "invalid", error: errorMessage(cause) };
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", clearTransientRoomAccess);
}
