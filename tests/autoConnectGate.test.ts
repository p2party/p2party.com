import { describe, expect, test } from "bun:test";

import {
  shouldAutoConnect,
  shouldReleaseAutoConnectAttempt,
} from "../src/lib/autoConnectGate";

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
