import { useEffect, useState } from "react";

import { Badge } from "../badge";
import { Button } from "../button";

import { useConnectDialog } from "../../hooks/useConnectDialog";
import { useRoom } from "../../hooks/useRoom";
import { forgetRoomPin } from "../../protocol/roomAccess";
import {
  handshakeRetry,
  unresolvedHandshakeFailures,
  worstHandshakeFailure,
} from "../../protocol/handshakeFailures";

import type { PeerHandshakeStatus } from "../../protocol/v4";

const countdown = (msRemaining: number): string => {
  const total = Math.max(0, Math.ceil(msRemaining / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, "0")}`;
};

const describe = (
  failure: PeerHandshakeStatus,
  now: number,
): { text: string; detail: string } => {
  switch (failure.reason) {
    case "pin-mismatch":
      return {
        text: "PIN did not match",
        detail:
          "The room PIN you entered does not match the one this room was created with. Try again with the right one.",
      };
    case "pin-throttled": {
      const remaining = (failure.retryAfter ?? 0) - now;
      return {
        text:
          remaining > 0
            ? `Too many PIN attempts — try again in ${countdown(remaining)}`
            : "Too many PIN attempts — you can try again now",
        detail:
          "Repeated PIN failures are rate limited per peer identity to make guessing expensive.",
      };
    }
    case "policy":
      return {
        text: "Room settings do not match",
        detail:
          "This peer's room settings differ from yours — the ML-KEM suite, PIN requirement, or cover schedule. Room settings are fixed when the room is created, so both sides must open the same invitation link.",
      };
    default:
      return {
        text: "Could not reach this peer securely",
        detail:
          "The encrypted channel closed before it was authenticated. This is usually a network drop; reconnecting will retry.",
      };
  }
};

/**
 * connect() resolves at signaling, long before any peer edge is
 * authenticated, so a failed handshake used to look exactly like an empty
 * room. This surfaces the library's per-peer handshake state: what failed,
 * when a throttled PIN can be retried — and, for the failures the user can
 * actually do something about, the way back to the join dialog.
 */
const HandshakeStatusBanner = () => {
  const { handshakeStatusByPeer, peers, roomUrl } = useRoom({
    subscribeToMessages: false,
  });
  const { open: openConnectDialog } = useConnectDialog(roomUrl);
  const [now, setNow] = useState(() => Date.now());

  const failures = unresolvedHandshakeFailures(handshakeStatusByPeer, peers);
  const worst = worstHandshakeFailure(failures);
  const retry = worst
    ? handshakeRetry(worst.status, now)
    : { offered: false, waitUntil: undefined };
  const waiting = retry.waitUntil !== undefined;

  // Only run a timer while a countdown is actually on screen; it is what
  // re-enables the retry the moment the throttle expires.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [waiting]);

  if (!worst) return null;

  const { text, detail } = describe(worst.status, now);

  // The held PIN is the one the room just rejected, so a retry that reuses it
  // is not a retry. Dropping it forces the dialog to ask for a new one; the
  // room policy stays, which is what keeps the PIN field on screen at all.
  const handleRetry = () => {
    if (roomUrl) forgetRoomPin(roomUrl);
    openConnectDialog();
  };

  return (
    <div className='mx-auto flex w-full max-w-sm flex-col items-center gap-1 px-3 py-2'>
      <Badge
        color='red'
        className='shadow-brutal-sm min-h-11 w-full items-center justify-center rounded-none border-2 border-zinc-950 px-4 py-2 text-center font-mono text-xs font-bold tracking-[0.1em] uppercase dark:border-zinc-200'
        role='status'
      >
        {text}
      </Badge>
      <p className='border-2 border-zinc-950 bg-white px-3 py-1.5 text-center text-xs leading-relaxed text-zinc-700 dark:border-zinc-200 dark:bg-black dark:text-zinc-300'>
        {detail}
      </p>
      {retry.offered && (
        <Button
          type='button'
          onClick={handleRetry}
          disabled={waiting}
          className='mt-1 w-full font-mono text-xs font-bold tracking-[0.1em] uppercase'
        >
          {waiting
            ? `Try again in ${countdown((retry.waitUntil ?? 0) - now)}`
            : "Enter the PIN again"}
        </Button>
      )}
    </div>
  );
};

export default HandshakeStatusBanner;
