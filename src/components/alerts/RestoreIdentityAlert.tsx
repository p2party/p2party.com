import { useCallback, useMemo, useState } from "react";

import { ChevronDownIcon } from "@heroicons/react/16/solid";

import {
  Alert,
  AlertActions,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from "../alert";
import { Button } from "../button";
import { Description, ErrorMessage, Field, Label } from "../fieldset";
import { Input } from "../input";
import { Text } from "../text";
import { Textarea } from "../textarea";

import { useRoom } from "../../hooks/useRoom";
import { INVALID_RECOVERY_PHRASE_MESSAGE } from "../../protocol/identityBackup";

import type {
  MnemonicValidation,
  RestoredIdentity,
} from "../../protocol/identityBackup";
import type { Dispatch, SetStateAction } from "react";

export interface RestoreIdentityAlertProps {
  isOpen: boolean;
  /**
   * Closing through the dialog's own buttons drops the typed phrase from
   * memory on the way out. A parent that flips this to `false` behind the
   * dialog's back — a "close everything" path, a route change — does not, so
   * mount this component under `key={String(isOpen)}`: the remount is what
   * guarantees the recovery phrase and the password never outlive the panel
   * they were typed into, whoever closed it. The cost is the 100ms leave
   * transition, which the remount skips.
   */
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

/**
 * The same abbreviation the backup dialog and the diagnostics panel use: enough
 * prefix to compare two keys at a glance, short enough to read on a phone.
 */
const abbreviateKey = (publicKey: string): string =>
  publicKey.length > 16 ? `${publicKey.slice(0, 16)}…` : publicKey;

/**
 * How many words the user has typed, for the counter beside the input.
 *
 * Display only. The canonical form of a phrase — NFKD, whitespace collapsed,
 * trimmed, lowercased — is the library's to define, and it applies it to both
 * the check and the derivation, so a second normaliser here could only drift
 * away from the one that decides which identity a phrase produces.
 */
const countWords = (phrase: string): number =>
  phrase
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

/**
 * Adopt an identity from the recovery phrase that produced it.
 *
 * The phrase is checked as it is typed — length, and every word's membership of
 * the wordlist — so a transcription mistake is named with its position before
 * anything is touched. The checksum is not checked here: it is a SHA-512 over
 * the phrase and only reachable asynchronously, so the library verifies it
 * inside the restore, and its verdict lands in the same place beside the input.
 * Either way an invalid phrase costs nothing: the library rejects it before it
 * disconnects anything.
 *
 * A restore is a replacement, not a merge. Whatever identity this device holds
 * is gone afterwards, and only a phrase brings one back — so an identity that
 * was generated at random cannot be recovered once this succeeds. The warning
 * says so, and it says so before the button, not after it.
 *
 * The phrase is held for exactly as long as it is on screen. Neither this app
 * nor the SDK writes it anywhere; closing clears it, and remounting on every
 * open and close is what makes that true for the ways out that are not this
 * dialog's own buttons.
 */
const RestoreIdentityAlert = ({
  isOpen,
  setIsOpen,
}: RestoreIdentityAlertProps) => {
  const {
    connect,
    isInvalidRecoveryPhraseError,
    keyPair,
    restoreIdentityFromMnemonic,
    roomUrl,
    validateMnemonicWords,
  } = useRoom({ subscribeToMessages: false });

  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [rejectedReason, setRejectedReason] = useState("");
  const [restored, setRestored] = useState<RestoredIdentity | null>(null);
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const wordCount = countWords(phrase);

  /**
   * The structural check, on every keystroke.
   *
   * It is cheap — no hashing — but it can throw: the adapter resolves the SDK
   * call at call time and names the missing function when a build without the
   * identity backup API is vendored. A render must not throw for that, so the
   * failure becomes the field's message like any other reason the phrase is
   * unusable.
   */
  const validation = useMemo<MnemonicValidation | null>(() => {
    if (countWords(phrase) === 0) return null;

    try {
      return validateMnemonicWords(phrase);
    } catch (cause) {
      return {
        ok: false,
        reason:
          cause instanceof Error
            ? cause.message
            : "The recovery phrase could not be checked.",
      };
    }
  }, [phrase, validateMnemonicWords]);

  /**
   * What to say beside the input, and nowhere else.
   *
   * A rejected restore wins over the live check, because it is the later and
   * more complete verdict — the checksum, which the live check cannot see. Both
   * quote a word of the user's phrase and its position, which makes them secret
   * material: they belong in this field and never in a log line, a toast or a
   * report.
   */
  const phraseProblem =
    rejectedReason.length > 0
      ? rejectedReason
      : validation !== null && !validation.ok
        ? (validation.reason ?? INVALID_RECOVERY_PHRASE_MESSAGE)
        : "";

  const phraseLooksValid =
    validation?.ok === true && rejectedReason.length === 0;

  /**
   * Closing drops the phrase and the password along with everything else, which
   * is the point: they are held only for as long as they are on screen.
   */
  const close = useCallback(() => {
    setIsOpen(false);
    setPhrase("");
    setPassword("");
    setAdvancedOpen(false);
    setRejectedReason("");
    setRestored(null);
    setError("");
    setIsWorking(false);
  }, [setIsOpen]);

  const handlePhraseChange = (value: string) => {
    setPhrase(value);
    // The rejection described the phrase that was submitted, not this one.
    setRejectedReason("");
    setError("");
  };

  const handleRestore = async () => {
    setError("");
    setRejectedReason("");
    setIsWorking(true);
    try {
      const identity = await restoreIdentityFromMnemonic(
        phrase,
        password.length > 0 ? password : undefined,
      );
      setRestored(identity);
    } catch (cause) {
      // A bad phrase keeps the user in the form with the reason under the
      // input; anything else is a storage or transport failure, and saying so
      // in the form would blame the words they typed.
      if (isInvalidRecoveryPhraseError(cause))
        setRejectedReason(
          cause instanceof Error
            ? cause.message
            : INVALID_RECOVERY_PHRASE_MESSAGE,
        );
      else
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not restore the identity.",
        );
    } finally {
      setIsWorking(false);
    }
  };

  /**
   * Rejoin the room under the identity that has just replaced the old one.
   *
   * A restore disconnects signaling and tears the room's transports down, and
   * nothing in the app brings them back on its own: the layout's auto-connect
   * fires once per room and has already fired, so the only other thing that
   * would reconnect is a window focus or a visibility change the user may never
   * produce. Every way out of the restored panel therefore runs this, not just
   * the Done button.
   */
  const reconnectAfterSwap = useCallback(async () => {
    if (!roomUrl) return;
    await connect(roomUrl);
  }, [connect, roomUrl]);

  /**
   * The identity has already been swapped by the time this runs. Rejoining is
   * the last step, so the user ends up where they started rather than silently
   * offline; a failure keeps the dialog open with the reason on it, and the
   * ways out of it retry.
   */
  const handleDone = async () => {
    setError("");
    if (!roomUrl) {
      close();
      return;
    }

    setIsWorking(true);
    try {
      await reconnectAfterSwap();
      close();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `The restored identity is in place, but rejoining the room failed: ${cause.message}`
          : "The restored identity is in place, but rejoining the room failed.",
      );
    } finally {
      setIsWorking(false);
    }
  };

  const shownPublicKey = restored?.publicKey ?? keyPair.publicKey;

  return (
    <Alert
      open={isOpen}
      // Closable from the keyboard and the backdrop, except while a restore is
      // in flight: abandoning it half-way would leave the swap to finish under
      // a dialog that is no longer watching it.
      //
      // Once a swap has happened -- `restored` is set only then -- escaping is
      // still leaving a new identity behind on a connection the swap took down,
      // so this exit rejoins the room too. It does not wait for the result the
      // way Done does: the user asked to be gone, and a rejoin that fails here
      // is picked up by the layout's wake handlers on the next focus.
      onClose={() => {
        if (isWorking) return;
        if (restored !== null) void reconnectAfterSwap().catch(() => undefined);
        close();
      }}
      size='xl'
    >
      <AlertTitle>Restore identity</AlertTitle>
      <AlertDescription>
        A recovery phrase brings back the identity it was created with, on this
        device or any other. It replaces whatever identity is here now.
      </AlertDescription>

      <AlertBody className='space-y-4'>
        <div className='border-2 border-zinc-950 p-3 dark:border-zinc-200'>
          <p className='font-mono text-xs tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400'>
            {restored !== null
              ? "Restored identity key"
              : "Current identity key"}
          </p>
          <p className='mt-1 font-mono text-sm break-all text-zinc-950 dark:text-white'>
            {shownPublicKey.length > 0
              ? abbreviateKey(shownPublicKey)
              : "None on this device yet"}
          </p>
        </div>

        {restored === null && (
          <>
            <div className='border-2 border-orange-500 bg-orange-50/70 p-3 text-sm text-zinc-950 dark:bg-orange-950/25 dark:text-zinc-100'>
              <p className='font-semibold'>
                Restoring replaces the identity on this device.
              </p>
              <p className='mt-1'>
                Unless the current identity was itself created from a recovery
                phrase, nothing brings it back: it cannot be exported, and this
                is the end of it. Contacts who saved it will be told your
                identity key changed, and will have to verify you again. Rooms,
                messages and your address book stay where they are.
              </p>
            </div>

            <Field>
              <Label>Recovery phrase</Label>
              <Description>
                Between 12 and 48 words, in the order they were given to you.
                Line breaks, extra spaces and capitals do not matter.
              </Description>
              <Textarea
                autoFocus
                name='restore-identity-phrase'
                rows={4}
                resizable={false}
                spellCheck={false}
                autoCapitalize='none'
                autoCorrect='off'
                autoComplete='off'
                invalid={phraseProblem.length > 0}
                value={phrase}
                onChange={(event) => {
                  handlePhraseChange(event.target.value);
                }}
              />
              {/* One live region, mounted whether or not it has anything to
                  say: a region that appears along with its first message is
                  not announced by a screen reader, only its later changes
                  are. Its content is registered with the field either way, so
                  the textarea's aria-describedby follows the message. */}
              <div aria-live='polite' className='mt-3'>
                {phraseProblem.length > 0 && (
                  <ErrorMessage>{phraseProblem}</ErrorMessage>
                )}
                {phraseProblem.length === 0 && phraseLooksValid && (
                  <Description>
                    {wordCount} words, all in the wordlist. The phrase&apos;s
                    own checksum is verified when you restore.
                  </Description>
                )}
              </div>
            </Field>

            <div className='border-2 border-zinc-950 dark:border-zinc-200'>
              <button
                type='button'
                aria-expanded={advancedOpen}
                aria-controls='restore-identity-advanced'
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className='flex w-full items-center justify-between px-3 py-2 font-mono text-xs font-bold tracking-[0.12em] text-zinc-950 uppercase dark:text-white'
              >
                Advanced
                <ChevronDownIcon
                  className={
                    advancedOpen ? "size-4 rotate-180" : "size-4 rotate-0"
                  }
                />
              </button>
              <div
                id='restore-identity-advanced'
                hidden={!advancedOpen}
                className='border-t-2 border-zinc-950 p-3 dark:border-zinc-200'
              >
                <Field>
                  <Label htmlFor='restore-identity-password'>
                    Recovery password (optional)
                  </Label>
                  <Description>
                    Only if one was set when this identity was created.
                  </Description>
                  <Input
                    id='restore-identity-password'
                    name='restore-identity-password'
                    type='password'
                    autoComplete='off'
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                  />
                </Field>
                <p className='mt-3 text-sm text-orange-800 dark:text-orange-300'>
                  The password is never checked, only folded into the
                  derivation. A wrong one does not fail: it silently restores a
                  different identity, with a different key and none of your
                  contacts&apos; trust.
                </p>
              </div>
            </div>

            {error.length > 0 && (
              <p
                role='alert'
                className='border-2 border-red-500 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300'
              >
                {error}
              </p>
            )}
          </>
        )}

        {restored !== null && (
          <>
            <Text>
              This device now uses the identity above. Nothing else changed:
              rooms, messages and your address book are as they were.
            </Text>
            <Text>
              Peers you were talking to see a new identity key and will be asked
              to verify you again — including anyone who had already verified
              the identity this replaced.
            </Text>

            {error.length > 0 && (
              <p
                role='alert'
                className='border-2 border-red-500 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300'
              >
                {error}
              </p>
            )}
          </>
        )}
      </AlertBody>

      <AlertActions>
        {restored === null && (
          <>
            <Button plain disabled={isWorking} onClick={close}>
              Cancel
            </Button>
            <Button
              color='orange'
              disabled={!phraseLooksValid || isWorking}
              onClick={handleRestore}
            >
              {isWorking ? "Restoring…" : "Restore identity"}
            </Button>
          </>
        )}

        {restored !== null && (
          <Button autoFocus disabled={isWorking} onClick={handleDone}>
            {isWorking ? "Rejoining…" : "Done"}
          </Button>
        )}
      </AlertActions>
    </Alert>
  );
};

export default RestoreIdentityAlert;
