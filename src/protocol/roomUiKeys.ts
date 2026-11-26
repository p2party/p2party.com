import p2party from "./sdk";
import { sha256 } from "../lib/sha256";

/**
 * The localStorage keys of this app's per-room UI state, and their lifecycle.
 *
 * The join dialog remembers, per room, whether it is open and whether the user
 * dismissed it. Those keys used to end in the room capability itself, so
 * anyone with the browser profile could list every room it had opened and
 * rejoin them, and no purge removed them. A key now ends in a tag:
 *
 *   tag = first 32 hex characters of
 *         SHA-256(UTF-8 "p2party.com/ui-room-tag/v1" || 32-byte capability)
 *
 * It tells one room's flags from another's and cannot be turned back into the
 * capability. It is computed from the decoded bytes, so every spelling of a
 * room's capability names the same keys.
 *
 * Every key spelling is written here and nowhere else: a call site that built
 * its own key would put the capability back in storage, out of reach of the
 * migration and the purge below.
 */

/** Domain separation for the tag. Never hash anything else under it. */
export const ROOM_UI_TAG_DOMAIN = "p2party.com/ui-room-tag/v1";

const ROOM_UI_TAG_HEX_LENGTH = 32;

const CONNECT_DIALOG_OPEN = "alertIsOpenInRoom";
const CONNECT_DIALOG_DISMISSED = "pressedCancelButtonInRoom";

/** Every per-room key starts with one of these, whatever build wrote it. */
const ROOM_UI_KEY_PREFIXES = [CONNECT_DIALOG_OPEN, CONNECT_DIALOG_DISMISSED];

/**
 * The suffix of the single bucket shared by every render that has no room.
 * The layout renders before an invite fragment resolves, and earlier builds
 * stringified that `undefined` into the key; this keeps the same bucket. It
 * names no room, so it is not migrated.
 */
const ROOMLESS_SUFFIX = "undefined";

/** Separates a prefix from a tag. Never part of a capability spelling. */
const TAG_SEPARATOR = ":";

const TAG_SUFFIX = new RegExp(
  `^${TAG_SEPARATOR}[0-9a-f]{${String(ROOM_UI_TAG_HEX_LENGTH)}}$`,
  "u",
);

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** The tag for a capability in any spelling the library accepts; throws otherwise. */
export const roomUiTag = (roomUrl: string): string => {
  const capability = p2party.decodeRoomCapability(roomUrl);
  const domain = new TextEncoder().encode(ROOM_UI_TAG_DOMAIN);
  const input = new Uint8Array(domain.length + capability.length);
  input.set(domain);
  input.set(capability, domain.length);
  capability.fill(0);
  try {
    return toHex(sha256(input)).slice(0, ROOM_UI_TAG_HEX_LENGTH);
  } finally {
    input.fill(0);
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
const roomUiKey = (prefix: string, roomUrl: string | undefined): string => {
  const tag = roomUrl === undefined ? undefined : tryRoomUiTag(roomUrl);
  return tag === undefined
    ? prefix + ROOMLESS_SUFFIX
    : prefix + TAG_SEPARATOR + tag;
};

/** Whether the join dialog is open in this room. */
export const connectDialogOpenKey = (roomUrl: string | undefined): string =>
  roomUiKey(CONNECT_DIALOG_OPEN, roomUrl);

/** Whether the user dismissed the join dialog in this room. */
export const connectDialogDismissedKey = (
  roomUrl: string | undefined,
): string => roomUiKey(CONNECT_DIALOG_DISMISSED, roomUrl);

/** A snapshot, so removing while walking cannot skip a key. */
const storageKeys = (storage: Storage): string[] => {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null) keys.push(key);
  }
  return keys;
};

const roomUiKeyPrefix = (key: string): string | undefined =>
  ROOM_UI_KEY_PREFIXES.find((prefix) => key.startsWith(prefix));

/**
 * Move every per-room key an earlier build wrote under its capability to the
 * room's tag, and remove the old key.
 *
 * Run once when the room UI loads, before any of these keys is read. The old
 * key is removed first and unconditionally: if the copy cannot be written --
 * storage full -- the answer is lost and the dialog asks again, which is the
 * cheaper failure than keeping the capability to save a UI flag. A suffix that
 * does not decode as a capability is dropped with no copy. An answer already
 * stored under the tag wins over a legacy one, which can only have come from a
 * tab still running an older build.
 */
export const migrateLegacyRoomUiKeys = (storage: Storage): void => {
  for (const key of storageKeys(storage)) {
    const prefix = roomUiKeyPrefix(key);
    if (prefix === undefined) continue;
    const suffix = key.slice(prefix.length);
    if (suffix === ROOMLESS_SUFFIX || TAG_SUFFIX.test(suffix)) continue;

    const value = storage.getItem(key);
    storage.removeItem(key);

    const tag = tryRoomUiTag(suffix);
    if (tag === undefined || value === null) continue;
    const current = prefix + TAG_SEPARATOR + tag;
    if (storage.getItem(current) !== null) continue;
    try {
      storage.setItem(current, value);
    } catch {
      // Storage full: see above.
    }
  }
};

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
    storage.removeItem(prefix + TAG_SEPARATOR + tag);
};

/** Remove every room's UI state, every spelling, and the room-less bucket. */
export const forgetAllRoomUiState = (storage: Storage): void => {
  for (const key of storageKeys(storage))
    if (roomUiKeyPrefix(key) !== undefined) storage.removeItem(key);
};
