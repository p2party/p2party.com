import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileOpener } from "@capawesome-team/capacitor-file-opener";
import { isURL } from "class-validator";
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

import { useRoom } from "../../hooks/useRoom";

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
  msgLoadingText: string;
  msgPercentage: number;
  msgExtension: FileExtension;
}

const MessageDropdown = ({
  message,
  msg,
  msgFilename,
  msgCategory,
  msgLoadingText,
  msgExtension,
  msgPercentage,
}: MessageDropdownProps) => {
  const { peerId, cancelMessage, deleteMessage } = useRoom();
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (isURL(msg)) {
      setUrl(msg);
    }
  }, [msg, setUrl]);

  const handleOpen = async () => {
    window.open(msg, "_blank");
  };

  const handleDownload = async () => {
    if (Capacitor.getPlatform() === "web") {
      // Create an anchor element for the download
      const link = document.createElement("a");
      link.href = msg;
      link.download = msgFilename; // Replace with your desired file name and extension

      // Append the anchor to the body, trigger click, then remove it
      document.body.appendChild(link);
      link.addEventListener("click", async () => {
        document.body.removeChild(link);
        // await deleteMessage(message.merkleRootHex);
        link.removeEventListener("click", () => {});
      });

      link.click();
    } else {
      const blob = await fetch(msg).then((r) => r.blob());
      const base64 = await readAsDataURL(blob);
      const name = `${String(new Date().getTime())}-${msgFilename.replace("." + msgExtension, "")}.${msgExtension}`;
      try {
        await Filesystem.appendFile({
          path: name,
          data: base64,
          directory: Directory.Data,
        });

        const { uri } = await Filesystem.getUri({
          path: name,
          directory: Directory.Data,
        });

        await FileOpener.openFile({
          path: uri,
        });

        // await Filesystem.writeFile({
        //   path: `Files/P2Party/${String(new Date().getTime())}-${msgFilename.replace("." + msgExtension, "")}.${msgExtension}`,
        //   data: base64,
        //   directory: Directory.Data,
        // });
      } catch (error) {
        console.error(error);
      }
    }
  };

  return (
    <div
      className={`relative my-1 w-auto max-w-full overflow-hidden rounded-lg border-2 p-1 shadow md:max-w-lg ${message.fromPeerId === peerId ? "bg-mediumOrange ml-3 border-black lg:ml-0" : "border-darkOrange mr-3 bg-black lg:mr-0"}`}
    >
      <Dropdown>
        <DropdownButton plain className='size-fit cursor-pointer'>
          {msgCategory === p2party.MessageCategory.Text && url.length === 0 && (
            <Text
              className={`text-left tracking-wide break-words whitespace-pre-line ${message.fromPeerId === peerId ? "font-medium text-black dark:font-semibold dark:text-black" : "font-normal text-white dark:text-white"} text-pretty break-words text-clip hyphens-auto antialiased select-text`}
            >
              {msg as string}
            </Text>
          )}

          {msgCategory === p2party.MessageCategory.Text && url.length > 0 && (
            <Text
              className={`text-left font-semibold tracking-wide text-pretty break-words break-all text-clip hyphens-auto whitespace-normal text-sky-700 underline decoration-sky-400 antialiased select-text dark:font-normal dark:text-sky-400`}
            >
              {msg as string}
            </Text>
          )}

          {msgCategory !== p2party.MessageCategory.Text && (
            <div className='flex w-full items-center justify-between px-2'>
              <Text
                className={`text-left tracking-wide break-words whitespace-pre-wrap ${message.fromPeerId === peerId ? "font-medium text-black dark:font-semibold dark:text-black" : "font-normal text-white dark:text-white"} antialiased`}
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
                await cancelMessage(
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
              await deleteMessage(message.merkleRootHex, message.sha512Hex)
            }
          >
            <TrashIcon />
            Delete
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>

      {/* Loading Line */}
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
    </div>
  );
};

export default MessageDropdown;
