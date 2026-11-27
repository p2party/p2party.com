import { describe, expect, test } from "bun:test";

import {
  purgeCauses,
  purgeFailed,
  purgeSucceeded,
} from "../src/protocol/purgeOutcome";

/**
 * What a purge is allowed to claim.
 *
 * The three purges are fail-closed settlements, so a rejection means "every
 * step was attempted and some did not stick", never "nothing happened". The
 * screen cannot tell the difference: the identity reset and the room delete
 * both land before the durable deletions are awaited, so the app renders as
 * purged either way. Every sentence here therefore has to survive being read
 * next to a screen that already looks successful.
 */

/** The library's shape for "local deletion finished, the server was not told". */
const remoteUnconfirmed = (reason: string): Error & { reason: string } => {
  const error = new Error(
    `Remote room revocation was not confirmed (${reason}).`,
  ) as Error & { reason: string };
  error.name = "RemoteRoomRevocationUnconfirmedError";
  error.reason = reason;
  return error;
};

describe("purge outcomes", () => {
  test("the server's silence does not become 'your data may still be here'", () => {
    const outcome = purgeFailed("room", remoteUnconfirmed("ack-timeout"));

    expect(outcome.tone).toBe("warn");
    expect(outcome.detail[0]).toContain("gone from this device");
    expect(outcome.detail[1]).toContain("did not acknowledge");
    // Purging again cannot send the unlink: the room is already a tombstone.
    expect(outcome.retryable).toBe(false);
    expect(outcome.detail.join(" ")).not.toContain("may still be in this");
  });

  test.each([
    ["no-current-socket", "never asked"],
    ["send-failed", "could not be sent"],
    ["ack-timeout", "two seconds"],
    ["socket-closed", "closed before"],
    ["socket-replaced", "replaced before"],
    ["ingress-rejected", "rejected the unlink"],
  ])("the %s reason gets its own sentence", (reason, expected) => {
    expect(purgeFailed("room", remoteUnconfirmed(reason)).detail[1]).toContain(
      expected,
    );
  });

  test("a reason from a newer build falls back to the error's own words", () => {
    const error = remoteUnconfirmed("reason-from-a-newer-build");

    // Inventing a sentence for an unknown reason would describe something that
    // did not happen, which is worse than quoting the library.
    expect(purgeFailed("room", error).detail[1]).toBe(error.message);
  });

  test("the same error inside an AggregateError is not the narrow case", () => {
    // The room settlement rethrows a lone failure bare and wraps two or more,
    // so finding it wrapped means a LOCAL step failed too and the "only the
    // server was not told" guarantee is void.
    const outcome = purgeFailed(
      "room",
      new AggregateError(
        [remoteUnconfirmed("ack-timeout"), "meta write failed"],
        "Room purge did not fully settle",
      ),
    );

    expect(outcome.tone).toBe("bad");
    expect(outcome.detail.join(" ")).toContain(
      "may still be in this device's storage",
    );
  });

  test("a failed identity purge contradicts the screen", () => {
    const outcome = purgeFailed("identity", new Error("idb write failed"));

    expect(outcome.tone).toBe("bad");
    expect(outcome.retryable).toBe(true);
    expect(outcome.detail[0]).toContain("looks purged");
    expect(outcome.detail[1]).toContain(
      "may still be in this device's storage",
    );
    // The success wording must not appear on a failure path.
    expect(outcome.detail.join(" ")).not.toContain("were deleted from this");
  });

  test("causes survive the shapes the library actually rejects with", () => {
    // The database worker rejects with String(error); RTK Query flattens a
    // queryFn throw into a plain object; the rest are real Errors.
    const lines = purgeCauses(
      new AggregateError(
        [
          "Error: deleting the room failed",
          { name: "Error", message: "teardown timed out", stack: "…" },
          new Error("identity delete failed"),
          undefined,
        ],
        "Purge did not fully settle",
      ),
    );

    expect(lines).toEqual([
      "Error: deleting the room failed",
      "teardown timed out",
      "identity delete failed",
      "A step failed without saying why.",
    ]);
  });

  test("nested AggregateErrors are flattened, not stringified", () => {
    const lines = purgeCauses(
      new AggregateError(
        [new AggregateError([new Error("inner step failed")], "rooms")],
        "everything",
      ),
    );

    expect(lines).toEqual(["inner step failed"]);
    expect(lines.join(" ")).not.toContain("[object Object]");
  });

  test("identical failures are listed once", () => {
    const outcome = purgeFailed(
      "everything",
      new AggregateError(
        [new Error("idb is closing"), new Error("idb is closing")],
        "everything",
      ),
    );

    expect(outcome.causes).toEqual(["idb is closing"]);
  });

  test("success claims only what settled", () => {
    // The repo rule: an untested guarantee does not get printed. A settlement
    // reports that no step threw, which is not "everything is gone".
    expect(purgeSucceeded("identity").detail.join(" ")).toContain(
      "were not touched",
    );
    expect(purgeSucceeded("everything").detail.join(" ")).toContain(
      "address bar",
    );
    expect(purgeSucceeded("room").causes).toEqual([]);
  });
});

test("identity and full purges name the unacknowledged rooms and an incomplete inventory", () => {
  for (const target of ["identity", "everything"] as const) {
    const outcome = purgeSucceeded(target, {
      unacknowledgedRoomIds: ["room-a", "room-b"],
      roomInventoryComplete: false,
    });
    expect(outcome.tone).toBe("warn");
    expect(outcome.detail.join(" ")).toContain("room-a, room-b");
    expect(outcome.detail.join(" ")).toContain(
      "Additional memberships may remain",
    );
    expect(
      purgeSucceeded(target, {
        unacknowledgedRoomIds: [],
        roomInventoryComplete: true,
      }).detail.join(" "),
    ).toContain("acknowledged every requested leave");
    expect(
      purgeFailed(target, new Error("local storage unavailable"), {
        unacknowledgedRoomIds: ["room-b"],
        roomInventoryComplete: true,
      }).detail.join(" "),
    ).toContain("room-b");
    expect(purgeSucceeded(target).detail.join(" ")).toContain(
      "Some room memberships may remain",
    );
  }
});
