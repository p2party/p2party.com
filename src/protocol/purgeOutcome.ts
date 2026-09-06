/**
 * What a purge did, in words the settlement can actually back.
 *
 * All three purges are fail-closed settlements: every teardown step is
 * attempted before anything is thrown, so a rejection never means "nothing
 * happened" -- it means "everything was attempted, some of it did not stick".
 * For purgeRoom's remote step it means less again: local state, transports and
 * durable data have already reached their terminal boundary and only the
 * signaling server's acknowledgement is missing.
 *
 * Those are three different sentences to a user, so the classification lives
 * here, in one pure module, rather than in whichever menu ran the call. It is
 * the split handshakeFailures.ts already uses: the mapping is testable, and the
 * component only paints.
 */

export type PurgeTarget = "identity" | "room" | "everything";

/**
 * delivery.ts's vocabulary minus "pending", because a purge has no in-flight
 * caption to write: `good` settled, `warn` deleted locally with the server left
 * unaware, `bad` did not finish. The semantic, not a colour.
 */
export type PurgeTone = "good" | "warn" | "bad";

export interface PurgeOutcome {
  target: PurgeTarget;
  tone: PurgeTone;
  /** One line naming what happened. */
  label: string;
  /** What that means for the data, most load-bearing sentence first. */
  detail: string[];
  /** The library's own words for the steps that failed. Empty on success. */
  causes: string[];
  /** Whether running the same purge again can still change the outcome. */
  retryable: boolean;
}

export const PURGE_TITLES: Record<PurgeTarget, string> = {
  identity: "Purge identity",
  room: "Purge room data",
  everything: "Purge all data",
};

export const PURGE_WORKING: Record<PurgeTarget, string> = {
  identity: "Purging the identity…",
  room: "Purging the room…",
  everything: "Purging everything…",
};

/**
 * Whether the rejection is the narrow one: local deletion finished, and only
 * the server's unlink was left unconfirmed.
 *
 * Matched by name rather than by `instanceof`, for the reason identityBackup.ts
 * gives for InvalidRecoveryPhraseError: the class belongs to a vendored build,
 * and a rollback to one that does not export it would silently turn this check
 * into `false` -- which here would downgrade a truthful partial report into
 * "some of this may still be on your device".
 *
 * Only a TOP-LEVEL rejection carries the guarantee. The room settlement rethrows
 * a lone failure bare and wraps two or more, so the same error found inside an
 * AggregateError means a local step failed too and the guarantee is void. That
 * is why `errors` is not searched for it.
 */
export const isRemoteRoomRevocationUnconfirmed = (
  error: unknown,
): error is Error & { reason?: string } =>
  error instanceof Error &&
  error.name === "RemoteRoomRevocationUnconfirmedError";

/**
 * The library's remote-revocation failure reasons, in words. The union is not
 * exported from the package root, so it is restated here as a lookup with a
 * fallback: an unknown reason from a newer build falls back to the error's own
 * message rather than being reported as something it is not.
 */
const REMOTE_REASONS: Record<string, string> = {
  "no-current-socket":
    "There was no signaling connection to send the unlink on, so the server was never asked.",
  "send-failed": "The unlink could not be sent to the signaling server.",
  "ack-timeout":
    "The unlink was sent, but the server did not acknowledge it within two seconds.",
  "socket-closed":
    "The signaling connection closed before the server acknowledged the unlink.",
  "socket-replaced":
    "The signaling connection was replaced before the server acknowledged the unlink.",
  "ingress-rejected": "The signaling server rejected the unlink request.",
};

/**
 * One line for one failed step.
 *
 * Sub-errors are not Errors. The database worker rejects with `String(error)`,
 * a plain string, and RTK Query flattens anything a queryFn throws through
 * miniSerializeError into `{ name, message, stack, code }` -- so below the top
 * level neither `instanceof Error` nor a nested `errors` array is reliable, and
 * this reads the only field all three shapes agree on.
 */
export const describeCause = (cause: unknown): string => {
  if (typeof cause === "string" && cause.length > 0) return cause;
  if (cause instanceof Error && cause.message.length > 0) return cause.message;
  if (typeof cause === "object" && cause !== null) {
    const message = (cause as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "A step failed without saying why.";
};

/** Depth is bounded because a full purge nests one AggregateError inside another. */
const MAX_CAUSE_DEPTH = 3;

/** Every step failure a rejection carries, flattened to lines. */
export const purgeCauses = (error: unknown, depth = 0): string[] => {
  const nested = (error as { errors?: unknown } | null | undefined)?.errors;
  if (Array.isArray(nested) && depth < MAX_CAUSE_DEPTH)
    return nested.flatMap((cause) => purgeCauses(cause, depth + 1));
  return [describeCause(error)];
};

/**
 * A resolved purge. Each line says what was deleted and what was not, because
 * the settlement only reports that no step threw -- "everything is gone" is a
 * guarantee nothing here verifies.
 */
const SUCCESS_DETAIL: Record<PurgeTarget, string[]> = {
  identity: [
    "The identity key, the X25519 key it signs and the record of how it was derived were deleted from this device, and signaling is disconnected.",
    "Rooms, messages and your address book were not touched. Nothing reconnects on its own: open the room again to come back.",
  ],
  room: [
    "This room's messages, its cached PIN and its WebRTC transports are gone from this device.",
    "The signaling server acknowledged the unlink, or the room was not active on it and had nothing to unlink. Other rooms and the signaling connection were not touched.",
  ],
  everything: [
    "The identity, every room, every message and the local database were deleted, and signaling is disconnected.",
    "The room capability is still in this tab's address bar, so this tab can rejoin that room when it is reloaded or regains focus. Close the tab if that is not what you want.",
  ],
};

const SUCCESS_LABEL: Record<PurgeTarget, string> = {
  identity: "Identity purged",
  room: "Room purged",
  everything: "Everything purged",
};

export const purgeSucceeded = (target: PurgeTarget): PurgeOutcome => ({
  target,
  tone: "good",
  label: SUCCESS_LABEL[target],
  detail: SUCCESS_DETAIL[target],
  causes: [],
  retryable: false,
});

/**
 * A rejected purge.
 *
 * The dangerous case is the identity one: the identity is reset and signaling
 * disconnected before the durable deletions are awaited, so on failure the app
 * already renders as identity-free while the key may still be on disk. The
 * message therefore has to contradict the screen.
 */
export const purgeFailed = (
  target: PurgeTarget,
  error: unknown,
): PurgeOutcome => {
  // The same step can fail in two rooms with the same words; say it once.
  const causes = [...new Set(purgeCauses(error))];

  if (target === "room" && isRemoteRoomRevocationUnconfirmed(error))
    return {
      target,
      tone: "warn",
      label: "Room deleted here, unlinking not confirmed",
      detail: [
        "This room's messages, its cached PIN and its WebRTC transports are gone from this device.",
        (typeof error.reason === "string"
          ? REMOTE_REASONS[error.reason]
          : undefined) ?? error.message,
        "Until the server is told, it may still count this device as a member of that room. This app has already forgotten the room, so purging it again cannot send the unlink.",
      ],
      // The room is a tombstone now -- no id, signalingActive false -- so a
      // second purge skips the remote step entirely and would report success
      // without the server ever hearing.
      causes: [],
      retryable: false,
    };

  if (target === "room")
    return {
      target,
      tone: "bad",
      label: "Room purge did not finish",
      detail: [
        "The room is already gone from this app's state and its transports were closed.",
        "At least one deletion step failed, so some of this room's data may still be in this device's storage.",
        "This app no longer has a handle on that room, so purging the room again would not reach what is left. Purge All Data deletes the whole local database, including that.",
      ],
      causes,
      retryable: false,
    };

  return {
    target,
    tone: "bad",
    label:
      target === "identity"
        ? "Identity purge did not finish"
        : "Purge did not finish",
    detail: [
      "This app has already dropped the identity and disconnected signaling, so the screen looks purged.",
      target === "identity"
        ? "That is not the same as deleted: at least one step failed, so the identity key may still be in this device's storage."
        : "That is not the same as deleted: at least one step failed, so the identity key, rooms or messages may still be in this device's storage.",
      "Trying again re-runs every step from the start.",
    ],
    causes,
    retryable: true,
  };
};
