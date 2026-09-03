import { describe, expect, test } from "bun:test";

import {
  connectDialogDismissedKey,
  connectDialogOpenKey,
} from "../src/hooks/useConnectDialog";

describe("join dialog state keys", () => {
  // These name values that are already sitting in users' browsers. Moving the
  // dialog's open/dismissed flags behind a hook must not rename them, or every
  // room someone had dismissed re-opens its join dialog on the next visit.
  const roomUrl = "ab".repeat(32);

  test("keeps the spelling the layout wrote them under", () => {
    expect(connectDialogOpenKey(roomUrl)).toBe("alertIsOpenInRoom" + roomUrl);
    expect(connectDialogDismissedKey(roomUrl)).toBe(
      "pressedCancelButtonInRoom" + roomUrl,
    );
  });

  test("a room-less route keeps its single shared bucket", () => {
    // The layout renders before an invite fragment resolves, so the key was
    // built from `undefined` and JavaScript stringified it. Same bucket.
    expect(connectDialogOpenKey(undefined)).toBe("alertIsOpenInRoomundefined");
    expect(connectDialogDismissedKey(undefined)).toBe(
      "pressedCancelButtonInRoomundefined",
    );
  });
});
