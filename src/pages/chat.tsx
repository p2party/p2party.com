"use client";

import { useEffect, useRef } from "react";

import CatAvatar from "../components/avatars/cat";

import { useRoom } from "../hooks/useRoom";
import ChatHeading from "../components/custom/ChatHeader";
import MessageBubble from "../components/custom/MessageBubble";
import MessageInput from "../components/custom/MessageInput";

const ChatPage = () => {
  const { messages, selectedChannel } = useRoom();
  // const [messages, setMessages] = useState<Message[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // useEffect(() => {
  //   if (textareaRef.current) {
  //     textareaRef.current.style.height = "auto";
  //     textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  //   }
  // }, [newMessage]);

  return (
    <div className='relative flex min-h-0 flex-col'>
      <div className='pointer-events-none fixed inset-0 z-0 flex items-center justify-center lg:ml-64'>
        <CatAvatar className='w-full outline-white md:w-5/6 lg:w-1/2 dark:outline-zinc-900' />
      </div>

      <div className='relative z-10 flex min-h-0 flex-1 flex-col'>
        {messages.length > 0 && (
          <>
            <ChatHeading />

            <div className='flex-1 overflow-y-auto overflow-x-hidden bg-white/70 p-4 pt-10 lg:pt-8 dark:bg-zinc-900/90'>
              {/* Messages */}
              {messages.map((message) => {
                console.log(message.channelLabel);
                console.log(selectedChannel);
                if (message.channelLabel === selectedChannel)
                  return <MessageBubble message={message} />;
              })}
              <div ref={messagesEndRef} />
            </div>
          </>
        )}

        <MessageInput />
      </div>
    </div>
  );
};

export default ChatPage;
