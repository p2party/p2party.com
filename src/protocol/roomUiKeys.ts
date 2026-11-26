import p2party from "./sdk";
import {
  CONNECT_DIALOG_DISMISSED,
  CONNECT_DIALOG_OPEN,
  ROOM_UI_KEY_PREFIXES,
  migrateLegacyRoomUiKeys,
  roomUiTagFromCapability,
  roomlessRoomUiKey,
  taggedRoomUiKey,
} from "./roomUiStorage";

import type { RoomUiKeyPrefix } from "./roomUiStorage";

/**
 * The per-room UI keys as the room pages name them.
 *
 * roomUiStorage owns the spelling, the tag and the startup scrub, and stays
 * free of the SDK so the app entry can run it on every route. This module adds
 * what needs the SDK: decoding a capability in any spelling the library
 * accepts, so every spelling of one room names the same keys.
 */

/** The tag for a capability in any spelling the library accepts; throws otherwise. */
export const roomUiTag = (roomUrl: string): string => {
  const capability = p2party.decodeRoomCapability(roomUrl);
  try {
    return roomUiTagFromCapability(capability);
  } finally {
    capability.fill(0);
  }
};

const tryRoomUiTag = (roomUrl: string): string | undefined => {
  try {
    return roomUiTag(roomUrl);
  } catch {
    return undefined;
  }
};

/**
 * Anything that is not a capability names no room, so it shares the room-less
 * bucket rather than throwing inside a render.
 */
const roomUiKey = (
  prefix: RoomUiKeyPrefix,
  roomUrl: string | undefined,
): string => {
  const tag = roomUrl === undefined ? undefined : tryRoomUiTag(roomUrl);
  return tag === undefined
    ? roomlessRoomUiKey(prefix)
    : taggedRoomUiKey(prefix, tag);
};

/** Whether the join dialog is open in this room. */
export const connectDialogOpenKey = (roomUrl: string | undefined): string =>
  roomUiKey(CONNECT_DIALOG_OPEN, roomUrl);

/** Whether the user dismissed the join dialog in this room. */
export const connectDialogDismissedKey = (
  roomUrl: string | undefined,
): string => roomUiKey(CONNECT_DIALOG_DISMISSED, roomUrl);

/**
 * Remove one room's UI state.
 *
 * Legacy keys are scrubbed first -- a tab still on an older build may have
 * written this room's capability since startup -- then the room's tagged keys
 * go. A value that is not a capability names no room and removes nothing more.
 */
export const forgetRoomUiState = (storage: Storage, roomUrl: string): void => {
  migrateLegacyRoomUiKeys(storage);
  const tag = tryRoomUiTag(roomUrl);
  if (tag === undefined) return;
  for (const prefix of ROOM_UI_KEY_PREFIXES)
    storage.removeItem(taggedRoomUiKey(prefix, tag));
};
