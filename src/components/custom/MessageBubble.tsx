import { formatBytes } from "../../utils/formatBytes";

import type { ReactNode } from "react";
import type { DeliverySummary, DeliveryTone } from "../../protocol/delivery";

/**
 * The one definition of what a p2party message looks like.
 *
 * The chat and the landing page's demo were written separately and drifted:
 * the demo painted its own messages `bg-orange-500` while the chat uses the
 * `darkOrange` token, and its received bubbles sat on `dark:bg-zinc-900`
 * against the chat's `dark:bg-zinc-950`. Two oranges and two greys, on the same
 * site, for the same object.
 *
 * The demo's file card was also simply the better design -- an extension
 * badge, the size, and a fill bar -- against a chat bubble that truncated the
 * name at twenty characters in JavaScript, showed a generic grey glyph, and
 * displayed no size at all despite being handed one. So the demo won: this is
 * its design, and the chat renders it too.
 */
export type BubbleTone = "own" | "peer";
export type BubbleSize = "sm" | "md";

const SURFACE: Record<BubbleTone, string> = {
  own: "bg-darkOrange border-zinc-950 text-white dark:border-zinc-200",
  peer: "border-zinc-950 bg-white text-zinc-950 dark:border-zinc-200 dark:bg-zinc-950 dark:text-white",
};

const PADDING: Record<BubbleSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "p-2.5",
};

export interface MessageBubbleProps {
  tone: BubbleTone;
  size?: BubbleSize;
  /** The demo's entry animation. Off in the chat, where messages really arrive. */
  animate?: boolean;
  className?: string;
  children: ReactNode;
}

export const MessageBubble = ({
  tone,
  size = "md",
  animate = false,
  className = "",
  children,
}: MessageBubbleProps) => (
  <div
    className={`relative w-auto max-w-full overflow-hidden border-2 transition-transform ${PADDING[size]} ${SURFACE[tone]} ${animate ? "animate-fade-in" : ""} ${className}`}
  >
    {children}
  </div>
);

/**
 * A file, as a card rather than a bubble.
 *
 * Files stay on a white surface in both directions, which is what the demo
 * does and why its transfer reads at a glance: a filename, a size and a fill
 * bar need contrast that an orange bubble does not give them. Direction is
 * already carried by which side of the conversation the card sits on.
 */
export const FileCard = ({
  filename,
  extension,
  size,
  percentage,
  animate = false,
  compact = false,
}: {
  filename: string;
  extension: string;
  /** Logical message bytes. Omitted while still unknown. */
  size?: number;
  /** 0-100. At 100 the fill bar is dropped: a finished file is just a file. */
  percentage: number;
  animate?: boolean;
  compact?: boolean;
}) => {
  const badge =
    extension.replace(/^\./u, "").slice(0, 4).toUpperCase() || "FILE";
  const done = percentage >= 100;

  return (
    <div
      className={`relative w-auto max-w-full border-2 border-zinc-950 bg-white ${compact ? "p-2" : "p-2.5"} dark:border-zinc-200 dark:bg-zinc-950 ${animate ? "animate-fade-in" : ""}`}
    >
      <div className='flex items-center gap-2'>
        <span
          className={`bg-darkOrange flex ${compact ? "size-8" : "size-9"} shrink-0 items-center justify-center font-mono text-[10px] font-bold text-white`}
          aria-hidden
        >
          {badge}
        </span>
        <span className='min-w-0'>
          <span className='block truncate font-mono text-xs font-bold text-zinc-950 dark:text-white'>
            {filename}
          </span>
          <span className='block font-mono text-[10px] text-zinc-500 dark:text-zinc-400'>
            {size === undefined ? "" : formatBytes(size)}
            {size === undefined || done ? "" : " · "}
            {done ? "" : `${String(Math.round(percentage))}%`}
          </span>
        </span>
      </div>

      {!done && (
        <div className='mt-2 h-1.5 w-full border border-zinc-300 dark:border-zinc-700'>
          <div
            className='bg-darkOrange h-full transition-[width] duration-300 motion-reduce:transition-none'
            style={{
              width: `${String(Math.min(100, Math.max(0, percentage)))}%`,
            }}
          />
        </div>
      )}
    </div>
  );
};

const TONE_TEXT: Record<DeliveryTone, string> = {
  pending: "text-zinc-500 dark:text-zinc-400",
  good: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-red-700 dark:text-red-400",
};

const TONE_DOT: Record<DeliveryTone, string> = {
  pending: "bg-zinc-400 dark:bg-zinc-500",
  good: "bg-emerald-600 dark:bg-emerald-400",
  warn: "bg-amber-600 dark:bg-amber-400",
  bad: "bg-red-600 dark:bg-red-400",
};

/**
 * Delivery state, as a caption on the message it describes.
 *
 * This was a floating card in the corner that outlived the send and had to be
 * dismissed by hand, so the answer to "did that go through?" was nowhere near
 * the thing being asked about. Per-peer detail stays folded away: the summary
 * answers the question, and the breakdown is for the times it does not.
 */
export const DeliveryCaption = ({
  summary,
  align,
  onCancel,
}: {
  summary: DeliverySummary;
  align: BubbleTone;
  onCancel?: () => void;
}) => (
  <div
    className={`mt-0.5 flex flex-col ${align === "own" ? "items-end" : "items-start"}`}
  >
    <div className='flex items-center gap-1.5'>
      <span
        aria-hidden
        className={`size-1.5 shrink-0 ${TONE_DOT[summary.tone]} ${summary.tone === "pending" ? "animate-pulse" : ""}`}
      />
      <span
        className={`font-mono text-[11px] ${TONE_TEXT[summary.tone]}`}
        role='status'
      >
        {summary.label}
      </span>
      {summary.cancellable && onCancel && (
        <button
          type='button'
          onClick={onCancel}
          className='font-mono text-[11px] text-zinc-500 underline decoration-dotted underline-offset-2 hover:text-red-700 dark:text-zinc-400 dark:hover:text-red-400'
        >
          cancel
        </button>
      )}
    </div>

    {summary.detail.length > 1 && (
      <details className='mt-0.5'>
        <summary className='cursor-pointer font-mono text-[10px] text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'>
          per peer
        </summary>
        <ul
          className={`mt-1 space-y-0.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400 ${align === "own" ? "text-right" : "text-left"}`}
        >
          {summary.detail.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    )}
  </div>
);
