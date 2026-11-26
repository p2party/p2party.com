import { useCallback, useRef, useState } from "react";

import p2party from "../protocol/sdk";
import { purgeFailed, purgeSucceeded } from "../protocol/purgeOutcome";
import { forgetRoomUiState } from "../protocol/roomUiKeys";
import { forgetAllRoomUiState } from "../protocol/roomUiStorage";

import type { PurgeOutcome, PurgeTarget } from "../protocol/purgeOutcome";

/** The library's three purges, as settlePurge calls them. */
export interface PurgeSteps {
  purgeIdentity: () => Promise<void>;
  purge: () => Promise<void>;
  purgeRoom: (roomUrl: string) => Promise<void>;
}

/**
 * Run one purge to the end and say what it did.
 *
 * The library deletes what it stores. The join dialog's per-room flags are
 * this app's own localStorage keys, so no library purge reaches them: a room
 * purge removes that room's, a full purge removes every room's, and an
 * identity purge, which leaves rooms alone, removes none. That step runs
 * whether or not the library's step succeeded, as every step of a purge is
 * attempted before anything is reported.
 *
 * A failure of that step is a local deletion that did not happen, so it is
 * reported, never swallowed. When the library's step failed too, both are
 * reported together under one error carrying `errors` -- which also voids the
 * narrow "only the server's unlink is unconfirmed" report, as it must, since
 * that report promises every local step finished.
 *
 * `uiStorage` is a function because reading `window.localStorage` itself
 * throws where the browser refuses storage to the page.
 */
export const settlePurge = async (
  target: PurgeTarget,
  roomUrl: string | undefined,
  steps: PurgeSteps,
  uiStorage: () => Storage,
): Promise<PurgeOutcome> => {
  const failures: unknown[] = [];

  try {
    if (target === "identity") await steps.purgeIdentity();
    else if (target === "everything") await steps.purge();
    else if (roomUrl !== undefined) await steps.purgeRoom(roomUrl);
    // The row is only offered while a room is open, so this guards a future
    // caller rather than a reachable state. It reports instead of throwing
    // into a discarded promise, which is the whole point here: purgeRoom("")
    // rejects on the capability before touching anything.
    else throw new Error("There is no room open in this tab to purge.");
  } catch (cause) {
    failures.push(cause);
  }

  try {
    if (target === "everything") forgetAllRoomUiState(uiStorage());
    else if (target === "room" && roomUrl !== undefined)
      forgetRoomUiState(uiStorage(), roomUrl);
  } catch (cause) {
    failures.push(cause);
  }

  if (failures.length === 0) return purgeSucceeded(target);
  return purgeFailed(
    target,
    failures.length === 1
      ? failures[0]
      : Object.assign(new Error("More than one purge step failed."), {
          errors: failures,
        }),
  );
};

export interface PurgeAction {
  /** The purge currently settling, or null. */
  pending: PurgeTarget | null;
  /** What the last purge did, or null before one has settled. */
  outcome: PurgeOutcome | null;
  run: (target: PurgeTarget) => void;
  retry: () => void;
  dismiss: () => void;
}

/**
 * Run a purge and keep what it did.
 *
 * The menus used to hand `purgeIdentity`, `purgeRoom` and `purge` straight to
 * onClick. React discards the promise a handler returns, this app installs no
 * unhandledrejection listener and has no error boundary, so a purge that only
 * half settled reported nothing at all -- and it failed silent in the dangerous
 * direction, because the identity reset and the signaling disconnect happen
 * before the durable deletions are awaited.
 *
 * The SDK is called through protocol/sdk rather than through useRoom: useRoom
 * only re-exports these three functions, and the room chrome that hosts this
 * already subscribes to the store once.
 */
export const usePurge = (roomUrl: string | undefined): PurgeAction => {
  const [pending, setPending] = useState<PurgeTarget | null>(null);
  const [outcome, setOutcome] = useState<PurgeOutcome | null>(null);
  // Read and written synchronously inside one handler, so it is a ref rather
  // than state: a second click must be refused before the next render.
  const inFlight = useRef(false);

  const run = useCallback(
    (target: PurgeTarget) => {
      // Two terminal teardowns racing would report whichever finished last.
      if (inFlight.current) return;
      inFlight.current = true;
      setOutcome(null);
      setPending(target);

      void (async () => {
        try {
          setOutcome(
            await settlePurge(
              target,
              roomUrl,
              p2party,
              () => window.localStorage,
            ),
          );
        } catch (cause) {
          // settlePurge reports every step failure itself; this keeps a
          // future bug in it from becoming a discarded rejection.
          setOutcome(purgeFailed(target, cause));
        } finally {
          setPending(null);
          inFlight.current = false;
        }
      })();
    },
    [roomUrl],
  );

  const retry = useCallback(() => {
    if (outcome !== null) run(outcome.target);
  }, [outcome, run]);

  const dismiss = useCallback(() => {
    // Never while a purge is settling: this report is the only thing watching
    // it, and the row that started it is already gone from the menu.
    if (inFlight.current) return;
    setOutcome(null);
  }, []);

  return { pending, outcome, run, retry, dismiss };
};
