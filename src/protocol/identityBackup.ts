import p2party from "./sdk";

/**
 * The identity backup and restore surface, adapted for the app.
 *
 * The library grew this API after the vendored release was cut, so the app has
 * to compile against a package whose declarations do not mention it yet. Rather
 * than widen the SDK to `any` at every call site — which would silently survive
 * a rename and fail in the browser — the surface is declared once here and the
 * SDK object is treated as *possibly* implementing it. Every call then goes
 * through one runtime check, so a build without the API fails with a sentence
 * that says which function is missing instead of "undefined is not a function".
 *
 * That runtime check is all the pattern buys, and the claim is deliberately
 * that narrow: `Partial<>` keeps every name optional, so a rename in the
 * library still compiles here, and the assertion inside `identityBackupCall`
 * keeps function types mutually comparable, so an added parameter or a changed
 * result compiles too. The declarations below are a stand-in for the package's,
 * not a cross-check against them.
 *
 * The re-vendor is where drift has to be caught. When a build that ships this
 * API is vendored, delete `IdentityBackupApi` and the local `RestoredIdentity`,
 * `CreatedRecoverableIdentity`, `CreateRecoverableIdentityOptions`,
 * `IdentityBackupStatus` and `MnemonicValidation` declarations in favour of the
 * package's own exports: importing them is the only change that turns a
 * mismatch into a compile error instead of a browser one.
 */

/** How the identity in use came into being, per the library's stored flag. */
export type IdentityDerivation = "random" | "mnemonic";

/** A phrase check reported in a shape a form can render directly. */
export interface MnemonicValidation {
  ok: boolean;
  /**
   * Quotes the offending word and its position (`Word 3, "zzz", is not in the
   * wordlist.`), so it is part of the user's phrase: render it beside the
   * input and put it nowhere else — never `console.*`, telemetry or a crash
   * report.
   */
  reason?: string;
}

/** What a restore hands back: the account key, and nothing more identifying. */
export interface RestoredIdentity {
  publicKey: string;
}

export interface CreatedRecoverableIdentity extends RestoredIdentity {
  /**
   * Shown to the user exactly once. Neither the SDK nor the app stores it, by
   * design, so a caller that drops it before the user has written it down has
   * destroyed the only backup of that identity.
   */
  mnemonic: string;
}

export interface CreateRecoverableIdentityOptions {
  /** Entropy bits: 128 gives a 12-word phrase, 256 a 24-word one. */
  strength?: 128 | 256;
  /**
   * Folded into the derivation. It is never stored and never checked, so
   * restoring with a different password yields a different identity.
   */
  password?: string;
}

/** The current account key, and whether a phrase can reproduce it. */
export interface IdentityBackupStatus {
  /** Empty when no identity is stored at all. */
  publicKey: string;
  /**
   * `"mnemonic"` only for a key derived from a recovery phrase. `"random"` and
   * `null` both mean the same thing to a caller — no backup exists — where
   * `null` covers no identity stored yet, provenance never recorded (which is
   * every identity created before this feature: the library writes the flag
   * only on the branches that mint a key), and a record that no longer binds
   * to the stored key. Ask `identityIsRecoverable` instead of comparing this.
   */
  derivation: IdentityDerivation | null;
}

interface IdentityBackupApi {
  createRecoverableIdentity: (
    options?: CreateRecoverableIdentityOptions,
  ) => Promise<CreatedRecoverableIdentity>;
  restoreIdentityFromMnemonic: (
    mnemonic: string,
    password?: string,
  ) => Promise<RestoredIdentity>;
  getIdentityBackupStatus: () => Promise<IdentityBackupStatus>;
  validateMnemonicWords: (words: string) => MnemonicValidation;
}

/**
 * The SDK as it may be: the vendored declarations, plus the identity-backup
 * calls when the build in use has them.
 */
const sdk = p2party as typeof p2party & Partial<IdentityBackupApi>;

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

  return call as IdentityBackupApi[K];
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
 * Matched by name: the library's `InvalidRecoveryPhraseError` class is not in
 * every build the app may be vendoring, and `instanceof` against an import the
 * build does not export cannot be written at all.
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
