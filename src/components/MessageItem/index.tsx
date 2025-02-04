import { useState, useEffect, FC } from "react";
import { MessageCategory } from "p2party";

import { useRoom } from "../../hooks/useRoom";

import MessageDropdown from "./MessageDropdown";

import type { Message, FileExtension } from "p2party";
import MessageSenderDropdown from "./MessageSenderDropdown";

export interface MessageItemProps {
  message: Message;
}

// const formatBytes = (bytes: number): string => {
//   const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
//   if (bytes === 0) return '0 bytes';

//   const i = Math.floor(Math.log(bytes) / Math.log(1024));
//   let value = bytes / Math.pow(1024, i);

//    // Round to 2 decimals and convert to string to remove trailing zeroes
//   const result = parseFloat(value.toFixed(2)).toString();

//   return `${result} ${units[i]}`;
// }

const MessageItem: FC<MessageItemProps> = ({ message }) => {
  const { peerId, readMessage } = useRoom();

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

  const {
    msg,
    msgSize,
    msgCategory,
    msgPercentage,
    msgExtension,
    msgFilename,
  } = state;

  return (
    <div
      key={message.merkleRootHex}
      className={`mb-6 flex items-center ${
        message.fromPeerId === peerId ? "justify-end" : "justify-start"
      }`}
    >
      {message.fromPeerId !== peerId && (
        <MessageSenderDropdown message={message} />
      )}

      <div className='flex flex-col'>
        {message.fromPeerId !== peerId && (
          <span className='ml-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-300'>
            {message.fromPeerId.slice(0, 8)}
          </span>
        )}

        {message.fromPeerId === peerId && (
          <span className='mr-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-300'>
            {message.fromPeerId.slice(0, 8)}
          </span>
        )}

        <MessageDropdown
          message={message}
          msg={msg}
          msgCategory={msgCategory}
          msgExtension={msgExtension}
          msgSize={msgSize}
          msgFilename={msgFilename}
          msgPercentage={msgPercentage}
        />

        {message.fromPeerId !== peerId && (
          <span className='ml-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-300'>
            {new Date(message.timestamp).toLocaleString()}
          </span>
        )}

        {message.fromPeerId === peerId && (
          <span className='mr-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-300'>
            {new Date(message.timestamp).toLocaleString()}
          </span>
        )}
      </div>

      {message.fromPeerId === peerId && (
        <MessageSenderDropdown message={message} />
      )}
    </div>
  );
};

export default MessageItem;
