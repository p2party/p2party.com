import { describe, expect, test } from "bun:test";

import { advanceAutoConnectAttempt } from "../src/lib/autoConnectGate";
import type { AutoConnectGateInput } from "../src/lib/autoConnectGate";

const ROOM = "ab".repeat(32);
const OTHER_ROOM = "cd".repeat(32);
const base: AutoConnectGateInput = {
  roomUrl: ROOM,
  roomInviteErrorLength: 0,
  pinRequired: false,
  hasPin: false,
  pressedCancelInConnect: false,
  alertIsOpen: false,
  isConnected: false,
  isEstablishingConnection: false,
  attemptedRoomUrl: null,
};

// This is the actual transition used by ChatLayout, exercised across socket
// lifetimes. The SDK alone decides whether a disconnect may be retried.
const step = (
  attemptedRoomUrl: string | null,
  flags: Partial<AutoConnectGateInput> = {},
) => advanceAutoConnectAttempt({ ...base, ...flags, attemptedRoomUrl });

describe("room admission and SDK reconnect ownership", () => {
  test("a fresh room or a reloaded page admits exactly once", () => {
    const first = step(null);
    expect(first).toEqual({ attemptedRoomUrl: ROOM, shouldConnect: true });
    expect(step(first.attemptedRoomUrl).shouldConnect).toBe(false);
    // A reload creates a new layout/ref; remembered consent still permits join.
    expect(step(null).shouldConnect).toBe(true);
  });

  test("a terminal 1008 eviction cannot turn two tabs into competing reconnectors", () => {
    let attempt = step(null).attemptedRoomUrl;
    attempt = step(attempt, { isConnected: true }).attemptedRoomUrl;
    for (let render = 0; render < 20; render++) {
      const afterEviction = step(attempt);
      expect(afterEviction.shouldConnect).toBe(false);
      attempt = afterEviction.attemptedRoomUrl;
    }
  });

  test("the first manual Connect also latches ownership before its socket drops", () => {
    const manualAttempt = step(null, { isEstablishingConnection: true });
    expect(manualAttempt).toEqual({
      attemptedRoomUrl: ROOM,
      shouldConnect: false,
    });
    expect(step(manualAttempt.attemptedRoomUrl).shouldConnect).toBe(false);
    const alreadyConnected = step(null, { isConnected: true });
    expect(step(alreadyConnected.attemptedRoomUrl).shouldConnect).toBe(false);
  });

  test("transient failures leave every reconnect delay and retry to the SDK", () => {
    let attempt = step(null).attemptedRoomUrl;
    for (const isEstablishingConnection of [
      true,
      false,
      true,
      false,
      true,
      false,
    ]) {
      const next = step(attempt, { isEstablishingConnection });
      expect(next.shouldConnect).toBe(false);
      expect(next.attemptedRoomUrl).toBe(ROOM);
      attempt = next.attemptedRoomUrl;
    }
    expect(step(attempt, { isConnected: true }).shouldConnect).toBe(false);
  });

  test("a deliberate retry dialog releases admission while preventing an automatic join", () => {
    const dialog = step(ROOM, { alertIsOpen: true });
    expect(dialog).toEqual({ attemptedRoomUrl: null, shouldConnect: false });
    expect(step(dialog.attemptedRoomUrl).shouldConnect).toBe(true);
    const dismissed = step(ROOM, { pressedCancelInConnect: true });
    expect(dismissed).toEqual({ attemptedRoomUrl: null, shouldConnect: false });
  });

  test("opening a different room does not inherit the prior room admission", () => {
    expect(step(ROOM, { roomUrl: OTHER_ROOM })).toEqual({
      attemptedRoomUrl: OTHER_ROOM,
      shouldConnect: true,
    });
  });

  test("a PIN invitation waits for its PIN", () => {
    expect(step(null, { pinRequired: true }).shouldConnect).toBe(false);
    expect(step(null, { pinRequired: true, hasPin: true }).shouldConnect).toBe(
      true,
    );
  });

  test("missing rooms, rejected invitations and open dialogs never admit", () => {
    for (const flags of [
      { roomUrl: undefined },
      { roomUrl: "" },
      { roomInviteErrorLength: 1 },
      { alertIsOpen: true },
      { pressedCancelInConnect: true },
    ])
      expect(step(null, flags).shouldConnect).toBe(false);
  });
});
