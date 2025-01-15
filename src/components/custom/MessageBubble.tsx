import { useState, useEffect } from "react";
import { MessageCategory } from "p2party";

import { useRoom } from "../../hooks/useRoom";

import { Text } from "../text";
import { QRCodeAvatar } from "./qrcodeavatar";

// import AudioPlayer from "./AudioPlayer";
// import VideoPlayer from "./VideoPlayer";
import PDF from "./PDF";
// import Image from "./Image";

import type { Message, FileExtension, MimeType } from "p2party";

export interface MessageBubbleProps {
  message: Message;
}

const MessageBubble = ({ message }: MessageBubbleProps) => {
  const { peerId, readMessage } = useRoom();

  const [state, setState] = useState<{
    msg: string | Blob;
    msgCategory: MessageCategory;
    msgPercentage: number;
    msgExtension: FileExtension;
    msgMimeType: MimeType;
  }>({
    msg: "",
    msgCategory: MessageCategory.Text,
    msgPercentage: 0,
    msgExtension: "",
    msgMimeType: "text/plain",
  });

  useEffect(() => {
    const controller = new AbortController();

    const setMessage = async () => {
      const m = await readMessage(message.merkleRootHex);

      // console.log(m.category);
      // console.log(m.percentage);
      // console.log(m.hashMatches);

      if (m.percentage === 100) {
        setState((prevState) => ({
          ...prevState,
          msg: m.message,
          msgCategory: m.category,
          msgExtension: m.extension,
          msgMimeType: m.mimeType,
          msgPercentage: m.percentage,
        }));
      } else {
        setState((prevState) => ({
          ...prevState,
          msgCategory: m.category,
          msgExtension: m.extension,
          msgMimeType: m.mimeType,
          msgPercentage: m.percentage,
        }));
      }
    };

    setMessage();

    return () => {
      controller.abort();
    };
  }, [message.merkleRootHex, message.savedSize]);

  const { msg, msgCategory, msgPercentage, msgExtension, msgMimeType } = state;

  return (
    <div
      key={message.merkleRootHex}
      className={`mb-4 flex items-center ${
        message.fromPeerId === peerId ? "justify-end" : "justify-start"
      }`}
    >
      {message.fromPeerId !== peerId && (
        <QRCodeAvatar
          src={message.fromPeerId}
          className='mr-4 w-10 flex-shrink-0 rounded-full'
        />
      )}
      <div className='relative w-auto max-w-full overflow-hidden rounded-lg border-2 border-darkOrange bg-darkRed p-3 font-bold shadow md:max-w-lg'>
        {msgCategory === MessageCategory.Text && (
          <Text className='break-words whitespace-pre-wrap text-white dark:text-white'>
            {msg as string}
          </Text>
        )}

        {/* {msgCategory === MessageCategory.Image && (
          <Image
            blob={msg as Blob}
            percentage={msgPercentage}
            filename={message.filename}
            extension={msgExtension}
            mimeType={msgMimeType}
            className='h-40 w-40'
          />
        )}

        {msgCategory === MessageCategory.Audio && (
          <AudioPlayer
            blob={msg as Blob}
            percentage={msgPercentage}
            className='w-10'
          />
        )}

        {msgCategory === MessageCategory.Video && (
          <VideoPlayer src={msg} title={message.merkleRootHex} />
        )} */}

        {(msgCategory === MessageCategory.Document ||
          msgCategory === MessageCategory.Image ||
          msgCategory === MessageCategory.Audio ||
          msgCategory === MessageCategory.Video) && (
          <PDF
            blob={msg as Blob}
            filename={message.filename}
            extension={msgExtension}
            mimeType={msgMimeType}
            percentage={msgPercentage}
            className='h-8 w-8'
          />
        )}

        {/* Loading Line */}
        {msgPercentage < 100 && (
          <div className='absolute bottom-0 left-0 w-full'>
            <div className='h-1 w-full bg-gray-200'>
              <div
                className='h-full bg-blue-500 transition-all duration-300'
                style={{ width: `${msgPercentage}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
      {message.fromPeerId === peerId && (
        <QRCodeAvatar
          src={message.fromPeerId}
          className='ml-4 w-10 flex-shrink-0 rounded-full'
        />
      )}
    </div>
  );
};

export default MessageBubble;
