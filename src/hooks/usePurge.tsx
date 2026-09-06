import { useCallback, useRef, useState } from "react";

import p2party from "../protocol/sdk";
import { purgeFailed, purgeSucceeded } from "../protocol/purgeOutcome";

import type { PurgeOutcome, PurgeTarget } from "../protocol/purgeOutcome";

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
          if (target === "identity") await p2party.purgeIdentity();
          else if (target === "everything") await p2party.purge();
          else if (roomUrl !== undefined) await p2party.purgeRoom(roomUrl);
          // The row is only offered while a room is open, so this guards a
          // future caller rather than a reachable state. It reports instead of
          // throwing into a discarded promise, which is the whole point here:
          // purgeRoom("") rejects on the capability before touching anything.
          else throw new Error("There is no room open in this tab to purge.");

          setOutcome(purgeSucceeded(target));
        } catch (cause) {
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
