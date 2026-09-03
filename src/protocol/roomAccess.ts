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

/**
 * Drop only the PIN, keeping the room policy.
 *
 * After the library reports "pin-mismatch" the held PIN is known wrong, and a
 * retry that silently reuses it is not a retry. The policy is a different
 * thing entirely: it is fixed when the room is created, it is not what the
 * user got wrong, and it is what tells the join dialog to ask for a PIN at
 * all — so forgetting it too would break the very retry this enables.
 */
export const forgetRoomPin = (roomUrl: string): void => {
  const roomKey = canonicalRoomKey(roomUrl);
  transientPins.get(roomKey)?.fill(0);
  transientPins.delete(roomKey);
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

/**
 * The four parameters with which an invitation may state the room's shape.
 *
 * They are read from the fragment and nowhere else. The query string is
 * matched against this same set for one purpose only: to recognise a link
 * from an older build and say so.
 */
const POLICY_PARAMETERS = new Set(["v", "auth", "pq", "policy"]);

// `stated` is the query-shaped body in which an invitation states the room's
// shape — in every link this app produces or accepts, the part of the fragment
// that follows the capability.
//
// The policy parameter is the canonical base64url of the 32-byte RoomPolicyV1
// wire form. The library's capability codec is exactly that — a strict
// 32-byte base64url codec that rejects non-canonical spellings (it checks the
// final sextet's unused bits and re-encodes to compare), so the policy
// parameter reuses it rather than carrying a second implementation.
export const parseRoomPolicyInvite = (
  stated: string,
): ParsedRoomPolicyInvite => {
  const params = new URLSearchParams(stated);
  for (const key of params.keys()) {
    if (!POLICY_PARAMETERS.has(key))
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

/**
 * The character that ends the capability and begins the room's shape inside
 * the fragment.
 *
 * `p2party.encodeRoomInviteFragment` emits exactly `"v1."` followed by 43
 * characters of the base64url alphabet (`A-Z`, `a-z`, `0-9`, `-`, `_`), and
 * `decodeRoomCapabilityBase64Url` enforces that shape with
 * `/^[A-Za-z0-9_-]{43}$/` before it will decode anything. `&` is not in that
 * alphabet and is not one of `v`, `1` or `.`, so it cannot occur anywhere in a
 * capability fragment the library produces, nor in one it would accept. The
 * first `&` in the hash is therefore an unambiguous end-of-capability marker —
 * and what follows it is an ordinary query-shaped body that URLSearchParams,
 * and so parseRoomPolicyInvite, already read.
 */
const FRAGMENT_POLICY_SEPARATOR = "&";

const roomPolicyInviteParams = (policy: RoomPolicyV1): URLSearchParams => {
  const params = new URLSearchParams();
  if (policy.coverMode === "scheduled") {
    // A scheduled room MUST share its complete policy: a joiner that guesses
    // the schedule fails the authenticated handshake (policy hash mismatch).
    params.set(
      "policy",
      p2party.encodeRoomCapabilityBase64Url(p2party.encodeRoomPolicyV1(policy)),
    );
  } else {
    if (policy.authMode === "pin") params.set("auth", "pin");
    if (policy.pqMode !== "hybrid-mlkem768")
      params.set("pq", pqModeToQuery(policy.pqMode));
  }
  return params;
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
    const params = roomPolicyInviteParams(policy);
    // The room's shape rides in the fragment, beside the capability, because
    // only the fragment stays off the wire. It used to ride in the query
    // string, which the browser sends on every click: the origin server and
    // any CDN in front of it learned, per invitation opened, whether the room
    // is PIN-protected, which ML-KEM suite it pins, and for a scheduled room
    // its entire 32-byte policy. The capability was always safe here; the
    // room's shape was not.
    const publicPolicy =
      params.size > 0 ? `${FRAGMENT_POLICY_SEPARATOR}${params.toString()}` : "";
    return `/r#${fragment}${publicPolicy}`;
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
  /**
   * Not looked yet, which is different from "there is no invite". A URL
   * fragment is never sent to a server and so cannot exist at build time, so a
   * prerender of /r that resolved eagerly baked "Invalid room invitation --
   * Room invitation fragment is missing" into the HTML every real invite link
   * is served. This is the state both the build and the first client render
   * produce, so they agree, and the real answer arrives once there is a
   * document to read it from.
   */
  | { kind: "pending" }
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

/** Split a hash into the capability it always carries and the policy it may. */
const splitInviteFragment = (
  hash: string,
): { capability: string; policy: string } => {
  const separatorIndex = hash.indexOf(FRAGMENT_POLICY_SEPARATOR);
  return separatorIndex < 0
    ? { capability: hash, policy: "" }
    : {
        capability: hash.slice(0, separatorIndex),
        policy: hash.slice(separatorIndex + 1),
      };
};

/**
 * Refuse a query string on /r, which no longer says anything about a room.
 *
 * An invitation states the room's shape in its fragment and only there, so a
 * link still carrying `v`, `auth`, `pq` or `policy` in its query was written
 * by an older build. Resolving it silently to the default shape would be
 * worse than refusing it: the joiner of a PIN room would be dropped into an
 * authenticated handshake that fails on a policy hash mismatch, with nothing
 * on screen to say why. Name it instead, exactly as the retired protocol v3
 * is named, and send the visitor back to the sender for a link this build can
 * read.
 *
 * A query that never carried a policy keeps the treatment it already had: an
 * empty one resolves, an unrelated parameter is refused by name. Neither was
 * part of what leaked, so neither changes meaning here.
 */
const rejectInviteQuery = (search: string): void => {
  const keys = [...new URLSearchParams(search).keys()];
  if (keys.length === 0) return;
  throw new Error(
    keys.some((key) => POLICY_PARAMETERS.has(key))
      ? "Room invitation is from an older build; ask the sender for a fresh invitation"
      : `Unsupported room invitation parameter: ${keys[0]}`,
  );
};

/**
 * Resolve one fragment invite to the canonical internal server/database key.
 *
 * `search` is not a source of policy — nothing this app produces puts policy
 * there any more, and nothing reads it back. It is passed in so that a link
 * from an older build can be refused out loud rather than silently downgraded
 * to the default room shape.
 */
export const resolveRoomInvite = (
  pathname: string,
  hash: string,
  search: string,
): RoomInviteResolution => {
  const isFragmentRoute = pathname === "/r" || pathname === "/r/";
  if (!isFragmentRoute) return { kind: "none" };

  let capability: Uint8Array | undefined;
  try {
    rejectInviteQuery(search);
    if (hash.length === 0)
      throw new Error("Room invitation fragment is missing");
    const fragment = splitInviteFragment(hash);
    // Only the capability half reaches the library's fragment codec: it
    // demands the exact "v1." + 43 base64url characters and would reject the
    // policy riding behind the separator.
    capability = p2party.decodeRoomInviteFragment(fragment.capability);

    const parsedPolicy = parseRoomPolicyInvite(fragment.policy);
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
