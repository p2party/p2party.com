import type { MessageTransferHandle, SendMessageResult } from "./v4";

/**
 * A send in flight, and what became of it.
 *
 * These lived in TransferTray, the floating card that used to report delivery.
 * The card is gone -- delivery is now a caption on the message bubble -- but
 * the shape it described is the domain, not the widget, so it belongs next to
 * the function that interprets it rather than in whichever component happens
 * to render it this month.
 */
export type TransferStatus =
  "preparing" | "cancelling" | "delivered" | "partial" | "failed" | "cancelled";

export interface TrackedTransfer {
  handle: MessageTransferHandle;
  label: string;
  status: TransferStatus;
  result?: SendMessageResult;
  error?: string;
}

/**
 * One source of truth for what a send's outcome means.
 *
 * The delivery state used to live only in a floating toast, phrased for a
 * notification ("DELIVERED TO ALL PEERS"). Moving it onto the message bubble
 * means the same facts have to read as a caption next to the text they belong
 * to, and the summarising has to happen in one place rather than being
 * re-derived by whichever component is rendering it.
 *
 * `tone` is the semantic, not a colour: the bubble decides how to paint it.
 */
export type DeliveryTone = "pending" | "good" | "warn" | "bad";

export interface DeliverySummary {
  tone: DeliveryTone;
  /** Caption for the bubble. Short enough to sit under a line of text. */
  label: string;
  /** Per-peer lines, for the expanded view. Empty while still in flight. */
  detail: string[];
  /** True while the transfer can still be cancelled. */
  cancellable: boolean;
  /**
   * Ticks to draw, in the sense every messaging app has taught people to read:
   * one while the message is still being turned into chunks, two once those
   * chunks are on the wire, two in the good tone once receipts come back. Zero
   * when the send never got far enough to claim either.
   */
  ticks: 0 | 1 | 2;
  /**
   * 0-100, and only while chunks are still being created -- the one outbound
   * phase with a real denominator. Once they are all created the transport
   * reports nothing until receipts arrive, so anything shown here would be
   * invented. That silence is exactly why the second state is a tick and not a
   * percentage.
   */
  progress?: number;
}

/** Chunk creation, the only sender-side progress the store actually exposes. */
export interface ChunkProgress {
  created: number;
  total: number;
  /**
   * Whether staging has finished, which is NOT `created >= total`: the store
   * writes `chunksCreated + 1`, so the counter reaches its total one chunk
   * early (754 of 753 observed on a 40 MB file, with the root still unbound).
   * The merkle root is bound exactly once, when the last chunk is staged and
   * the fanout begins, so it is the honest boundary between the two phases.
   */
  staged: boolean;
  /**
   * Real payload bytes the slowest peer has receipted, from the SDK's
   * getTransferAcks. Percentages are taken against real bytes: a receipt for a
   * decoy never resolves to a staged chunk on the sender, so cover traffic
   * cannot inflate progress. Undefined before any receipt arrives.
   */
  ackedBytes?: number;
  /** Real payload bytes in this message -- the denominator for the above. */
  realBytes?: number;
}

const PEER_ID_PREFIX = 8;

const shortPeer = (peerId: string) =>
  peerId.length > PEER_ID_PREFIX + 4
    ? `${peerId.slice(0, PEER_ID_PREFIX)}…`
    : peerId;

/**
 * `skipped` is not a failure of the send, it is a statement about the peer:
 * they were not connected, not yet authenticated, or the transfer was
 * cancelled before reaching them. Saying "failed" for those would blame the
 * message for the room's state.
 */
const reasonText = (reason: unknown): string => {
  if (typeof reason === "string") return reason;
  if (reason instanceof Error) return reason.message;
  return "unknown reason";
};

export const summariseDelivery = (
  status: TransferStatus,
  result: SendMessageResult | undefined,
  error?: string,
  chunks?: ChunkProgress,
): DeliverySummary => {
  if (status === "preparing") {
    // Measured on a 24 MB file: chunksCreated climbs to its total in about two
    // seconds, then sits there for the five seconds the bytes are actually in
    // flight. So "preparing" covers two genuinely different states, and only
    // the first of them can be counted.
    //
    // The split is on `staged`, not on the counter: gating by count flipped to
    // two ticks while the last chunk was still being written, and the
    // percentage jumped from 91% straight to "Sending" without ever reaching
    // 100. The clamp stays for the same +1 overshoot.
    const creating = chunks !== undefined && chunks.total > 0 && !chunks.staged;
    if (creating)
      return {
        tone: "pending",
        label: "Preparing",
        detail: [],
        cancellable: true,
        ticks: 1,
        progress: Math.min(
          100,
          Math.round((chunks.created / chunks.total) * 100),
        ),
      };
    // Once staging is done the receipts are the progress, and they are the
    // sender's own have-set rather than an estimate.
    const sent =
      chunks?.realBytes !== undefined &&
      chunks.realBytes > 0 &&
      chunks.ackedBytes !== undefined
        ? Math.min(
            100,
            Math.round((chunks.ackedBytes / chunks.realBytes) * 100),
          )
        : undefined;
    return {
      tone: "pending",
      label: "Sending",
      detail: [],
      cancellable: true,
      ticks: 2,
      progress: sent,
    };
  }

  if (status === "cancelling")
    return {
      tone: "pending",
      label: "Cancelling…",
      detail: [],
      cancellable: false,
      ticks: 2,
    };

  const outcomes = result?.outcomes ?? [];
  const detail = outcomes.map((outcome) => {
    const peer = shortPeer(outcome.peerId);
    if (outcome.status === "delivered") return `${peer} · delivered`;
    if (outcome.status === "skipped")
      return `${peer} · skipped (${outcome.reason})`;
    return `${peer} · failed (${reasonText(outcome.reason)})`;
  });

  // Cancelled and failed get no ticks at all: a tick is a claim that the
  // message got somewhere, and neither of these did.
  if (status === "cancelled")
    return {
      tone: "warn",
      label: "Cancelled",
      detail,
      cancellable: false,
      ticks: 0,
    };

  const delivered = outcomes.filter(
    (outcome) => outcome.status === "delivered",
  ).length;

  if (status === "delivered")
    return {
      tone: "good",
      // A room of one is the common case and "delivered to 1 of 1" reads like
      // a report. Only say the arithmetic when there is arithmetic to do.
      label:
        outcomes.length > 1 ? `Delivered to ${outcomes.length}` : "Delivered",
      detail,
      cancellable: false,
      ticks: 2,
    };

  if (status === "partial")
    return {
      tone: "warn",
      label: `Delivered to ${delivered} of ${outcomes.length}`,
      detail,
      cancellable: false,
      ticks: 2,
    };

  // failed
  return {
    tone: "bad",
    label: outcomes.length === 0 ? (error ?? "Not delivered") : "Not delivered",
    detail,
    cancellable: false,
    ticks: 0,
  };
};
