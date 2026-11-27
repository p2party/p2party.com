import { useCallback, useEffect, useState } from "react";

import { ChevronDownIcon } from "@heroicons/react/16/solid";

import {
  Alert,
  AlertActions,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from "../alert";
import { Button } from "../button";
import { Checkbox, CheckboxField } from "../checkbox";
import { Description, Field, Label } from "../fieldset";
import { Input } from "../input";
import { Text } from "../text";

import { useRoom } from "../../hooks/useRoom";

import type {
  CreatedRecoverableIdentity,
  IdentityBackupStatus,
} from "../../protocol/identityBackup";
import type { Dispatch, SetStateAction } from "react";

export interface IdentityBackupAlertProps {
  isOpen: boolean;
  /**
   * Closing through the dialog's own buttons drops the recovery phrase from
   * memory on the way out. A parent that flips this to `false` behind the
   * dialog's back — a "close everything" path, a route change — does not, so
   * include the open state in this dialog's React key. Remounting
   * guarantees the phrase and the typed password never outlive the panel that
   * showed them, whoever closed it. The cost is the 100ms leave transition,
   * which the remount skips.
   */
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

/**
 * Which panel the dialog is on.
 *
 * `"status"` reports what the current identity is; `"create"` collects the
 * options for a replacement; `"phrase"` is the one and only showing of the
 * phrase that restores it. The phrase is never re-derivable from anything the
 * app keeps, so `"phrase"` is reachable only from a completed creation.
 */
type View = "status" | "create" | "phrase";

/**
 * The same abbreviation the diagnostics panel uses for a peer's key: enough
 * prefix to compare two keys at a glance, short enough to read on a phone.
 */
const abbreviateKey = (publicKey: string): string =>
  publicKey.length > 16 ? `${publicKey.slice(0, 16)}…` : publicKey;

/**
 * Back up the identity on this device, or replace it with one that can be.
 *
 * The library derives an identity from a recovery phrase one way only, so an
 * identity that was not created from a phrase has no phrase to show — there is
 * nothing to export, and the honest offer is a new identity that does have one.
 * That is the whole shape of this dialog: say which of the two this device has,
 * and, either way, make the replacement available with its consequences stated
 * (a new identity key, which every contact who saved the old one will see
 * change).
 *
 * The phrase itself is shown exactly once, on the panel that follows a
 * successful creation. Neither the SDK nor this app writes it anywhere, so
 * closing that panel destroys the only copy that was not written down by hand;
 * the copy says so, and the confirmation checkbox is what gates the way out.
 */
const IdentityBackupAlert = ({
  isOpen,
  setIsOpen,
}: IdentityBackupAlertProps) => {
  const {
    connect,
    createRecoverableIdentity,
    getIdentityBackupStatus,
    identityIsRecoverable,
    isInvalidRecoveryPhraseError,
    keyPair,
    roomUrl,
  } = useRoom({ subscribeToMessages: false });

  const [view, setView] = useState<View>("status");
  const [status, setStatus] = useState<IdentityBackupStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [password, setPassword] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [created, setCreated] = useState<CreatedRecoverableIdentity | null>(
    null,
  );
  const [writtenDown, setWrittenDown] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  // The status is read on every opening rather than once, because another flow
  // can have replaced the identity since the last look. Nothing is cleared here
  // first: closing is what resets the panel, so the effect only ever writes the
  // answer it fetched, and never cascades a render to blank the last one.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    getIdentityBackupStatus()
      .then((value) => {
        if (!cancelled) setStatus(value);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setLoadError(
          cause instanceof Error
            ? cause.message
            : "Could not read the identity stored on this device.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [getIdentityBackupStatus, isOpen]);

  /**
   * Closing drops the phrase from memory along with everything else, which is
   * the point: it is held only for as long as it is on screen. It is also what
   * leaves the panel ready for the next opening, so nothing shown here outlives
   * the identity it described.
   */
  const close = useCallback(() => {
    setIsOpen(false);
    setView("status");
    setStatus(null);
    setLoadError("");
    setPassword("");
    setAdvancedOpen(false);
    setCreated(null);
    setWrittenDown(false);
    setCopyMessage("");
    setError("");
    setIsWorking(false);
  }, [setIsOpen]);

  const handleCreate = async () => {
    setError("");
    setIsWorking(true);
    try {
      const identity = await createRecoverableIdentity({
        strength: 256,
        password: password.length > 0 ? password : undefined,
      });
      setCreated(identity);
      setWrittenDown(false);
      setCopyMessage("");
      setView("phrase");
    } catch (cause) {
      // A rejected phrase here would be one the library generated itself, and
      // the error quotes the offending word — which is a word of a phrase that
      // was about to become an identity. Say nothing of it.
      setError(
        isInvalidRecoveryPhraseError(cause)
          ? "The generated recovery phrase did not pass its own check, so nothing was changed. Try again."
          : cause instanceof Error
            ? cause.message
            : "Could not create a recoverable identity.",
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.mnemonic);
      setCopyMessage(
        "Copied. Paste it somewhere you control, and clear the clipboard afterwards.",
      );
    } catch {
      setCopyMessage(
        "Could not reach the clipboard. Copy the words from the screen.",
      );
    }
  };

  /**
   * Rejoin the room under the identity that has just replaced the old one.
   *
   * Creating the identity disconnects signaling and tears the room's transports
   * down, and nothing in the app brings them back on its own: the layout's
   * auto-connect fires once per room and has already fired, so the only other
   * thing that would reconnect is a window focus or a visibility change the
   * user may never produce. Every way out of the phrase panel therefore runs
   * this, not just the Done button.
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
          ? `The new identity is in place, but rejoining the room failed: ${cause.message}`
          : "The new identity is in place, but rejoining the room failed.",
      );
    } finally {
      setIsWorking(false);
    }
  };

  const recoverable = status !== null && identityIsRecoverable(status);
  const hasIdentity =
    status !== null &&
    (status.publicKey.length > 0 || keyPair.publicKey.length > 0);
  const shownPublicKey =
    created?.publicKey ??
    (keyPair.publicKey.length > 0
      ? keyPair.publicKey
      : (status?.publicKey ?? ""));
  const words =
    created === null
      ? []
      : created.mnemonic.split(/\s+/).filter((word) => word.length > 0);

  const identityChangeNote = (
    <div className='border-2 border-orange-500 bg-orange-50/70 p-3 text-sm text-zinc-950 dark:bg-orange-950/25 dark:text-zinc-100'>
      A new identity means a new identity key. Contacts who saved the current
      one will be told it changed, and will have to verify you again. Rooms,
      messages and your address book stay where they are.
    </div>
  );

  return (
    <Alert
      open={isOpen}
      // Closable from the keyboard and the backdrop, except while a write is in
      // flight: abandoning a creation half-way would swap the identity and take
      // the only copy of its phrase with it.
      //
      // Once a swap has happened -- `created` is set only then -- escaping is
      // still leaving a new identity behind on a connection the swap took
      // down, so this exit rejoins the room too. It does not wait for the
      // result the way Done does: the user asked to be gone, and a rejoin that
      // fails here is picked up by the layout's wake handlers on the next
      // focus.
      onClose={() => {
        if (isWorking) return;
        if (created !== null) void reconnectAfterSwap().catch(() => undefined);
        close();
      }}
      size='xl'
    >
      <AlertTitle>Back up identity</AlertTitle>
      <AlertDescription>
        A recovery phrase is the only way to bring an identity back, on this
        device or any other. It is shown once and stored nowhere.
      </AlertDescription>

      <AlertBody className='space-y-4'>
        <div className='border-2 border-zinc-950 p-3 dark:border-zinc-200'>
          <p className='font-mono text-xs tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400'>
            {view === "phrase" ? "New identity key" : "Current identity key"}
          </p>
          <p className='mt-1 font-mono text-sm break-all text-zinc-950 dark:text-white'>
            {shownPublicKey.length > 0
              ? abbreviateKey(shownPublicKey)
              : "None on this device yet"}
          </p>
        </div>

        {view === "status" && (
          <>
            {loadError.length > 0 && (
              <p
                role='alert'
                className='border-2 border-red-500 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300'
              >
                {loadError}
              </p>
            )}

            {loadError.length === 0 && status === null && (
              <Text>Checking how this identity was created…</Text>
            )}

            {status !== null && recoverable && (
              <>
                {/* No word count here. The library records only that a phrase
                    was used, not how long it was, and a restore accepts any
                    valid length -- so the number would be a guess about the
                    user's own phrase. The phrase panel below states a count
                    because it counts the words it is showing. */}
                <Text>
                  This identity was created from a recovery phrase. That phrase
                  still restores it, here or on another device.
                </Text>
                <Text>
                  The phrase is not kept by this app or by the library, so it
                  cannot be shown again. If you no longer have it written down,
                  create a new recoverable identity and write that phrase down
                  instead.
                </Text>
                {identityChangeNote}
              </>
            )}

            {status !== null && !recoverable && (
              <>
                <Text>
                  {hasIdentity
                    ? "This identity was generated at random on this device. No phrase produces it, so there is nothing to export and no way to move it to another device."
                    : "There is no identity on this device yet. One created from a recovery phrase can be restored later; one generated at random cannot."}
                </Text>
                <Text>
                  {hasIdentity
                    ? "A recoverable identity is generated from a 24-word phrase you write down. You can create one now, in place of the current identity."
                    : "A recoverable identity is generated from a 24-word phrase you write down. You can create one now."}
                </Text>
                {hasIdentity && identityChangeNote}
              </>
            )}
          </>
        )}

        {view === "create" && (
          <>
            <Text>
              A new identity is generated and adopted straight away, and its
              24-word recovery phrase is shown once, on the next screen. Write
              the words down before you close it.
            </Text>
            {hasIdentity && identityChangeNote}

            <div className='border-2 border-zinc-950 dark:border-zinc-200'>
              <button
                type='button'
                aria-expanded={advancedOpen}
                aria-controls='identity-backup-advanced'
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
                id='identity-backup-advanced'
                hidden={!advancedOpen}
                className='border-t-2 border-zinc-950 p-3 dark:border-zinc-200'
              >
                <Field>
                  <Label htmlFor='identity-backup-password'>
                    Recovery password (optional)
                  </Label>
                  <Description>
                    Folded into the phrase when the identity is derived.
                  </Description>
                  <Input
                    id='identity-backup-password'
                    name='identity-backup-password'
                    type='password'
                    autoComplete='new-password'
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                  />
                </Field>
                <p className='mt-3 text-sm text-orange-800 dark:text-orange-300'>
                  The password is never stored and never checked. Restoring with
                  a different one silently produces a different identity, so a
                  forgotten password makes the phrase useless. Leave this empty
                  unless you have somewhere to keep it.
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

        {view === "phrase" && created !== null && (
          <>
            <div className='border-2 border-red-500 bg-red-50 p-3 text-sm dark:bg-red-950/40'>
              <p className='font-semibold text-red-700 dark:text-red-200'>
                Write these {words.length} words down now.
              </p>
              <p className='mt-1 text-red-700 dark:text-red-300'>
                This is the only time they are shown. They are not stored
                anywhere, and they cannot be shown again. Anyone who reads them
                can take over this identity.
              </p>
            </div>

            <ol className='grid grid-cols-3 gap-x-4 gap-y-2 border-2 border-zinc-950 p-3 dark:border-zinc-200'>
              {words.map((word, index) => (
                <li
                  key={`${String(index)}-${word}`}
                  className='flex gap-2 font-mono text-sm'
                >
                  <span className='w-5 shrink-0 text-right text-zinc-500 tabular-nums dark:text-zinc-400'>
                    {index + 1}
                  </span>
                  <span className='break-all text-zinc-950 dark:text-white'>
                    {word}
                  </span>
                </li>
              ))}
            </ol>

            <div className='flex flex-wrap items-center gap-3'>
              <Button outline onClick={handleCopy}>
                Copy
              </Button>
              <p
                aria-live='polite'
                className='text-sm text-zinc-500 dark:text-zinc-400'
              >
                {copyMessage}
              </p>
            </div>

            {password.length > 0 && (
              <Text>
                This identity also needs the password you entered. The phrase
                alone will not restore it.
              </Text>
            )}

            <CheckboxField>
              <Checkbox
                autoFocus
                name='identity-backup-written-down'
                checked={writtenDown}
                onChange={setWrittenDown}
              />
              <Label>I have written these words down.</Label>
            </CheckboxField>

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
        {view === "status" && (
          <>
            {status !== null && (
              <Button
                outline
                onClick={() => {
                  setError("");
                  setView("create");
                }}
              >
                {recoverable
                  ? "Create a new recoverable identity"
                  : "Create a recoverable identity"}
              </Button>
            )}
            <Button autoFocus onClick={close}>
              {status !== null && !recoverable ? "Not now" : "Close"}
            </Button>
          </>
        )}

        {view === "create" && (
          <>
            <Button
              plain
              disabled={isWorking}
              onClick={() => {
                setError("");
                setView("status");
              }}
            >
              Back
            </Button>
            <Button
              autoFocus
              color='orange'
              disabled={isWorking}
              onClick={handleCreate}
            >
              {isWorking ? "Creating…" : "Create recoverable identity"}
            </Button>
          </>
        )}

        {view === "phrase" && (
          <Button disabled={!writtenDown || isWorking} onClick={handleDone}>
            {isWorking ? "Rejoining…" : "Done"}
          </Button>
        )}
      </AlertActions>
    </Alert>
  );
};

export default IdentityBackupAlert;
