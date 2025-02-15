import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";

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
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid";
import { MessageCategory } from "p2party";

import { useRoom } from "../../hooks/useRoom";

import type { Message, FileExtension } from "p2party";

const truncateFilename = (filename: string, maxLength: number) => {
  if (filename.length <= maxLength) return filename;
  const half = Math.floor((maxLength - 3) / 2); // Reserve space for "..."
  return `${filename.slice(0, half)}...${filename.slice(-half)}`;
};

export interface MessageDropdownProps {
  message: Message;
  msg: string;
  msgSize: number;
  msgFilename: string;
  msgCategory: MessageCategory;
  msgPercentage: number;
  msgExtension: FileExtension;
}

const MessageDropdown = ({
  message,
  msg,
  msgFilename,
  msgCategory,
  msgExtension,
  msgPercentage,
}: MessageDropdownProps) => {
  const { peerId, cancelMessage, deleteMessage } = useRoom();

  const handleOpen = async () => {
    window.open(msg, "_blank");
  };

  const handleDownload = async () => {
    if (Capacitor.getPlatform() === "web") {
      console.log("WE ARE HERE");

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
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      const base64 = reader.result as string;
      await Filesystem.writeFile({
        path: `Files/P2Party/${new Date().getTime()}-${msgFilename.replace("." + msgExtension, "")}.${msgExtension}`,
        data: base64,
        directory: Directory.External,
      });
    }
  };

  return (
    <div
      className={`relative my-1 w-auto max-w-full overflow-hidden rounded-lg border-2 p-1 font-bold shadow md:max-w-lg ${message.fromPeerId === peerId ? "border-darkOrange bg-orange-950" : "border-darkOrange bg-black"}`}
    >
      <Dropdown>
        <DropdownButton plain>
          {msgCategory === MessageCategory.Text && (
            <Text
              className={`text-left break-words whitespace-pre-wrap text-white dark:text-white`}
            >
              {msg as string}
            </Text>
          )}

          {msgCategory !== MessageCategory.Text && (
            <div className='flex w-full items-center justify-between px-2'>
              <Text className='flex-grow text-left'>
                {truncateFilename(`${msgFilename}.${msgExtension}`, 20)}
              </Text>
              <DocumentIcon className='h-6 w-6 text-gray-500' />
            </div>
          )}
        </DropdownButton>
        <DropdownMenu
          className='min-w-64'
          anchor={message.fromPeerId !== peerId ? "bottom start" : "bottom end"}
        >
          {msgPercentage === 100 && msgCategory !== MessageCategory.Text && (
            <>
              {message.fromPeerId !== peerId && (
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
            </>
          )}

          {msgPercentage < 100 && (
            <DropdownItem
              onClick={async () =>
                await cancelMessage(message.channelLabel, message.merkleRootHex)
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
            onClick={async () => await deleteMessage(message.merkleRootHex)}
          >
            <TrashIcon />
            Delete
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>

      {/* Loading Line */}
      {msgPercentage < 100 && (
        <div className='absolute bottom-0 left-0 w-full'>
          <div className='h-2 w-full bg-gray-200'>
            <div
              className='h-full bg-blue-500 transition-all duration-300'
              style={{ width: `${msgPercentage}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageDropdown;
