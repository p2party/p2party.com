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
 * The card follows the same direction colouring as a text bubble -- orange for
 * what you sent, white for what arrived -- because a file sitting white among
 * orange bubbles read as a different kind of object rather than as one more
 * thing you said. Everything inside it inverts to keep contrast on the orange:
 * the badge flips to a white chip, and the fill bar is drawn in white rather
 * than in an orange that would vanish into its own background.
 */
const CARD_SURFACE: Record<BubbleTone, string> = {
  own: "bg-darkOrange border-zinc-950 dark:border-zinc-200",
  peer: "border-zinc-950 bg-white dark:border-zinc-200 dark:bg-zinc-950",
};

const CARD_BADGE: Record<BubbleTone, string> = {
  own: "bg-white text-darkOrange",
  peer: "bg-darkOrange text-white",
};

const CARD_NAME: Record<BubbleTone, string> = {
  own: "text-white",
  peer: "text-zinc-950 dark:text-white",
};

const CARD_META: Record<BubbleTone, string> = {
  own: "text-white/75",
  peer: "text-zinc-500 dark:text-zinc-400",
};

const CARD_TRACK: Record<BubbleTone, string> = {
  own: "border-white/40",
  peer: "border-zinc-300 dark:border-zinc-700",
};

const CARD_FILL: Record<BubbleTone, string> = {
  own: "bg-white",
  peer: "bg-darkOrange",
};

export const FileCard = ({
  filename,
  extension,
  size,
  percentage,
  tone = "peer",
  animate = false,
  compact = false,
}: {
  filename: string;
  extension: string;
  /** Logical message bytes. Omitted while still unknown. */
  size?: number;
  /** 0-100. At 100 the fill bar is dropped: a finished file is just a file. */
  percentage: number;
  tone?: BubbleTone;
  animate?: boolean;
  compact?: boolean;
}) => {
  const badge =
    extension.replace(/^\./u, "").slice(0, 4).toUpperCase() || "FILE";
  const done = percentage >= 100;

  return (
    <div
      className={`relative w-auto max-w-full border-2 ${CARD_SURFACE[tone]} ${compact ? "p-2" : "p-2.5"} ${animate ? "animate-fade-in" : ""}`}
    >
      <div className='flex items-center gap-2'>
        <span
          className={`flex ${compact ? "size-8" : "size-9"} shrink-0 items-center justify-center font-mono text-[10px] font-bold ${CARD_BADGE[tone]}`}
          aria-hidden
        >
          {badge}
        </span>
        <span className='min-w-0'>
          <span
            className={`block truncate font-mono text-xs font-bold ${CARD_NAME[tone]}`}
          >
            {filename}
          </span>
          <span className={`block font-mono text-[10px] ${CARD_META[tone]}`}>
            {size === undefined ? "" : formatBytes(size)}
            {size === undefined || done ? "" : " · "}
            {done ? "" : `${String(Math.round(percentage))}%`}
          </span>
        </span>
      </div>

      {!done && (
        <div className={`mt-2 h-1.5 w-full border ${CARD_TRACK[tone]}`}>
          <div
            className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${CARD_FILL[tone]}`}
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
 * One tick, drawn square-capped to match the site rather than the rounded
 * check every messaging app ships.
 */
const Tick = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox='0 0 14 11'
    className={`h-2.5 w-3 ${className}`}
    fill='none'
    stroke='currentColor'
    strokeWidth={2.2}
    strokeLinecap='square'
    strokeLinejoin='miter'
    aria-hidden
  >
    <path d='M1 5.8 L4.9 9.7 L13 1.2' />
  </svg>
);

/**
 * The tick pair, in the grammar people already read without being taught: one
 * tick while the message is still being made, two once it is on the wire, two
 * in green when receipts come back.
 *
 * The second tick is pulled left so the pair reads as one mark rather than two
 * separate checks, and the whole group carries a text label for anyone who
 * cannot see colour -- green versus grey must never be the only thing carrying
 * the state.
 */
export const DeliveryTicks = ({
  count,
  tone,
}: {
  count: 1 | 2;
  tone: DeliveryTone;
}) => (
  <span
    className={`inline-flex shrink-0 items-center ${TONE_TEXT[tone]}`}
    aria-hidden
  >
    <Tick />
    {count === 2 && <Tick className='-ml-1.5' />}
  </span>
);

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
  note,
  onCancel,
}: {
  summary: DeliverySummary;
  align: BubbleTone;
  /** Byte figures for this message: what moved, and what it cost on the wire. */
  note?: string;
  onCancel?: () => void;
}) => (
  <div
    className={`mt-0.5 flex flex-col ${align === "own" ? "items-end" : "items-start"}`}
  >
    <div className='flex items-center gap-1.5'>
      {summary.ticks === 0 ? (
        <span
          aria-hidden
          className={`size-1.5 shrink-0 ${TONE_DOT[summary.tone]}`}
        />
      ) : (
        <DeliveryTicks count={summary.ticks} tone={summary.tone} />
      )}
      <span
        className={`font-mono text-[11px] ${TONE_TEXT[summary.tone]}`}
        role='status'
      >
        {summary.label}
        {summary.progress === undefined ? "" : ` ${String(summary.progress)}%`}
      </span>
      {note !== undefined && (
        <span className='font-mono text-[11px] text-zinc-500 dark:text-zinc-400'>
          · {note}
        </span>
      )}
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

    {/* The one countable outbound phase gets a real bar; the wire phase does
        not, because nothing reports it. */}
    {summary.progress !== undefined && (
      <div className='mt-1 h-1 w-32 border border-zinc-300 dark:border-zinc-700'>
        <div
          className='bg-darkOrange h-full transition-[width] duration-300 motion-reduce:transition-none'
          style={{ width: `${String(summary.progress)}%` }}
        />
      </div>
    )}

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
