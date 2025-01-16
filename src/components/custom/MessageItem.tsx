import { useState, useEffect } from "react";
import { MessageCategory } from "p2party";
import {
  // ArrowTopRightOnSquareIcon,
  ArrowDownOnSquareIcon,
  DocumentIcon,
  StopIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";

import { useRoom } from "../../hooks/useRoom";

import { Text } from "../text";
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from "../dropdown";
// import { QRCodeAvatar } from "./qrcodeavatar";

import type { Message, FileExtension } from "p2party";
import { Avatar } from "../avatar";

export interface MessageItemProps {
  message: Message;
}

const truncateFilename = (filename: string, maxLength: number) => {
  if (filename.length <= maxLength) return filename;
  const half = Math.floor((maxLength - 3) / 2); // Reserve space for "..."
  return `${filename.slice(0, half)}...${filename.slice(-half)}`;
};

// const formatBytes = (bytes: number): string => {
//   const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
//   if (bytes === 0) return '0 bytes';

//   const i = Math.floor(Math.log(bytes) / Math.log(1024));
//   let value = bytes / Math.pow(1024, i);

//    // Round to 2 decimals and convert to string to remove trailing zeroes
//   const result = parseFloat(value.toFixed(2)).toString();

//   return `${result} ${units[i]}`;
// }

const MessageItem = ({ message }: MessageItemProps) => {
  const { peerId, readMessage, cancelMessage, deleteMessage } = useRoom();

  const [state, setState] = useState<{
    msg: string;
    msgSize: number;
    msgFilename: string;
    msgCategory: MessageCategory;
    msgPercentage: number;
    msgExtension: FileExtension;
  }>({
    msg: "",
    msgSize: 0,
    msgFilename: "",
    msgCategory: MessageCategory.Text,
    msgPercentage: 0,
    msgExtension: "",
  });

  useEffect(() => {
    const controller = new AbortController();

    const setMessage = async () => {
      const m = await readMessage(message.merkleRootHex);

      if (m.percentage === 100) {
        setState((prevState) => ({
          ...prevState,
          msg:
            typeof m.message === "string"
              ? m.message
              : m.message
                ? URL.createObjectURL(m.message)
                : "",
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
    };

    setMessage();

    return () => {
      controller.abort();

      if (msg.length > 0 && msgCategory !== MessageCategory.Text)
        URL.revokeObjectURL(msg);
    };
  }, [message.merkleRootHex, message.savedSize]);

  const { msg, msgFilename, msgCategory, msgPercentage, msgExtension } = state;

  const handleDownload = async () => {
    // Create an anchor element for the download
    const link = document.createElement("a");
    link.href = msg;
    link.download = msgFilename; // Replace with your desired file name and extension

    // Append the anchor to the body, trigger click, then remove it
    document.body.appendChild(link);
    link.addEventListener("click", async () => {
      document.body.removeChild(link);
      await deleteMessage(message.merkleRootHex);
      link.removeEventListener("click", () => {});
    });

    link.click();
  };

  return (
    <div
      key={message.merkleRootHex}
      className={`flex items-center pb-1 ${
        message.fromPeerId === peerId ? "justify-end" : "justify-start"
      }`}
    >
      {message.fromPeerId !== peerId && (
        <Avatar
          initials={message.fromPeerId.slice(
            message.fromPeerId.length - 2,
            message.fromPeerId.length,
          )}
          className='mr-4 w-10 flex-shrink-0 rounded-full'
        />
      )}
      <div className='relative m-1 w-auto max-w-full overflow-hidden rounded-lg border-2 border-darkOrange bg-darkRed p-1 font-bold shadow md:max-w-lg'>
        <Dropdown>
          <DropdownButton plain>
            {msgCategory === MessageCategory.Text && (
              <Text className='whitespace-pre-wrap break-words text-left text-white dark:text-white'>
                {msg as string}
              </Text>
            )}

            {msgCategory !== MessageCategory.Text && (
              <div className='flex w-full items-center justify-between px-2'>
                <Text className='flex-grow text-left'>
                  {truncateFilename(`${message.filename}.${msgExtension}`, 20)}
                </Text>
                <DocumentIcon className='h-6 w-6 text-gray-500' />
              </div>
            )}
          </DropdownButton>
          <DropdownMenu
            className='min-w-64'
            anchor={
              message.fromPeerId !== peerId ? "bottom start" : "bottom end"
            }
          >
            {msgPercentage === 100 && msgCategory !== MessageCategory.Text && (
              <>
                {message.fromPeerId !== peerId && (
                  <DropdownItem onClick={handleDownload}>
                    <ArrowDownOnSquareIcon />
                    Download file
                  </DropdownItem>
                )}
              </>
            )}

            {msgPercentage < 100 && (
              <DropdownItem
                onClick={async () =>
                  await cancelMessage(
                    message.channelLabel,
                    message.merkleRootHex,
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
      {message.fromPeerId === peerId && (
        <Avatar
          initials={message.fromPeerId.slice(
            message.fromPeerId.length - 2,
            message.fromPeerId.length,
          )}
          className='ml-4 w-10 flex-shrink-0 rounded-full'
        />
      )}
    </div>
  );
};

export default MessageItem;
