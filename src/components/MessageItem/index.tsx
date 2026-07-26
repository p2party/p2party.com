import { useState, useEffect, memo } from "react";
import { useSelector } from "react-redux";
import p2party from "p2party";

import { DeliveryCaption } from "../custom/MessageBubble";
import { formatBytes } from "../../utils/formatBytes";
import { summariseDelivery } from "../../protocol/delivery";

import MessageSenderDropdown from "./MessageSenderDropdown";
import MessageDropdown from "./MessageDropdown";

import type { FC } from "react";
import type { Message, FileExtension } from "p2party";
import type { TrackedTransfer } from "../../protocol/delivery";

export interface MessageItemProps {
  message: Message;
  roomId: string;
  /** Present only for messages this device sent, and only while tracked. */
  transfer?: TrackedTransfer;
  onCancelTransfer?: (transferId: string) => void;
}

// const formatBytes = (bytes: number): string => {
//   const units = ["B", "KB", "MB", "GB", "TB"];
//   let index = 0;
//
//   while (bytes >= 1024 && index < units.length - 1) {
//     bytes /= 1024;
//     index++;
//   }
//
//   const formattedValue = index === 0 ? bytes.toFixed(0) : bytes.toFixed(2);
//   return `${formattedValue} ${units[index]}`;
// };

// const formatBytes = (bytes: number): string => {
//   const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
//   if (bytes === 0) return '0 bytes';

//   const i = Math.floor(Math.log(bytes) / Math.log(1024));
//   let value = bytes / Math.pow(1024, i);

//    // Round to 2 decimals and convert to string to remove trailing zeroes
//   const result = parseFloat(value.toFixed(2)).toString();

//   return `${result} ${units[i]}`;
// }

const MessageItem: FC<MessageItemProps> = ({
  message,
  roomId,
  transfer,
  onCancelTransfer,
}) => {
  // Narrow subscription: only peerId (from keyPair, which changes rarely) — NOT
  // the whole rooms array. readMessage is a stable module fn. This keeps a
  // per-chunk progress tick from re-rendering every message row.
  const peerId = useSelector(p2party.keyPairSelector).peerId;

  const [state, setState] = useState<{
    msg: string;
    msgSize: number;
    msgFilename: string;
    msgCategory: string;
    msgPercentage: number;
    msgExtension: FileExtension;
  }>({
    msg: "",
    msgSize: 0,
    msgFilename: "",
    msgCategory: p2party.MessageCategory.Text,
    msgPercentage: 0,
    msgExtension: "",
  });

  const {
    msg,
    msgSize,
    msgCategory,
    msgPercentage,
    msgExtension,
    msgFilename,
  } = state;

  useEffect(() => {
    let cancelled = false;

    const setMessage = async () => {
      try {
        // Metadata-only read — the file bubble shows a filename; the file itself
        // is materialized only when the user opens/downloads it
        // (MessageDropdown). This keeps the whole-file OPFS reassembly off the
        // render path.
        const m = await p2party.readMessage(
          message.merkleRootHex,
          message.sha512Hex,
          false,
        );
        if (cancelled) return;

        const nextMsg = typeof m.message === "string" ? m.message : "";

        if (
          message.fromPeerId === peerId &&
          message.totalChunks > 0 &&
          message.chunksCreated < message.totalChunks
        ) {
          const percentage = Math.floor(
            (message.chunksCreated / message.totalChunks) * 100,
          );

          setState((prevState) => ({
            ...prevState,
            msg: nextMsg,
            msgFilename: m.filename,
            msgCategory: m.category,
            msgExtension: m.extension,
            msgPercentage: percentage,
          }));
        } else if (message.fromPeerId === peerId) {
          // savedSize is receive-side accounting: it counts chunks written to
          // this device's store. A sender never stores its own message, so it
          // stays 0 forever and this row read "Sent 0%" on a transfer the
          // toast had already reported as delivered to every peer.
          //
          // Chunk generation is the only outbound progress the message row
          // knows about. Once it completes the payload is handed to the
          // transport, and delivery per peer is what the transfer handle
          // reports.
          setState((prevState) => ({
            ...prevState,
            msg: nextMsg,
            msgSize: m.size,
            msgFilename: m.filename,
            msgCategory: m.category,
            msgExtension: m.extension,
            msgPercentage: 100,
          }));
        } else if (m.percentage === 100) {
          setState((prevState) => ({
            ...prevState,
            msg: nextMsg,
            msgSize: m.size,
            msgFilename: m.filename,
            msgCategory: m.category,
            msgExtension: m.extension,
            msgPercentage: m.percentage,
          }));
        } else {
          setState((prevState) => ({
            ...prevState,
            msgSize: m.size,
            msgFilename: m.filename,
            msgCategory: m.category,
            msgExtension: m.extension,
            msgPercentage: m.percentage,
          }));
        }
      } catch (error) {
        console.error(error);
      }
    };

    setMessage();

    return () => {
      cancelled = true;
    };
  }, [
    message.merkleRootHex,
    message.fromPeerId,
    message.sha512Hex,
    message.savedSize,
    message.totalSize,
    message.chunksCreated,
    message.totalChunks,
    peerId,
  ]);

  // Real outbound progress, polled while this device's send is in flight.
  // Nothing pushes it: the receipts land in the SDK's have-set, so a UI has to
  // ask. Only in-flight sends poll, and the interval is cleared the moment the
  // transfer settles.
  const inFlight = transfer?.status === "preparing";
  const transferId = transfer?.handle.transferId;
  const [ackedChunks, setAckedChunks] = useState(0);

  useEffect(() => {
    if (!inFlight || transferId === undefined) return;
    let cancelled = false;
    const read = () => {
      const acks = p2party.getTransferAcks(roomId, transferId);
      // A message is only as sent as its slowest peer: reporting the fastest
      // would show 100% while someone in the room still has nothing.
      const slowest = acks.length
        ? Math.min(...acks.map((ack) => ack.ackedChunks))
        : 0;
      if (!cancelled) setAckedChunks(slowest);
    };
    read();
    const timer = setInterval(read, 400);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [inFlight, transferId, roomId]);

  const own = message.fromPeerId === peerId;
  const isFile = msgCategory !== p2party.MessageCategory.Text;
  const receiving = !own && msgPercentage < 100;
  // Real payload bytes the slowest peer has confirmed. Acks are real chunks
  // only, so this never counts cover.
  const ackedBytes = Math.min(
    message.totalSize,
    ackedChunks * p2party.MAX_CHUNK_SIZE,
  );
  // What actually crossed the wire, cover included: every cell is padded to
  // full, so this is always larger than the payload and is a property of the
  // padding policy rather than of the message.
  const wireBytes = message.totalChunks * p2party.WIRE_CHUNK_FRAME_LEN;
  // Cover is not an afterthought here, so the wire figure is stated rather
  // than hidden: padding is why a 9-byte reply and a photo look alike, and it
  // is paid for in bytes.
  const sentNote = !own
    ? undefined
    : transfer?.status === "preparing" && message.merkleRootHex !== ""
      ? `${formatBytes(ackedBytes)} of ${formatBytes(message.totalSize)}`
      : transfer?.status === "delivered" || transfer?.status === "partial"
        ? `${formatBytes(message.totalSize)} · ${formatBytes(wireBytes)} on the wire`
        : formatBytes(message.totalSize);

  // Frames actually taken in, cover included. The receiver counts these
  // separately from real chunks, so the two figures never have to be guessed
  // apart.
  const receivedWireBytes =
    (message.chunksReceivedTotal ?? 0) * p2party.WIRE_CHUNK_FRAME_LEN;
  const receivedPercentage =
    message.totalSize > 0
      ? Math.min(100, Math.floor((message.savedSize / message.totalSize) * 100))
      : 0;

  return (
    <div
      className={`mb-3 flex items-end gap-1 sm:mb-4 sm:gap-2 ${
        own ? "justify-end" : "justify-start"
      }`}
    >
      {!own && (
        <div className='self-center'>
          <MessageSenderDropdown message={message} />
        </div>
      )}

      <div className='flex max-w-[85%] flex-col md:max-w-[75%]'>
        {!own && (
          <span className='mb-0.5 ml-1 text-left text-[11px] font-medium tracking-wide text-zinc-500 dark:text-zinc-300'>
            {message.fromPeerId.slice(0, 8)}
          </span>
        )}

        {own && (
          <span className='mr-1 mb-0.5 text-right text-[11px] font-medium tracking-wide text-zinc-500 dark:text-zinc-300'>
            {message.fromPeerId.slice(0, 8)}
          </span>
        )}

        <MessageDropdown
          message={message}
          roomId={roomId}
          msg={msg}
          msgCategory={msgCategory}
          msgExtension={msgExtension}
          msgSize={msgSize}
          msgFilename={msgFilename}
          msgPercentage={msgPercentage}
        />

        {/* Delivery, for messages this device sent. It belongs against the
            message it describes, not in a corner of the screen. */}
        {transfer && (
          <DeliveryCaption
            summary={summariseDelivery(
              transfer.status,
              transfer.result,
              transfer.error,
              {
                created: message.chunksCreated,
                total: message.totalChunks,
                staged: message.merkleRootHex !== "",
                ackedBytes,
                realBytes: message.totalSize,
              },
            )}
            align={own ? "own" : "peer"}
            note={sentNote}
            onCancel={
              onCancelTransfer
                ? () => {
                    onCancelTransfer(transfer.handle.transferId);
                  }
                : undefined
            }
          />
        )}

        {/* Receiving is the one direction with an honest percentage: savedSize
            is what this device has actually written, and it climbs the whole
            way (measured 1.3 MB -> 12.6 MB on a 12 MB file). The sender has no
            equivalent, which is why its state is ticks rather than a bar. */}
        {receiving && (
          <div className='mt-0.5 flex flex-col items-start'>
            <div className='flex items-center gap-1.5'>
              <span
                aria-hidden
                className='size-1.5 shrink-0 animate-pulse bg-zinc-400 dark:bg-zinc-500'
              />
              <span
                className='font-mono text-[11px] text-zinc-500 dark:text-zinc-400'
                role='status'
              >
                Receiving {receivedPercentage}%
              </span>
              <span className='font-mono text-[11px] text-zinc-500 dark:text-zinc-400'>
                · {formatBytes(message.savedSize)} of{" "}
                {formatBytes(message.totalSize)}
                {receivedWireBytes > 0
                  ? ` · ${formatBytes(receivedWireBytes)} on the wire`
                  : ""}
              </span>
            </div>
            <div className='mt-1 h-1 w-32 border border-zinc-300 dark:border-zinc-700'>
              <div
                className='bg-darkOrange h-full transition-[width] duration-300 motion-reduce:transition-none'
                style={{ width: `${String(receivedPercentage)}%` }}
              />
            </div>
          </div>
        )}

        {/* Time, and the size for text -- which had no way of telling you how
            many bytes it moved. A file already states its size on the card, so
            repeating it here would just be the same number twice. */}
        <span
          className={`mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-300 ${
            own ? "mr-1 text-right" : "ml-1 text-left"
          }`}
        >
          {new Date(message.timestamp).toLocaleString()}
          {!receiving && !isFile && message.totalSize > 0
            ? ` · ${formatBytes(message.totalSize)}`
            : ""}
        </span>
      </div>

      {own && (
        <div className='self-center'>
          <MessageSenderDropdown message={message} />
        </div>
      )}
    </div>
  );
};

// Immer keeps unchanged Message references stable, so a shallow-prop memo lets a
// row skip re-render when its own message didn't change (combine with narrowing
// the store subscription out of the row to fully stop O(N) list re-renders).
export default memo(MessageItem);
