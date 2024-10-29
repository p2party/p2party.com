import { useRoom } from "../../hooks/useRoom";

import { Text } from "../text";
import { QRCodeAvatar } from "./qrcodeavatar";

import type { Message } from "p2party";

export interface MessageBubbleProps {
  message: Message;
}

const MessageBubble = ({ message }: MessageBubbleProps) => {
  const { peerId } = useRoom();

  return (
    <div
      key={message.id}
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
      <div className='w-auto max-w-full overflow-hidden rounded-lg border-2 border-darkOrange bg-darkRed p-3 font-bold shadow md:max-w-lg'>
        <Text className='break-words text-white dark:text-white'>
          {message.message}
        </Text>
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
