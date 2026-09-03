import p2party from "./sdk";

import type {
  CreatedRecoverableIdentity,
  CreateRecoverableIdentityOptions,
  IdentityBackupStatus,
  IdentityDerivation,
  MnemonicValidation,
  RestoredIdentity,
} from "p2party";

/**
 * The identity backup and restore surface, adapted for the app.
 *
 * The vendored build ships this API and declares it, so nothing here describes
 * it a second time: `IdentityBackupApi` is a `Pick` of the SDK object's own
 * type, and every type a dialog names is re-exported straight from `p2party`.
 * A rename or a changed signature in the library is now a compile error in this
 * file, which is the entire reason to import them. What this module carried
 * before was a hand-written copy behind `Partial<>`, and a `Partial<>` of names
 * nobody cross-checks compiles against any build at all — including one that
 * never had the API.
 *
 * The runtime check stays. Declarations and code are two separate files in the
 * same tarball: `lib/index.d.ts` promises a call, `lib/index.js` has to export
 * it, and only the second one runs. If a build ever ships one without the
 * other, every call site fails with a sentence naming the missing function
 * instead of "undefined is not a function", and `identityBackupIsAvailable`
 * lets the menus decline to offer a button that cannot work.
 */

export type {
  CreatedRecoverableIdentity,
  CreateRecoverableIdentityOptions,
  IdentityBackupStatus,
  IdentityDerivation,
  MnemonicValidation,
  RestoredIdentity,
};

/**
 * The four calls this module adapts, named once and typed from the SDK object
 * itself. `Pick` is the cross-check: drop or rename one in the library and this
 * line stops compiling.
 */
type IdentityBackupApi = Pick<
  typeof p2party,
  | "createRecoverableIdentity"
  | "restoreIdentityFromMnemonic"
  | "getIdentityBackupStatus"
  | "validateMnemonicWords"
>;

/** The SDK, narrowed to the calls this module is about. */
const sdk: IdentityBackupApi = p2party;

const IDENTITY_BACKUP_CALLS = [
  "createRecoverableIdentity",
  "restoreIdentityFromMnemonic",
  "getIdentityBackupStatus",
  "validateMnemonicWords",
] as const satisfies readonly (keyof IdentityBackupApi)[];

/**
 * Resolve one call, at call time rather than at import time, so a build that
 * ships the API is picked up even when this module was evaluated first.
 */
const identityBackupCall = <K extends keyof IdentityBackupApi>(
  name: K,
): IdentityBackupApi[K] => {
  const call = sdk[name];
  if (typeof call !== "function")
    throw new Error(
      `SDK build without identity backup: p2party.${name} is missing. Vendor a p2party release that ships the identity backup API.`,
    );

  return call;
};

/**
 * Whether the vendored build can back up and restore identities at all.
 *
 * UI that would otherwise offer a dead button should ask first; every call
 * below still fails loudly on its own, so this is a convenience, not a guard.
 */
export const identityBackupIsAvailable = (): boolean =>
  IDENTITY_BACKUP_CALLS.every((name) => typeof sdk[name] === "function");

/**
 * Check a phrase's words without hashing it: length, and membership of the
 * wordlist. Cheap enough to run on every keystroke.
 *
 * The `reason` it hands back quotes the offending word and its position (`Word
 * 3, "zzz", is not in the wordlist.`), so it is part of the user's phrase:
 * render it beside the input and put it nowhere else — never `console.*`,
 * telemetry or a crash report.
 */
export const validateMnemonicWords = (words: string): MnemonicValidation =>
  identityBackupCall("validateMnemonicWords")(words);

/**
 * The current identity, and whether a recovery phrase can reproduce it.
 *
 * An identity created before this feature existed reports `null`, not
 * `"random"` — nothing recorded its provenance — and it is the common case for
 * every user this feature exists for. Either way it cannot be exported, only
 * replaced. `publicKey` is empty when there is no identity at all, which is how
 * "not created yet" is told apart from "created, unrecoverable".
 */
export const getIdentityBackupStatus =
  async (): Promise<IdentityBackupStatus> =>
    await identityBackupCall("getIdentityBackupStatus")();

/**
 * Whether a recovery phrase can reproduce the identity a status describes.
 *
 * The one place the three-valued `derivation` is collapsed, so no caller has to
 * remember that `null` and `"random"` mean the same thing. A dialog keyed on
 * `derivation === "random"` would hide the offer to switch to a recoverable
 * identity from every identity that predates the feature.
 */
export const identityIsRecoverable = (status: IdentityBackupStatus): boolean =>
  status.derivation === "mnemonic";

/**
 * Replace the current identity with a fresh recoverable one and return the
 * phrase that restores it. Signaling is left disconnected; reconnect after.
 */
export const createRecoverableIdentity = async (
  options?: CreateRecoverableIdentityOptions,
): Promise<CreatedRecoverableIdentity> =>
  await identityBackupCall("createRecoverableIdentity")(options);

/**
 * Adopt the identity a phrase encodes, in place of the current one. An invalid
 * phrase rejects before anything is disconnected, so a typo costs nothing.
 * Signaling is left disconnected; reconnect after.
 */
export const restoreIdentityFromMnemonic = async (
  mnemonic: string,
  password?: string,
): Promise<RestoredIdentity> =>
  await identityBackupCall("restoreIdentityFromMnemonic")(mnemonic, password);

/**
 * What to show for a bad phrase anywhere the error's own message must not go.
 *
 * It quotes nothing, so it is safe in a toast, a log line or a report; the
 * message that names the word stays in the form field.
 */
export const INVALID_RECOVERY_PHRASE_MESSAGE =
  "That recovery phrase is not valid.";

/**
 * Whether a rejection was a bad phrase rather than a storage or transport
 * failure — the difference between keeping the user in the form and telling
 * them something broke.
 *
 * Matched by name rather than by `instanceof`: the library's
 * `InvalidRecoveryPhraseError` class is not in every build the app may be
 * vendoring — 0.14.5, the release before this one, does not export it — so a
 * check written against the import would not survive a rollback.
 *
 * The matched error's `message` is the validation reason, which quotes a word
 * of the user's phrase and its position (`Word 3, "zzz", is not in the
 * wordlist.`). It is secret material: show it in the form field next to the
 * input and nowhere else — never `console.*`, telemetry or a crash report. Any
 * path that reports generically uses `INVALID_RECOVERY_PHRASE_MESSAGE`, so the
 * raw reason keeps a single destination.
 */
export const isInvalidRecoveryPhraseError = (error: unknown): boolean =>
  error instanceof Error && error.name === "InvalidRecoveryPhraseError";
