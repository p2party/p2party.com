import { useEffect, useState } from "react";

import { Badge } from "../badge";

import { useRoom } from "../../hooks/useRoom";

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
          "The room PIN you entered does not match the one this room was created with. Open Connect and try again.",
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
 * and — for a throttled PIN — when it can be retried.
 */
const HandshakeStatusBanner = () => {
  const { handshakeStatusByPeer } = useRoom({ subscribeToMessages: false });
  const [now, setNow] = useState(() => Date.now());

  const failures = Object.entries(handshakeStatusByPeer).filter(
    ([, value]) => value.status === "failed",
  );
  const throttled = failures.some(
    ([, value]) => value.reason === "pin-throttled",
  );

  // Only run a timer while a countdown is actually on screen.
  useEffect(() => {
    if (!throttled) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [throttled]);

  if (failures.length === 0) return null;

  // One banner: report the most actionable failure rather than one per peer.
  const priority = ["pin-throttled", "pin-mismatch", "policy", "transport"];
  const [, worst] = failures.sort(
    (a, b) =>
      priority.indexOf(a[1].reason ?? "transport") -
      priority.indexOf(b[1].reason ?? "transport"),
  )[0];
  const { text, detail } = describe(worst, now);

  return (
    <div className='fixed top-16 right-0 left-0 z-50 mx-auto flex w-auto max-w-sm flex-col items-center gap-1 px-3 pb-4 lg:left-64'>
      <Badge
        color='red'
        className='min-h-11 w-full items-center justify-center px-4 py-2 text-center text-sm shadow-sm'
        role='status'
      >
        {text}
      </Badge>
      <p className='rounded bg-white/95 px-3 py-1.5 text-center text-xs leading-relaxed text-zinc-600 shadow-sm dark:bg-black/95 dark:text-zinc-400'>
        {detail}
      </p>
    </div>
  );
};

export default HandshakeStatusBanner;
