import { useState, useEffect, memo } from "react";
import { useSelector } from "react-redux";
import p2party from "p2party";

import MessageSenderDropdown from "./MessageSenderDropdown";
import MessageDropdown from "./MessageDropdown";

import type { FC } from "react";
import type { Message, FileExtension } from "p2party";

export interface MessageItemProps {
  message: Message;
  roomId: string;
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

const MessageItem: FC<MessageItemProps> = ({ message, roomId }) => {
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
    msgLoadingText: string;
    msgExtension: FileExtension;
  }>({
    msg: "",
    msgSize: 0,
    msgFilename: "",
    msgCategory: p2party.MessageCategory.Text,
    msgLoadingText: "",
    msgPercentage: 0,
    msgExtension: "",
  });

  const {
    msg,
    msgSize,
    msgCategory,
    msgPercentage,
    msgExtension,
    msgLoadingText,
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
            msgLoadingText: `Generating chunks ${percentage}%`,
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
            msgLoadingText: "",
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
            msgLoadingText: "",
            msgFilename: m.filename,
            msgCategory: m.category,
            msgExtension: m.extension,
            msgPercentage: m.percentage,
          }));
        } else {
          setState((prevState) => ({
            ...prevState,
            msgSize: m.size,
            msgLoadingText: `Received ${Math.floor(
              (message.savedSize / message.totalSize) * 100,
            )}%`,
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

  return (
    <div
      className={`mb-3 flex items-end gap-1 sm:mb-4 sm:gap-2 ${
        message.fromPeerId === peerId ? "justify-end" : "justify-start"
      }`}
    >
      {message.fromPeerId !== peerId && (
        <div className='self-center'>
          <MessageSenderDropdown message={message} />
        </div>
      )}

      <div className='flex max-w-[85%] flex-col md:max-w-[75%]'>
        {message.fromPeerId !== peerId && (
          <span className='mb-0.5 ml-1 text-left text-[11px] font-medium tracking-wide text-zinc-500 dark:text-zinc-300'>
            {message.fromPeerId.slice(0, 8)}
          </span>
        )}

        {message.fromPeerId === peerId && (
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
          // msgLoadingText={msgLoadingText}
          msgFilename={msgFilename}
          msgPercentage={msgPercentage}
        />

        {/* Loading */}
        {msgPercentage < 100 && (
          <div
            className={`mt-1 flex items-center gap-2 ${
              message.fromPeerId === peerId
                ? "justify-end"
                : "flex-row-reverse justify-start"
            }`}
          >
            <span
              className={`w-48 text-[11px] text-zinc-500 dark:text-zinc-300 ${
                message.fromPeerId === peerId ? "text-right" : "text-left"
              }`}
            >
              {msgLoadingText}
            </span>
            <div className='relative h-5 w-5'>
              <svg className='h-5 w-5 -rotate-90' viewBox='0 0 36 36'>
                <path
                  className='text-zinc-200 dark:text-zinc-700'
                  stroke='currentColor'
                  strokeWidth='4'
                  fill='none'
                  d='M18 2a16 16 0 1 1 0 32 16 16 0 1 1 0-32'
                />
                <path
                  className='text-darkOrange'
                  stroke='currentColor'
                  strokeWidth='4'
                  fill='none'
                  strokeLinecap='round'
                  strokeDasharray='100'
                  strokeDashoffset={100 - msgPercentage}
                  d='M18 2a16 16 0 1 1 0 32 16 16 0 1 1 0-32'
                />
              </svg>
            </div>
          </div>
        )}

        {msgPercentage === 100 && (
          <>
            {message.fromPeerId !== peerId && (
              <span className='mt-0.5 ml-1 text-left text-[11px] text-zinc-500 dark:text-zinc-300'>
                {new Date(message.timestamp).toLocaleString()}
              </span>
            )}

            {message.fromPeerId === peerId && (
              <span className='mt-0.5 mr-1 text-right text-[11px] text-zinc-500 dark:text-zinc-300'>
                {new Date(message.timestamp).toLocaleString()}
              </span>
            )}
          </>
        )}
      </div>

      {message.fromPeerId === peerId && (
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
