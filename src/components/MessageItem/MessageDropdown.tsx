import { useState } from "react";

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileOpener } from "@capawesome-team/capacitor-file-opener";
import { isURL } from "class-validator";
import { useSelector } from "react-redux";
import p2party from "p2party";

import { Text } from "../text";
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
} from "../dropdown";
import {
  // ArrowTopRightOnSquareIcon,
  ArrowDownOnSquareIcon,
  DocumentIcon,
  StopIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import {
  ArrowTopRightOnSquareIcon,
  ClipboardIcon,
} from "@heroicons/react/20/solid";

import type { Message, FileExtension } from "p2party";

const truncateFilename = (filename: string, maxLength: number) => {
  if (filename.length <= maxLength) return filename;
  const half = Math.floor((maxLength - 3) / 2); // Reserve space for "..."
  return `${filename.slice(0, half)}...${filename.slice(-half)}`;
};

const readAsDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export interface MessageDropdownProps {
  message: Message;
  roomId: string;
  msg: string;
  msgSize: number;
  msgFilename: string;
  msgCategory: string;
  // msgLoadingText: string;
  msgPercentage: number;
  msgExtension: FileExtension;
}

const MessageDropdown = ({
  message,
  roomId,
  msg,
  msgFilename,
  msgCategory,
  // msgLoadingText,
  msgExtension,
  msgPercentage,
}: MessageDropdownProps) => {
  // Narrow subscription: peerId only (readMessage/cancelMessage/deleteMessage
  // are stable module functions), so a dropdown row doesn't re-render on every
  // store change.
  const peerId = useSelector(p2party.keyPairSelector).peerId;
  const url = isURL(msg) ? msg : "";

  // Materialize the file only on user action (not on render). For a big file
  // this streams the IndexedDB chunks to a disk-backed OPFS File in the worker.
  const [fileError, setFileError] = useState("");

  const describeFailure = (error: unknown): string =>
    error instanceof Error && error.message.length > 0
      ? error.message
      : "Something went wrong opening this file.";

  /**
   * Returns the reassembled file, or throws with a reason the user can act
   * on. readMessage yields a string (not a Blob) for a text message and for
   * a transfer that has not finished arriving.
   */
  const materializeFile = async (): Promise<Blob> => {
    const m = await p2party.readMessage(
      message.merkleRootHex,
      message.sha512Hex,
    );
    if (m.message instanceof Blob) return m.message;
    if (m.percentage < 100)
      throw new Error(
        `This file is still arriving (${String(Math.floor(m.percentage))}%). Try again once it completes.`,
      );
    throw new Error("This message has no file attached.");
  };

  /**
   * A blob: URL inherits THIS page's origin, so anything the browser executes
   * from one runs as p2party.com. The message type — and therefore the Blob's
   * MIME type — is chosen by the sender, and MessageType includes ImageSVG and
   * CodeHTML. Opening a peer's .html or .svg in a tab would hand them script
   * execution against our localStorage and IndexedDB, which hold identity and
   * ratchet state. Anyone holding the room link can send one.
   *
   * So: only render inline what cannot carry script. Everything else is
   * downloaded instead, which is inert.
   */
  const INLINE_SAFE = [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/bmp",
    "audio/",
    "video/",
    "application/pdf",
  ];

  const isInlineSafe = (type: string): boolean => {
    const mime = type.split(";", 1)[0].trim().toLowerCase();
    // image/svg+xml must never match: SVG is a script-bearing document.
    return INLINE_SAFE.some((safe) =>
      safe.endsWith("/") ? mime.startsWith(safe) : mime === safe,
    );
  };

  const handleOpen = async () => {
    setFileError("");
    try {
      const blob = await materializeFile();
      if (!isInlineSafe(blob.type)) {
        await handleDownload();
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      // Reassembly consumed the user gesture, so a popup blocker can reject
      // this — window.open returns null and nothing would otherwise happen.
      const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
      if (!opened)
        setFileError(
          "Your browser blocked the new tab. Allow pop-ups for this site, or use Download.",
        );
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      console.error(error);
      setFileError(describeFailure(error));
    }
  };

  // "Save as…": let the user pick the destination (Chromium File System Access
  // API) and STREAM the disk-backed File there — never held in RAM, ideal for
  // large files. Falls back to the anchor download elsewhere.
  const canSaveAs =
    typeof window !== "undefined" && "showSaveFilePicker" in window;

  const handleSaveAs = async () => {
    setFileError("");
    try {
      // The picker must be invoked within the click gesture, before any await.
      const handle = await (
        window as unknown as {
          showSaveFilePicker: (opts: { suggestedName?: string }) => Promise<{
            createWritable: () => Promise<WritableStream<Uint8Array>>;
          }>;
        }
      ).showSaveFilePicker({ suggestedName: msgFilename });
      const blob = await materializeFile();
      const writable = await handle.createWritable();
      await blob.stream().pipeTo(writable);
    } catch (error) {
      // A user cancelling the picker throws AbortError — not an error.
      if ((error as Error)?.name !== "AbortError") {
        console.error(error);
        setFileError(describeFailure(error));
      }
    }
  };

  const handleDownload = async () => {
    setFileError("");
    try {
      const blob = await materializeFile();

      if (Capacitor.getPlatform() === "web") {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = msgFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      } else {
        const base64 = await readAsDataURL(blob);
        const name = `${String(new Date().getTime())}-${msgFilename.replace("." + msgExtension, "")}.${msgExtension}`;
        await Filesystem.appendFile({
          path: name,
          data: base64,
          directory: Directory.Data,
        });

        const { uri } = await Filesystem.getUri({
          path: name,
          directory: Directory.Data,
        });

        await FileOpener.openFile({ path: uri });
      }
    } catch (error) {
      console.error(error);
      setFileError(describeFailure(error));
    }
  };

  return (
    <div
      className={`relative my-1 w-auto max-w-full overflow-hidden border-2 p-2.5 transition-transform md:max-w-lg ${message.fromPeerId === peerId ? "bg-darkOrange ml-3 border-zinc-950 text-white lg:ml-0 dark:border-zinc-200" : "mr-3 border-zinc-950 bg-white text-zinc-950 lg:mr-0 dark:border-zinc-200 dark:bg-zinc-950 dark:text-white"}`}
    >
      <Dropdown>
        <DropdownButton plain className='size-fit cursor-pointer'>
          {msgCategory === p2party.MessageCategory.Text && url.length === 0 && (
            <Text
              className={`text-left tracking-wide wrap-break-word whitespace-pre-line ${message.fromPeerId === peerId ? "font-medium text-white" : "font-normal text-zinc-950 dark:text-white"} text-pretty wrap-break-word text-clip hyphens-auto antialiased select-text`}
            >
              {msg as string}
            </Text>
          )}

          {msgCategory === p2party.MessageCategory.Text && url.length > 0 && (
            <Text
              className={`text-left font-semibold tracking-wide text-pretty wrap-break-word break-all text-clip hyphens-auto whitespace-normal text-sky-700 underline decoration-sky-400 antialiased select-text dark:font-normal dark:text-sky-400`}
            >
              {msg as string}
            </Text>
          )}

          {msgCategory !== p2party.MessageCategory.Text && (
            <div className='flex w-full items-center justify-between px-2'>
              <Text
                className={`text-left tracking-wide wrap-break-word whitespace-pre-wrap ${message.fromPeerId === peerId ? "font-medium text-white" : "font-normal text-zinc-950 dark:text-white"} antialiased`}
              >
                {truncateFilename(`${msgFilename}`, 20)}
              </Text>
              <DocumentIcon className='h-6 w-6 text-gray-500' />
            </div>
          )}
        </DropdownButton>
        <DropdownMenu
          className='min-w-64'
          anchor={message.fromPeerId !== peerId ? "bottom start" : "bottom end"}
        >
          {msgPercentage === 100 &&
            msgCategory === p2party.MessageCategory.Text &&
            url.length > 0 && (
              <DropdownItem onClick={() => window.open(url, "_blank")}>
                <ArrowTopRightOnSquareIcon />
                Open URL in a new tab
              </DropdownItem>
            )}

          {msgPercentage === 100 &&
            msgCategory === p2party.MessageCategory.Text && (
              <DropdownItem onClick={() => navigator.clipboard.writeText(msg)}>
                <ClipboardIcon />
                Copy text
              </DropdownItem>
            )}

          {msgPercentage === 100 &&
            msgCategory !== p2party.MessageCategory.Text &&
            Capacitor.getPlatform() === "web" && (
              <>
                <DropdownItem onClick={handleOpen}>
                  <ArrowTopRightOnSquareIcon />
                  Open file
                </DropdownItem>
                <DropdownItem onClick={handleDownload}>
                  <ArrowDownOnSquareIcon />
                  Download file
                </DropdownItem>
                {canSaveAs && (
                  <DropdownItem onClick={handleSaveAs}>
                    <ArrowDownOnSquareIcon />
                    Save as…
                  </DropdownItem>
                )}
              </>
            )}

          {msgPercentage === 100 &&
            msgCategory !== p2party.MessageCategory.Text &&
            Capacitor.getPlatform() !== "web" && (
              <DropdownItem onClick={handleDownload}>
                <ArrowDownOnSquareIcon />
                Download file
              </DropdownItem>
            )}

          {msgPercentage < 100 && (
            <DropdownItem
              onClick={async () =>
                await p2party.cancelMessage(
                  roomId,
                  message.channelLabel,
                  message.merkleRootHex || undefined,
                  message.sha512Hex,
                  message.transferId,
                )
              }
            >
              <StopIcon />
              Cancel
            </DropdownItem>
          )}

          {/* {message.fromPeerId !== peerId && (
        <DropdownItem>
          <NoSymbolIcon />
          Prevent
        </DropdownItem>
      )} */}

          <DropdownItem
            onClick={async () =>
              await p2party.deleteMessage(
                roomId,
                message.merkleRootHex || undefined,
                message.sha512Hex,
              )
            }
          >
            <TrashIcon />
            Delete
          </DropdownItem>

          {/* The privacy machinery this app markets, per message: how many
              uniform cells actually arrived, how many carried real bytes,
              and how many resend rounds it took. Receiver-side counters are
              absent on messages you sent. */}
          {message.chunksReceivedTotal !== undefined && (
            <div className='border-t-2 border-zinc-950/15 px-3.5 pt-2 pb-1 font-mono text-[11px] leading-relaxed text-zinc-500 sm:px-3 dark:border-white/15 dark:text-zinc-400'>
              <div>
                {message.chunksReceivedTotal} cells received ·{" "}
                {message.chunksReceivedReal ?? 0} real ·{" "}
                {message.chunksReceivedTotal -
                  (message.chunksReceivedReal ?? 0)}{" "}
                cover
              </div>
              {(message.retransmits ?? 0) > 0 && (
                <div>{message.retransmits} resend rounds</div>
              )}
            </div>
          )}
        </DropdownMenu>
      </Dropdown>

      {fileError && (
        <p
          role='alert'
          className='mt-1 border-2 border-red-700 bg-red-50 px-2 py-1 font-mono text-xs text-red-800 dark:bg-red-950 dark:text-red-300'
        >
          {fileError}
        </p>
      )}

      {/* Loading Line */}
      {/*
      {msgPercentage < 100 && (
        <div className='absolute bottom-0 left-0 w-full'>
          <div className='whitespace-no-wrap absolute -top-7 left-1/2 max-w-xs -translate-x-1/2 truncate border-2 border-zinc-950 bg-zinc-900 px-4 py-2 font-mono text-xs text-white'>
            {msgLoadingText}
          </div>

          <div className='h-1 w-full overflow-hidden rounded-md bg-gray-200'>
            <div
              className='h-full bg-blue-500 transition-all duration-500 ease-in-out'
              style={{ width: `${msgPercentage}%` }}
            ></div>
          </div>
        </div>
      )}
      */}
    </div>
  );
};

export default MessageDropdown;
