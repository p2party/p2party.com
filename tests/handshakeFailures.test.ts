import { describe, expect, test } from "bun:test";

import {
  handshakeRetry,
  unresolvedHandshakeFailures,
  worstHandshakeFailure,
} from "../src/protocol/handshakeFailures";

import type { PeerHandshakeStatus } from "../src/protocol/v4";
import type { Peer } from "p2party";

const JOINER = "aa".repeat(32);
const OTHER = "bb".repeat(32);

const peer = (peerId: string, peerPublicKey: string): Peer => ({
  peerId,
  peerPublicKey,
});

const statuses = (
  entries: Record<string, PeerHandshakeStatus>,
): Record<string, PeerHandshakeStatus> => entries;

describe("which handshake failures are still true", () => {
  test("a failure survives the peerId that produced it", () => {
    // The exact shape of the reported bug: the joiner's PIN did not match, the
    // library tore the edge down, and signaling dropped the peer from the
    // roster. Requiring the failed peerId to still be present hid the only
    // explanation the user was ever going to get.
    const failures = unresolvedHandshakeFailures(
      statuses({
        "peer-1": {
          status: "failed",
          reason: "pin-mismatch",
          peerPublicKey: JOINER,
        },
      }),
      [],
    );

    expect(failures).toEqual([
      {
        peerId: "peer-1",
        status: {
          status: "failed",
          reason: "pin-mismatch",
          peerPublicKey: JOINER,
        },
      },
    ]);
  });

  test("the same identity, authenticated under a new peerId, resolves it", () => {
    // A peer that reconnects arrives under a new peerId, so the old "failed"
    // entry outlives the problem. The banner is fixed over the room header, so
    // a stale entry sat on top of "connected with ..." claiming a working room
    // was broken. The identity is what says the problem is genuinely over.
    const failures = unresolvedHandshakeFailures(
      statuses({
        "peer-1": {
          status: "failed",
          reason: "transport",
          peerPublicKey: JOINER,
        },
        "peer-2": { status: "authenticated", peerPublicKey: JOINER },
      }),
      [peer("peer-2", JOINER)],
    );

    expect(failures).toEqual([]);
  });

  test("another identity being authenticated does not resolve this one", () => {
    const failures = unresolvedHandshakeFailures(
      statuses({
        "peer-1": {
          status: "failed",
          reason: "pin-mismatch",
          peerPublicKey: JOINER,
        },
        "peer-2": { status: "authenticated", peerPublicKey: OTHER },
      }),
      [peer("peer-2", OTHER)],
    );

    expect(failures.map((failure) => failure.peerId)).toEqual(["peer-1"]);
  });

  test("an identity on the roster but not yet authenticated stays failed", () => {
    const failures = unresolvedHandshakeFailures(
      statuses({
        "peer-1": {
          status: "failed",
          reason: "policy",
          peerPublicKey: JOINER,
        },
        "peer-2": { status: "authenticating", peerPublicKey: JOINER },
      }),
      [peer("peer-2", JOINER)],
    );

    expect(failures.map((failure) => failure.peerId)).toEqual(["peer-1"]);
  });

  test("a status with no recorded identity falls back to the room verdict", () => {
    // A release older than the identity-keyed status records no peerPublicKey.
    // There is then nothing to match on, so the weaker question is asked: is
    // anything in this room working? If something is, a failure banner over it
    // is the stale case; if nothing is, the failure is the best explanation
    // available and hiding it is how a wrong PIN became invisible.
    const orphan = statuses({
      "peer-1": { status: "failed", reason: "pin-mismatch" },
    });

    expect(
      unresolvedHandshakeFailures(orphan, []).map((f) => f.peerId),
    ).toEqual(["peer-1"]);
    expect(
      unresolvedHandshakeFailures(
        { ...orphan, "peer-2": { status: "authenticated" } },
        [peer("peer-2", OTHER)],
      ),
    ).toEqual([]);
  });

  test("a peer absent from the roster cannot authenticate away a failure", () => {
    // handshakeStatusByPeer keeps entries the roster has already dropped, so
    // "authenticated" alone is not proof; the peer has to still be here.
    const failures = unresolvedHandshakeFailures(
      statuses({
        "peer-1": {
          status: "failed",
          reason: "pin-mismatch",
          peerPublicKey: JOINER,
        },
        "peer-2": { status: "authenticated", peerPublicKey: JOINER },
      }),
      [],
    );

    expect(failures.map((failure) => failure.peerId)).toEqual(["peer-1"]);
  });
});

describe("which failure the one banner reports", () => {
  test("the most actionable failure wins, deterministically", () => {
    const worst = worstHandshakeFailure([
      {
        peerId: "peer-3",
        status: { status: "failed", reason: "transport" },
      },
      {
        peerId: "peer-1",
        status: { status: "failed", reason: "pin-mismatch" },
      },
      {
        peerId: "peer-2",
        status: { status: "failed", reason: "pin-throttled" },
      },
    ]);

    expect(worst?.status.reason).toBe("pin-throttled");
  });

  test("a failure with no reason sorts last and is still reportable", () => {
    expect(
      worstHandshakeFailure([
        { peerId: "peer-1", status: { status: "failed" } },
      ])?.peerId,
    ).toBe("peer-1");
    expect(worstHandshakeFailure([])).toBeUndefined();
  });
});

describe("which failures the user can act on", () => {
  test("only a PIN failure offers a retry, and a throttled one waits", () => {
    const now = 1_753_500_000_000;

    expect(
      handshakeRetry({ status: "failed", reason: "pin-mismatch" }, now),
    ).toEqual({ offered: true, waitUntil: undefined });
    expect(
      handshakeRetry(
        { status: "failed", reason: "pin-throttled", retryAfter: now + 30_000 },
        now,
      ),
    ).toEqual({ offered: true, waitUntil: now + 30_000 });
    // The countdown has run out: the retry is live again, without a reload.
    expect(
      handshakeRetry(
        { status: "failed", reason: "pin-throttled", retryAfter: now - 1 },
        now,
      ),
    ).toEqual({ offered: true, waitUntil: undefined });
    // Re-entering a PIN cannot fix a fixed-at-creation room policy, and a
    // transport drop is re-dialled by the library on its own.
    expect(handshakeRetry({ status: "failed", reason: "policy" }, now)).toEqual(
      { offered: false, waitUntil: undefined },
    );
    expect(
      handshakeRetry({ status: "failed", reason: "transport" }, now),
    ).toEqual({ offered: false, waitUntil: undefined });
  });
});
