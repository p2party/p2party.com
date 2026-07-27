import { formatBytes } from "../../utils/formatBytes";

import type { CSSProperties, ReactNode } from "react";
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

/**
 * Direction is carried by fill in light mode and by border colour in dark.
 *
 * A darkOrange slab is confident against white, but against black it is the
 * brightest thing on the screen and every sent message shouts. On dark the
 * bubble keeps the page's own background and takes an orange border instead:
 * same signal, same palette, without a wall of orange in a dark room. Received
 * messages keep the white border they already had, so the two are still told
 * apart at a glance rather than only by which side they sit on.
 */
const SURFACE: Record<BubbleTone, string> = {
  own: "bg-darkOrange border-zinc-950 text-white dark:border-darkOrange dark:bg-zinc-950 dark:text-white",
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
  /**
   * Delivery and byte figures, rendered inside the bubble under its content.
   * They belong to the message, so they travel with it rather than stacking
   * more lines underneath and pushing the next message down the thread.
   */
  subtitle?: ReactNode;
  className?: string;
  children: ReactNode;
}

export const MessageBubble = ({
  tone,
  size = "md",
  animate = false,
  subtitle,
  className = "",
  children,
}: MessageBubbleProps) => (
  <div
    className={`relative w-auto max-w-full overflow-hidden border-2 transition-transform ${PADDING[size]} ${SURFACE[tone]} ${animate ? "animate-fade-in" : ""} ${className}`}
  >
    {children}
    {subtitle}
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
  own: "bg-darkOrange border-zinc-950 dark:border-darkOrange dark:bg-zinc-950",
  peer: "border-zinc-950 bg-white dark:border-zinc-200 dark:bg-zinc-950",
};

// On dark the card is no longer orange, so the chip and the fill can be --
// they are the accent again instead of a hole punched in one.
const CARD_BADGE: Record<BubbleTone, string> = {
  own: "bg-white text-darkOrange dark:bg-darkOrange dark:text-white",
  peer: "bg-darkOrange text-white",
};

const CARD_NAME: Record<BubbleTone, string> = {
  own: "text-white",
  peer: "text-zinc-950 dark:text-white",
};

const CARD_META: Record<BubbleTone, string> = {
  own: "text-white/75 dark:text-zinc-400",
  peer: "text-zinc-500 dark:text-zinc-400",
};

const CARD_TRACK: Record<BubbleTone, string> = {
  own: "border-white/40 dark:border-zinc-700",
  peer: "border-zinc-300 dark:border-zinc-700",
};

const CARD_FILL: Record<BubbleTone, string> = {
  own: "bg-white dark:bg-darkOrange",
  peer: "bg-darkOrange",
};

export const FileCard = ({
  filename,
  extension,
  size,
  percentage,
  progress,
  tone = "peer",
  subtitle,
  showSize = true,
  animate = false,
  compact = false,
}: {
  filename: string;
  extension: string;
  /** Logical message bytes. Omitted while still unknown. */
  size?: number;
  /** 0-100. At 100 the fill bar is dropped: a finished file is just a file. */
  percentage: number;
  /**
   * Overrides `percentage` for the bar. A sender's own message is 100% stored
   * the instant its chunks exist, so the receive-side percentage says nothing
   * about the send -- and the bar vanished exactly when the transfer began.
   * The delivery progress is passed in here instead so the bar stays where the
   * file is, rather than becoming a second bar underneath it.
   */
  progress?: number;
  tone?: BubbleTone;
  subtitle?: ReactNode;
  /**
   * Off when the subtitle already states the size beside what it cost on the
   * wire, which is where the two numbers are worth comparing. Printing it here
   * as well says the same thing twice, two lines apart.
   */
  showSize?: boolean;
  animate?: boolean;
  compact?: boolean;
}) => {
  const badge =
    extension.replace(/^\./u, "").slice(0, 4).toUpperCase() || "FILE";
  const shown = progress ?? percentage;
  const done = shown >= 100;

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
          <span
            className={`block font-mono text-[10px] tabular-nums ${CARD_META[tone]}`}
          >
            {size === undefined || !showSize ? "" : formatBytes(size)}
            {size === undefined || !showSize || done ? "" : " · "}
            {done ? "" : `${String(Math.round(shown))}%`}
          </span>
        </span>
      </div>

      {!done && (
        <div className={`mt-2 h-1.5 w-full border ${CARD_TRACK[tone]}`}>
          <div
            className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${CARD_FILL[tone]}`}
            style={{
              width: `${String(Math.min(100, Math.max(0, shown)))}%`,
            }}
          />
        </div>
      )}

      {subtitle}
    </div>
  );
};

/**
 * The same four states, painted for the surface they sit on. A subtitle inside
 * an orange bubble cannot use the greens and ambers that read against white --
 * emerald-700 on darkOrange is mud -- so the sent side lightens where the
 * received side darkens.
 */
const TONE_ON: Record<BubbleTone, Record<DeliveryTone, string>> = {
  own: {
    pending: "text-white/70 dark:text-zinc-400",
    good: "text-emerald-200 dark:text-emerald-400",
    warn: "text-amber-100 dark:text-amber-400",
    bad: "text-red-100 dark:text-red-400",
  },
  peer: {
    pending: "text-zinc-500 dark:text-zinc-400",
    good: "text-emerald-700 dark:text-emerald-400",
    warn: "text-amber-700 dark:text-amber-400",
    bad: "text-red-700 dark:text-red-400",
  },
};

/** Byte figures are supporting detail, never the headline. */
const MUTED_ON: Record<BubbleTone, string> = {
  own: "text-white/70 dark:text-zinc-400",
  peer: "text-zinc-500 dark:text-zinc-400",
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
  surface = "peer",
}: {
  count: 1 | 2;
  tone: DeliveryTone;
  surface?: BubbleTone;
}) => (
  <span
    // Both states occupy the pair's width, so gaining the second tick moves
    // nothing around it.
    className={`inline-flex w-[18px] shrink-0 items-center ${TONE_ON[surface][tone]}`}
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
  surface,
  align,
  note,
  noteClassName = "",
  noteStyle,
  onCancel,
}: {
  /** Absent on received messages: ticks are a sender's claim, not a receiver's. */
  summary?: DeliverySummary;
  /** The bubble this sits inside, which decides the palette. */
  surface: BubbleTone;
  /** Which inner edge to hug: the one facing the middle of the thread. */
  align: "left" | "right";
  /** Byte figures, already formatted. */
  note?: string;
  /**
   * Width reservation for figures that tick. "9 MB of 33 MB" becoming
   * "17 MB of 33 MB" is one character wider, and since the bubble is sized to
   * its content that single character resized the whole bubble several times a
   * second. Reserving the room the widest form needs keeps it still.
   */
  noteClassName?: string;
  /** Inline width reservation, when the widest form is only known from data. */
  noteStyle?: CSSProperties;
  onCancel?: () => void;
}) => (
  <div
    className={`mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 ${
      align === "right" ? "justify-end" : "justify-start"
    }`}
  >
    {summary &&
      (summary.ticks === 0 ? (
        <span
          aria-hidden
          className={`size-1.5 shrink-0 ${TONE_DOT[summary.tone]}`}
        />
      ) : (
        <DeliveryTicks
          count={summary.ticks}
          tone={summary.tone}
          surface={surface}
        />
      ))}

    {summary && (
      <span
        // Reserved to the longest phase word, so "Preparing" becoming
        // "Sending" does not resize the bubble around it either.
        className={`inline-block min-w-[9ch] font-mono text-[10px] ${TONE_ON[surface][summary.tone]}`}
        role='status'
      >
        {summary.label}
        {summary.progress === undefined ? "" : ` ${String(summary.progress)}%`}
      </span>
    )}

    {note !== undefined && (
      <span
        className={`font-mono text-[10px] tabular-nums ${MUTED_ON[surface]} ${noteClassName}`}
        style={noteStyle}
      >
        {summary ? "· " : ""}
        {note}
      </span>
    )}

    {summary?.cancellable && onCancel && (
      <button
        type='button'
        onClick={(event) => {
          // The subtitle lives inside the dropdown trigger now; a click here
          // must cancel the transfer, not open the menu.
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }}
        className={`font-mono text-[10px] underline decoration-dotted underline-offset-2 ${MUTED_ON[surface]} ${
          surface === "own"
            ? "hover:text-white"
            : "hover:text-red-700 dark:hover:text-red-400"
        }`}
      >
        cancel
      </button>
    )}

    {summary && summary.detail.length > 1 && (
      <details className='w-full'>
        <summary
          className={`cursor-pointer font-mono text-[10px] ${MUTED_ON[surface]}`}
        >
          per peer
        </summary>
        <ul
          className={`mt-1 space-y-0.5 font-mono text-[10px] ${MUTED_ON[surface]} ${
            align === "right" ? "text-right" : "text-left"
          }`}
        >
          {summary.detail.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    )}
  </div>
);
