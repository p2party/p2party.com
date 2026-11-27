import { Alert, AlertActions, AlertBody, AlertTitle } from "../alert";
import { Button } from "../button";
import { Text } from "../text";

import { PURGE_TITLES, PURGE_WORKING } from "../../protocol/purgeOutcome";

import type { PurgeOutcome, PurgeTarget } from "../../protocol/purgeOutcome";
import type { FC } from "react";

export interface PurgeAlertProps {
  pending: PurgeTarget | null;
  outcome: PurgeOutcome | null;
  onRetry: () => void;
  onClose: () => void;
}

/**
 * What a purge did, said out loud.
 *
 * It paints only: the classification is in protocol/purgeOutcome, the run is in
 * hooks/usePurge. It is mounted as a sibling of the menu that starts the work,
 * never inside it -- a Headless UI menu unmounts its panel as it closes and
 * would take this with it -- and it has to exist at all because the rows that
 * start these purges disappear the moment they run: the identity reset empties
 * `keyPair.publicKey` and the room delete empties `roomId`, whether or not the
 * deletion behind them succeeded.
 */
const PurgeAlert: FC<PurgeAlertProps> = ({
  pending,
  outcome,
  onRetry,
  onClose,
}) => {
  const target = pending ?? outcome?.target ?? null;

  return (
    <Alert
      open={target !== null}
      // Closable from the keyboard and the backdrop, except while a purge is
      // settling: leaving then would put the app back where it started, with a
      // terminal teardown running under nothing that reports it.
      onClose={() => {
        if (pending === null) onClose();
      }}
      size='lg'
    >
      <AlertTitle>{target === null ? "" : PURGE_TITLES[target]}</AlertTitle>

      <AlertBody>
        {pending !== null && (
          <>
            <Text>{PURGE_WORKING[pending]}</Text>
            <Text className='mt-2'>
              {pending === "room"
                ? "Closing this room and asking the signaling server to remove its membership."
                : "Waiting up to three seconds for room leaves, then disconnecting and removing local data."}
            </Text>
          </>
        )}

        {pending === null && outcome !== null && (
          <>
            {outcome.tone === "good" && (
              <p
                role='status'
                className='text-sm font-medium text-zinc-950 dark:text-white'
              >
                {outcome.label}
              </p>
            )}

            {outcome.tone === "warn" && (
              <p
                role='alert'
                className='border-2 border-orange-500 bg-orange-50/70 p-3 text-sm text-zinc-950 dark:bg-orange-950/25 dark:text-zinc-100'
              >
                {outcome.label}
              </p>
            )}

            {outcome.tone === "bad" && (
              <p
                role='alert'
                className='border-2 border-red-500 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300'
              >
                {outcome.label}
              </p>
            )}

            {outcome.detail.map((line) => (
              <Text key={line} className='mt-3'>
                {line}
              </Text>
            ))}

            {outcome.causes.length > 0 && (
              <>
                <Text className='mt-3'>What failed:</Text>
                <ul className='mt-1 list-disc space-y-1 pl-5 font-mono text-xs text-zinc-700 dark:text-zinc-300'>
                  {outcome.causes.map((cause) => (
                    <li key={cause}>{cause}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </AlertBody>

      <AlertActions>
        {pending === null && outcome?.retryable === true && (
          <Button color='orange' onClick={onRetry}>
            Try again
          </Button>
        )}
        <Button plain autoFocus disabled={pending !== null} onClick={onClose}>
          Close
        </Button>
      </AlertActions>
    </Alert>
  );
};

export default PurgeAlert;
