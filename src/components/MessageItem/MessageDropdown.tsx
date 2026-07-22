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
  const materializeFile = async (): Promise<Blob | null> => {
    const m = await p2party.readMessage(
      message.merkleRootHex,
      message.sha512Hex,
    );
    return m.message instanceof Blob ? m.message : null;
  };

  const handleOpen = async () => {
    try {
      const blob = await materializeFile();
      if (!blob) return;
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      console.error(error);
    }
  };

  // "Save as…": let the user pick the destination (Chromium File System Access
  // API) and STREAM the disk-backed File there — never held in RAM, ideal for
  // large files. Falls back to the anchor download elsewhere.
  const canSaveAs =
    typeof window !== "undefined" && "showSaveFilePicker" in window;

  const handleSaveAs = async () => {
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
      if (!blob) return;
      const writable = await handle.createWritable();
      await blob.stream().pipeTo(writable);
    } catch (error) {
      // A user cancelling the picker throws AbortError — not an error.
      if ((error as Error)?.name !== "AbortError") console.error(error);
    }
  };

  const handleDownload = async () => {
    try {
      const blob = await materializeFile();
      if (!blob) return;

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
    }
  };

  return (
    <div
      className={`relative my-1 w-auto max-w-full overflow-hidden rounded-2xl border p-2 shadow-md transition-shadow hover:shadow-lg md:max-w-lg ${message.fromPeerId === peerId ? "bg-mediumOrange ml-3 border-orange-300/50 lg:ml-0 dark:border-orange-700/40" : "border-darkOrange/30 mr-3 bg-zinc-900 lg:mr-0 dark:border-orange-800/30"}`}
    >
      <Dropdown>
        <DropdownButton plain className='size-fit cursor-pointer'>
          {msgCategory === p2party.MessageCategory.Text && url.length === 0 && (
            <Text
              className={`text-left tracking-wide wrap-break-word whitespace-pre-line ${message.fromPeerId === peerId ? "font-medium text-black dark:font-semibold dark:text-black" : "font-normal text-white dark:text-white"} text-pretty wrap-break-word text-clip hyphens-auto antialiased select-text`}
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
                className={`text-left tracking-wide wrap-break-word whitespace-pre-wrap ${message.fromPeerId === peerId ? "font-medium text-black dark:font-semibold dark:text-black" : "font-normal text-white dark:text-white"} antialiased`}
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
                  message.channelLabel,
                  message.merkleRootHex,
                  message.sha512Hex,
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
                message.merkleRootHex,
                message.sha512Hex,
              )
            }
          >
            <TrashIcon />
            Delete
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>

      {/* Loading Line */}
      {/*
      {msgPercentage < 100 && (
        <div className='absolute bottom-0 left-0 w-full'>
          <div className='whitespace-no-wrap absolute -top-7 left-1/2 max-w-xs -translate-x-1/2 animate-pulse truncate rounded-md bg-gray-800 px-4 py-2 text-xs text-white shadow-md'>
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
