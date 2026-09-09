import { useEffect, useRef, useState } from "react";

import p2party from "../../protocol/sdk";
import type { PendingMessage } from "p2party";

interface PendingTransfersProps {
  roomId: string;
  channelLabel: string;
  /** Transfers whose original live handle is already shown on a message. */
  liveTransferIds: readonly string[];
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : "Could not update pending transfers";

type RoomError = { roomId: string; message: string } | null;

export default function PendingTransfers({
  roomId,
  channelLabel,
  liveTransferIds,
}: PendingTransfersProps) {
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [readError, setReadError] = useState<RoomError>(null);
  const [actionError, setActionError] = useState<RoomError>(null);
  const [operations, setOperations] = useState(new Map<string, symbol>());
  const currentOperations = useRef(new Map<string, symbol>());
  const [clock, setClock] = useState(Date.now);
  const generation = useRef(0);
  const retryKey = `${roomId}\0retry`;
  const cancelPrefix = `${roomId}\0cancel\0`;
  // Navigation remounts this panel. The SDK's durable sending phase keeps an
  // active retry visible until its attempt settles, including automatic ones.
  const retrying =
    operations.has(retryKey) ||
    pending.some(
      (message) =>
        message.roomId === roomId &&
        message.channelLabel === channelLabel &&
        message.phase === "sending" &&
        !liveTransferIds.includes(message.transferId),
    );
  const cancelling = [...operations.keys()].some((key) =>
    key.startsWith(cancelPrefix),
  );
  const error =
    (actionError?.roomId === roomId ? actionError.message : "") ||
    (readError?.roomId === roomId ? readError.message : "");

  useEffect(() => {
    const current = ++generation.current;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = async () => {
      if (!roomId) {
        setPending([]);
        setReadError(null);
        return;
      }
      try {
        const rows = await p2party.listPendingMessages(roomId);
        if (!cancelled && current === generation.current) {
          setPending(rows);
          setClock(Date.now());
          setReadError(null);
        }
      } catch (cause) {
        if (!cancelled && current === generation.current)
          setReadError({ roomId, message: messageOf(cause) });
      } finally {
        if (!cancelled) timer = setTimeout(() => void update(), 1000);
      }
    };
    void update();
    return () => {
      cancelled = true;
      generation.current = current + 1;
      clearTimeout(timer);
    };
  }, [roomId]);

  const act = async (key: string, operation: () => Promise<unknown>) => {
    if (currentOperations.current.has(key)) return;
    const current = generation.current;
    const token = Symbol(key);
    currentOperations.current.set(key, token);
    setOperations((previous) => new Map(previous).set(key, token));
    setActionError(null);
    try {
      await operation();
      const rows = await p2party.listPendingMessages(roomId);
      if (current === generation.current) setPending(rows);
    } catch (cause) {
      if (current === generation.current)
        setActionError({ roomId, message: messageOf(cause) });
    } finally {
      // Completion belongs to this operation even when the user is viewing a
      // different room. A token prevents an older completion clearing a newer
      // operation's indicator when they revisit the same room.
      if (currentOperations.current.get(key) === token) {
        currentOperations.current.delete(key);
        setOperations((previous) => {
          if (previous.get(key) !== token) return previous;
          const next = new Map(previous);
          next.delete(key);
          return next;
        });
      }
    }
  };

  const rows = pending.filter(
    (message) =>
      message.roomId === roomId &&
      message.channelLabel === channelLabel &&
      !liveTransferIds.includes(message.transferId),
  );
  if (!rows.length && !error) return null;
  return (
    <section
      aria-label='Pending transfers'
      className='max-h-48 shrink-0 overflow-y-auto border-t-2 border-zinc-950 bg-amber-50 px-3 py-2 text-sm dark:border-zinc-200 dark:bg-zinc-900'
    >
      {rows.length > 0 && (
        <div className='mb-2 flex items-center justify-between gap-3'>
          <p className='font-semibold'>Pending transfers</p>
          <button
            type='button'
            disabled={
              retrying ||
              cancelling ||
              !rows.some(
                (message) => message.retryable && message.retryAfter <= clock,
              )
            }
            onClick={() =>
              void act(retryKey, () => p2party.resumePendingMessages(roomId))
            }
            className='border border-current px-2 py-1 font-medium disabled:opacity-50'
          >
            {retrying ? "Retrying…" : "Retry pending transfers"}
          </button>
        </div>
      )}
      <ul className='space-y-2'>
        {rows.map((message) => {
          const cancelKey = `${cancelPrefix}${message.transferId}`;
          const cancellingMessage = operations.has(cancelKey);
          return (
            <li
              key={message.transferId}
              className='flex items-start justify-between gap-3'
            >
              <div className='min-w-0'>
                <p className='truncate font-medium'>
                  {message.filename || "Message"}
                </p>
                <p className='text-xs text-zinc-600 dark:text-zinc-300'>
                  {message.phase === "staging"
                    ? message.retryAfter <= clock
                      ? "Preparation was interrupted. Choose the file again or cancel this transfer."
                      : "Saving for delivery…"
                    : message.phase === "sending"
                      ? "Sending or waiting for the current transfer to finish…"
                      : "Saved on this device. Resumes when the recipients reconnect."}
                </p>
                {message.lastError && (
                  <p className='text-xs'>{message.lastError}</p>
                )}
              </div>
              <button
                type='button'
                disabled={cancellingMessage}
                onClick={() =>
                  void act(cancelKey, () =>
                    p2party.cancelPendingMessage(roomId, message.transferId),
                  )
                }
                className='shrink-0 underline disabled:opacity-50'
                aria-label={`Cancel pending ${message.filename || "message"}`}
              >
                {cancellingMessage ? "Cancelling…" : "Cancel"}
              </button>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role='alert' className='mt-2 text-red-700 dark:text-red-300'>
          {error}
        </p>
      )}
    </section>
  );
}
