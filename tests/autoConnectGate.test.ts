import { describe, expect, test } from "bun:test";

import {
  shouldAutoConnect,
  shouldReleaseAutoConnectAttempt,
} from "../src/lib/autoConnectGate";
import type { AutoConnectGateInput } from "../src/lib/autoConnectGate";

const ROOM = "ab".repeat(32);

const base = {
  roomUrl: ROOM,
  roomInviteErrorLength: 0,
  pinRequired: false,
  hasPin: false,
  pressedCancelInConnect: false,
  alertIsOpen: false,
  isConnected: false,
  isEstablishingConnection: false,
  attemptedRoomUrl: null as string | null,
};

describe("room auto-connect gate", () => {
  test("a fresh room with nothing in the way connects", () => {
    expect(shouldAutoConnect(base)).toBe(true);
  });

  test("an attempt already made for this room does not repeat", () => {
    expect(shouldAutoConnect({ ...base, attemptedRoomUrl: ROOM })).toBe(false);
  });

  test("a PIN room without a PIN waits", () => {
    expect(
      shouldAutoConnect({ ...base, pinRequired: true, hasPin: false }),
    ).toBe(false);
    expect(
      shouldAutoConnect({ ...base, pinRequired: true, hasPin: true }),
    ).toBe(true);
  });

  test("a dismissed dialog, an open alert or an invite error all block", () => {
    expect(shouldAutoConnect({ ...base, pressedCancelInConnect: true })).toBe(
      false,
    );
    expect(shouldAutoConnect({ ...base, alertIsOpen: true })).toBe(false);
    expect(shouldAutoConnect({ ...base, roomInviteErrorLength: 1 })).toBe(
      false,
    );
    expect(shouldAutoConnect({ ...base, roomUrl: undefined })).toBe(false);
  });

  test("a live or establishing socket does not re-connect", () => {
    expect(shouldAutoConnect({ ...base, isConnected: true })).toBe(false);
    expect(shouldAutoConnect({ ...base, isEstablishingConnection: true })).toBe(
      false,
    );
  });

  // C4: the whole point. A socket that dropped after a successful auto-connect
  // must be able to auto-connect again. Without the release the ref stays set
  // to this room forever and a focused desktop tab never reconnects.
  test("a socket that dropped releases the recorded attempt", () => {
    expect(
      shouldReleaseAutoConnectAttempt({
        isConnected: false,
        isEstablishingConnection: false,
        attemptedRoomUrl: ROOM,
      }),
    ).toBe(true);
  });

  test("a released attempt makes the room eligible again", () => {
    const dropped = { ...base, attemptedRoomUrl: ROOM };
    expect(shouldAutoConnect(dropped)).toBe(false);
    expect(shouldReleaseAutoConnectAttempt(dropped)).toBe(true);
    expect(shouldAutoConnect({ ...dropped, attemptedRoomUrl: null })).toBe(
      true,
    );
  });

  test("a live socket, an in-flight attempt, or no recorded attempt release nothing", () => {
    expect(
      shouldReleaseAutoConnectAttempt({
        isConnected: true,
        isEstablishingConnection: false,
        attemptedRoomUrl: ROOM,
      }),
    ).toBe(false);
    expect(
      shouldReleaseAutoConnectAttempt({
        isConnected: false,
        isEstablishingConnection: true,
        attemptedRoomUrl: ROOM,
      }),
    ).toBe(false);
    expect(
      shouldReleaseAutoConnectAttempt({
        isConnected: false,
        isEstablishingConnection: false,
        attemptedRoomUrl: null,
      }),
    ).toBe(false);
  });
});

// C4 review finding: the two predicates above are correct in isolation, but
// ChatLayout originally called them from two separate effects, and React runs
// passive effects in hook-declaration order within one commit. The
// auto-connect effect (declared first) re-ran on the isConnected true->false
// transition and read the ref BEFORE the release effect (declared second) had
// a chance to clear it, so it saw a still-"attempted" ref and skipped
// connect(). The release effect then cleared the ref, but mutating a ref
// schedules no render -- nothing re-ran the auto-connect effect afterward, so
// a bare drop (no other dependency changing) never reconnected. Same
// user-visible bug as before the fix, via a different mechanism.
//
// These two functions model the two orderings ChatLayout's single effect
// could run its statements in, without mounting React (this repo has no
// jsdom/happy-dom/@testing-library/react). They are what let this test tell
// the fixed wiring apart from the one the review caught.
type EffectFlags = Omit<AutoConnectGateInput, "attemptedRoomUrl">;

interface EffectPassResult {
  attemptedRoomUrl: string | null;
  connectCalled: boolean;
}

/** The FIXED wiring: release is read and applied before shouldAutoConnect is
 * evaluated, in the same synchronous pass -- one effect, one commit. */
function runFixedEffectPass(
  attemptedRoomUrl: string | null,
  flags: EffectFlags,
): EffectPassResult {
  let ref = attemptedRoomUrl;

  if (
    shouldReleaseAutoConnectAttempt({
      isConnected: flags.isConnected,
      isEstablishingConnection: flags.isEstablishingConnection,
      attemptedRoomUrl: ref,
    })
  ) {
    ref = null;
  }

  const connectCalled = shouldAutoConnect({ ...flags, attemptedRoomUrl: ref });
  if (connectCalled) ref = flags.roomUrl ?? null;

  return { attemptedRoomUrl: ref, connectCalled };
}

/** The ORIGINAL (buggy) two-effect wiring: the auto-connect effect (declared
 * first) reads the ref and decides BEFORE the release effect (declared
 * second, same commit) has run. */
function runBrokenEffectPass(
  attemptedRoomUrl: string | null,
  flags: EffectFlags,
): EffectPassResult {
  let ref = attemptedRoomUrl;

  // Effect 1 (auto-connect) runs first, reading the still-stale ref.
  const connectCalled = shouldAutoConnect({ ...flags, attemptedRoomUrl: ref });
  if (connectCalled) ref = flags.roomUrl ?? null;

  // Effect 2 (release) runs second in the same commit -- too late to change
  // effect 1's decision this pass.
  if (
    shouldReleaseAutoConnectAttempt({
      isConnected: flags.isConnected,
      isEstablishingConnection: flags.isEstablishingConnection,
      attemptedRoomUrl: ref,
    })
  ) {
    ref = null;
  }

  return { attemptedRoomUrl: ref, connectCalled };
}

describe("auto-connect effect wiring: release must land before the same-pass check (C4)", () => {
  const flagsAfterDrop: EffectFlags = {
    roomUrl: ROOM,
    roomInviteErrorLength: 0,
    pinRequired: false,
    hasPin: false,
    pressedCancelInConnect: false,
    alertIsOpen: false,
    isConnected: false,
    isEstablishingConnection: false,
  };

  test("the fixed single-pass wiring reconnects a socket that dropped silently", () => {
    const result = runFixedEffectPass(ROOM, flagsAfterDrop);
    expect(result.connectCalled).toBe(true);
    expect(result.attemptedRoomUrl).toBe(ROOM);
  });

  // This is the regression the review caught: a test that runs the predicates
  // in the order the original two-effect design actually ran them in. It must
  // fail to connect -- proving the bug was in the wiring, not the predicates,
  // and proving this test is capable of catching that class of bug.
  test("the original two-effect wiring misses the same drop", () => {
    const result = runBrokenEffectPass(ROOM, flagsAfterDrop);
    expect(result.connectCalled).toBe(false);
  });
});
