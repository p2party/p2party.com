import { sha256 } from "../lib/sha256";

/**
 * The localStorage keys of this app's per-room UI state, and their lifecycle,
 * without the SDK.
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
 * capability.
 *
 * This module must not import the SDK, directly or through anything else: the
 * app entry runs the scrub below on every route, and the SDK is meant to load
 * only on the room routes. roomUiKeys builds on it for the room pages, where
 * the SDK decodes a capability in any spelling.
 *
 * Every key spelling is written here and nowhere else: a call site that built
 * its own key would put the capability back in storage, out of reach of the
 * scrub and the purge.
 */

/** Domain separation for the tag. Never hash anything else under it. */
export const ROOM_UI_TAG_DOMAIN = "p2party.com/ui-room-tag/v1";

const ROOM_UI_TAG_HEX_LENGTH = 32;

export const CONNECT_DIALOG_OPEN = "alertIsOpenInRoom";
export const CONNECT_DIALOG_DISMISSED = "pressedCancelButtonInRoom";

/** Every per-room key starts with one of these, whatever build wrote it. */
export const ROOM_UI_KEY_PREFIXES = [
  CONNECT_DIALOG_OPEN,
  CONNECT_DIALOG_DISMISSED,
] as const;

export type RoomUiKeyPrefix = (typeof ROOM_UI_KEY_PREFIXES)[number];

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

/**
 * The only spelling earlier builds stored: the room's canonical capability,
 * 32 bytes as 64 hex characters (normalizeRoomCapability's output).
 */
const LEGACY_HEX_SUFFIX = /^[0-9a-fA-F]{64}$/u;

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** The tag for a 32-byte capability. */
export const roomUiTagFromCapability = (capability: Uint8Array): string => {
  if (capability.length !== 32)
    throw new Error("A room capability is exactly 32 bytes");
  const domain = new TextEncoder().encode(ROOM_UI_TAG_DOMAIN);
  const input = new Uint8Array(domain.length + capability.length);
  input.set(domain);
  input.set(capability, domain.length);
  try {
    return toHex(sha256(input)).slice(0, ROOM_UI_TAG_HEX_LENGTH);
  } finally {
    input.fill(0);
  }
};

/** The key a room's flag lives under, given the room's tag. */
export const taggedRoomUiKey = (prefix: RoomUiKeyPrefix, tag: string): string =>
  prefix + TAG_SEPARATOR + tag;

/** The key of the bucket shared by renders that have no room. */
export const roomlessRoomUiKey = (prefix: RoomUiKeyPrefix): string =>
  prefix + ROOMLESS_SUFFIX;

/** A snapshot, so removing while walking cannot skip a key. */
const storageKeys = (storage: Storage): string[] => {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null) keys.push(key);
  }
  return keys;
};

const roomUiKeyPrefix = (key: string): RoomUiKeyPrefix | undefined =>
  ROOM_UI_KEY_PREFIXES.find((prefix) => key.startsWith(prefix));

const legacyTag = (suffix: string): string | undefined => {
  if (!LEGACY_HEX_SUFFIX.test(suffix)) return undefined;
  const capability = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1)
    capability[index] = parseInt(suffix.slice(index * 2, index * 2 + 2), 16);
  try {
    return roomUiTagFromCapability(capability);
  } finally {
    capability.fill(0);
  }
};

/**
 * Move every per-room key an earlier build wrote under its capability to the
 * room's tag, and remove the old key.
 *
 * Every prefixed key that is neither the room-less bucket nor a tag is
 * removed. The old key goes first and unconditionally: if the copy cannot be
 * written -- storage full -- the answer is lost and the dialog asks again,
 * which is the cheaper failure than keeping the capability to save a UI flag.
 * Only a 64-hex suffix, the one spelling earlier builds wrote, is carried
 * over; anything else is dropped with no copy. An answer already stored under
 * the tag wins over a legacy one, which can only have come from a tab still
 * running an older build.
 *
 * Throws what the storage throws, so a purge can report it;
 * scrubLegacyRoomUiKeysAtStartup is the variant that cannot throw.
 */
export const migrateLegacyRoomUiKeys = (storage: Storage): void => {
  for (const key of storageKeys(storage)) {
    const prefix = roomUiKeyPrefix(key);
    if (prefix === undefined) continue;
    const suffix = key.slice(prefix.length);
    if (suffix === ROOMLESS_SUFFIX || TAG_SUFFIX.test(suffix)) continue;

    const value = storage.getItem(key);
    storage.removeItem(key);

    const tag = legacyTag(suffix);
    if (tag === undefined || value === null) continue;
    const current = taggedRoomUiKey(prefix, tag);
    if (storage.getItem(current) !== null) continue;
    try {
      storage.setItem(current, value);
    } catch {
      // Storage full: see above.
    }
  }
};

/**
 * The scrub the app entry runs once per page load, on every route, before
 * anything renders.
 *
 * It takes a getter because reading `window.localStorage` itself throws where
 * the browser refuses storage to the page, and it never throws: a page that
 * cannot reach storage has nothing there it could expose, and the next load
 * tries again.
 */
export const scrubLegacyRoomUiKeysAtStartup = (
  getStorage: () => Storage,
): void => {
  try {
    migrateLegacyRoomUiKeys(getStorage());
  } catch {
    // Storage is unavailable to this page.
  }
};

/** Remove every room's UI state, every spelling, and the room-less bucket. */
export const forgetAllRoomUiState = (storage: Storage): void => {
  for (const key of storageKeys(storage))
    if (roomUiKeyPrefix(key) !== undefined) storage.removeItem(key);
};
