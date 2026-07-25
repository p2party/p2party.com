import { memo, useMemo } from "react";

import { XMarkIcon, StopIcon } from "@heroicons/react/20/solid";

import { Button } from "./button";

import type { Message } from "p2party";
import type { MessageTransferHandle, SendMessageResult } from "../protocol/v4";

export type TransferStatus =
  "preparing" | "cancelling" | "delivered" | "partial" | "failed" | "cancelled";

export interface TrackedTransfer {
  handle: MessageTransferHandle;
  label: string;
  status: TransferStatus;
  result?: SendMessageResult;
  error?: string;
}

interface TransferTrayProps {
  messages: Message[];
  transfers: TrackedTransfer[];
  onCancel(transferId: string): void;
  onDismiss(transferId: string): void;
}

const shortPeer = (peerId: string) =>
  peerId.length > 12 ? `${peerId.slice(0, 8)}…` : peerId;

const reasonText = (reason: unknown): string => {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  return "delivery failed";
};

const TransferTray = ({
  messages,
  transfers,
  onCancel,
  onDismiss,
}: TransferTrayProps) => {
  const messagesByTransfer = useMemo(() => {
    const byTransfer = new Map<string, Message>();
    for (const message of messages) {
      if (message.transferId !== undefined) {
        byTransfer.set(message.transferId, message);
      }
    }
    return byTransfer;
  }, [messages]);

  if (transfers.length === 0) return null;

  return (
    <aside
      aria-label='Message transfers'
      aria-live='polite'
      className='fixed right-3 bottom-24 z-40 flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2 lg:right-5 lg:bottom-28'
    >
      {transfers.map((transfer) => {
        const message = messagesByTransfer.get(transfer.handle.transferId);
        const preparationProgress =
          message && message.totalChunks > 0
            ? Math.min(
                100,
                Math.round((message.chunksCreated / message.totalChunks) * 100),
              )
            : 0;
        const isActive =
          transfer.status === "preparing" || transfer.status === "cancelling";

        return (
          <section
            key={transfer.handle.transferId}
            className='rounded-xl border border-zinc-300/90 bg-white/95 p-3 shadow-[4px_4px_0_0_rgba(0,0,0,0.18)] backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-950/95'
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <p className='truncate font-mono text-xs font-bold text-zinc-950 dark:text-white'>
                  {transfer.label}
                </p>
                <p className='mt-0.5 font-mono text-[10px] text-zinc-500 uppercase dark:text-zinc-400'>
                  {transfer.status === "preparing" &&
                    (preparationProgress < 100
                      ? `packing uniform cells · ${preparationProgress}%`
                      : "awaiting authenticated receipts")}
                  {transfer.status === "cancelling" && "cancelling transfer"}
                  {transfer.status === "delivered" && "delivered to all peers"}
                  {transfer.status === "partial" && "partial mesh delivery"}
                  {transfer.status === "failed" && "delivery failed"}
                  {transfer.status === "cancelled" && "cancelled"}
                </p>
              </div>

              {isActive ? (
                <Button
                  plain
                  onClick={() => onCancel(transfer.handle.transferId)}
                  disabled={transfer.status === "cancelling"}
                  aria-label={`Cancel ${transfer.label}`}
                  title='Cancel this message'
                >
                  <StopIcon />
                </Button>
              ) : (
                <Button
                  plain
                  onClick={() => onDismiss(transfer.handle.transferId)}
                  aria-label={`Dismiss ${transfer.label} transfer status`}
                >
                  <XMarkIcon />
                </Button>
              )}
            </div>

            {isActive && (
              <progress
                className='mt-2 h-1.5 w-full accent-orange-500'
                max={100}
                value={preparationProgress}
                aria-label='Local message preparation progress'
              />
            )}

            {transfer.result && (
              <ul className='mt-2 space-y-1 border-t border-zinc-200 pt-2 font-mono text-[11px] dark:border-zinc-800'>
                {transfer.result.outcomes.map((outcome) => (
                  <li
                    key={outcome.peerId}
                    className='flex items-start justify-between gap-3'
                  >
                    <span
                      className='truncate text-zinc-500 dark:text-zinc-400'
                      title={outcome.peerId}
                    >
                      peer {shortPeer(outcome.peerId)}
                    </span>
                    <span
                      className={
                        outcome.status === "delivered"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : outcome.status === "skipped"
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-red-700 dark:text-red-400"
                      }
                    >
                      {outcome.status === "failed"
                        ? `${outcome.phase}: ${reasonText(outcome.reason)}`
                        : outcome.status === "skipped"
                          ? `skipped: ${outcome.reason}`
                          : "delivered"}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {transfer.error && !transfer.result && (
              <p className='mt-2 text-xs text-red-700 dark:text-red-300'>
                {transfer.error}
              </p>
            )}
          </section>
        );
      })}
    </aside>
  );
};

export default memo(TransferTray);
