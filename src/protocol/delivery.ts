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
): DeliverySummary => {
  if (status === "preparing")
    return {
      tone: "pending",
      label: "Sending…",
      detail: [],
      cancellable: true,
    };

  if (status === "cancelling")
    return {
      tone: "pending",
      label: "Cancelling…",
      detail: [],
      cancellable: false,
    };

  const outcomes = result?.outcomes ?? [];
  const detail = outcomes.map((outcome) => {
    const peer = shortPeer(outcome.peerId);
    if (outcome.status === "delivered") return `${peer} · delivered`;
    if (outcome.status === "skipped")
      return `${peer} · skipped (${outcome.reason})`;
    return `${peer} · failed (${reasonText(outcome.reason)})`;
  });

  if (status === "cancelled")
    return { tone: "warn", label: "Cancelled", detail, cancellable: false };

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
    };

  if (status === "partial")
    return {
      tone: "warn",
      label: `Delivered to ${delivered} of ${outcomes.length}`,
      detail,
      cancellable: false,
    };

  // failed
  return {
    tone: "bad",
    label: outcomes.length === 0 ? (error ?? "Not delivered") : "Not delivered",
    detail,
    cancellable: false,
  };
};
