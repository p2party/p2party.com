import type { PeerHandshakeStatus } from "./v4";
import type { Peer } from "p2party";

/** A failed handshake, with the peerId whose edge produced it. */
export interface HandshakeFailure {
  peerId: string;
  status: PeerHandshakeStatus;
}

export type HandshakeFailureReason = NonNullable<PeerHandshakeStatus["reason"]>;

/**
 * Most actionable first. The banner reports one failure, not one per peer, and
 * a PIN the user can re-enter beats a policy they cannot change.
 */
const REASON_PRIORITY: HandshakeFailureReason[] = [
  "pin-throttled",
  "pin-mismatch",
  "policy",
  "transport",
];

const rank = (status: PeerHandshakeStatus): number => {
  const index = REASON_PRIORITY.indexOf(
    (status.reason ?? "transport") as HandshakeFailureReason,
  );
  return index < 0 ? REASON_PRIORITY.length : index;
};

/**
 * The failures that still describe reality.
 *
 * `handshakeStatusByPeer` is keyed by peerId, which is a per-session signaling
 * handle rather than a peer. That cuts both ways, and the two halves used to
 * be traded against each other:
 *
 *  - A joiner whose PIN did not match is torn down and dropped from `peers`,
 *    so asking "is the failed peerId still on the roster?" threw the failure
 *    away and a wrong PIN looked exactly like an ordinary empty room.
 *  - A peer that reconnects arrives under a NEW peerId, so its old "failed"
 *    entry outlives the problem, and not asking at all left a stale banner
 *    fixed over the room header insisting a working room was broken.
 *
 * The identity recorded on the status settles both: a failure is over only
 * when a peer with that same `peerPublicKey` is on the roster right now AND
 * authenticated. Being on the roster is not enough (it may still be
 * handshaking), and an authenticated status alone is not enough (the roster
 * may have dropped that peer since).
 */
export const unresolvedHandshakeFailures = (
  handshakeStatusByPeer: Readonly<Record<string, PeerHandshakeStatus>>,
  peers: readonly Peer[],
): HandshakeFailure[] => {
  const authenticatedIdentities = new Set(
    peers
      .filter(
        (peer) =>
          handshakeStatusByPeer[peer.peerId]?.status === "authenticated",
      )
      .map((peer) => peer.peerPublicKey),
  );

  return Object.entries(handshakeStatusByPeer)
    .filter(([, status]) => status.status === "failed")
    .filter(([, status]) => {
      const identity = status.peerPublicKey;
      // A release older than the identity-keyed status records none. With
      // nothing to match on, ask the weaker question the room can still
      // answer: is anything here working? If it is, a failure banner over it
      // is the stale case; if nothing is, the failure is the only explanation
      // the user has, and hiding it is the bug this exists to remove.
      if (identity === undefined) return authenticatedIdentities.size === 0;
      return !authenticatedIdentities.has(identity);
    })
    .map(([peerId, status]) => ({ peerId, status }));
};

/** One banner, so pick the failure the user can most usefully act on. */
export const worstHandshakeFailure = (
  failures: readonly HandshakeFailure[],
): HandshakeFailure | undefined =>
  [...failures].sort(
    (a, b) =>
      rank(a.status) - rank(b.status) || a.peerId.localeCompare(b.peerId),
  )[0];

export interface HandshakeRetry {
  /** Whether re-entering the PIN could plausibly fix this failure. */
  offered: boolean;
  /** Epoch ms before which a throttled retry cannot succeed. */
  waitUntil: number | undefined;
}

/**
 * Whether the user can do anything about a failure, and when.
 *
 * Only the PIN is the user's to change. A room policy is fixed when the room
 * is created, and a transport drop is re-dialled by the library on its own, so
 * offering "try again" for either would be a button that does nothing. A
 * throttled PIN is retriable, but not yet: the library rate-limits attempts
 * per peer identity, so the retry is offered and held until the deadline
 * rather than fired into a guaranteed rejection.
 */
export const handshakeRetry = (
  status: PeerHandshakeStatus,
  now: number,
): HandshakeRetry => {
  if (status.reason !== "pin-mismatch" && status.reason !== "pin-throttled")
    return { offered: false, waitUntil: undefined };

  const retryAfter = status.retryAfter;
  return {
    offered: true,
    waitUntil:
      retryAfter !== undefined && retryAfter > now ? retryAfter : undefined,
  };
};
