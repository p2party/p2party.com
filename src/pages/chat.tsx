"use client";

import { useState, useEffect, useRef } from "react";
import { PaperAirplaneIcon } from "@heroicons/react/16/solid";

import { QRCodeAvatar } from "../components/custom/qrcodeavatar";
import { Textarea } from "../components/textarea";
import { Text } from "../components/text";
import { Button } from "../components/button";
import CatAvatar from "../components/avatars/cat";

// import { getRandomMessages } from "../utils/randomMessages";
import { useRoom } from "../hooks/useRoom";

const ChatPage = () => {
  const { peerId, channels, messages, sendMessage } = useRoom();
  // const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  // useEffect(() => {
  //   const randomMessages = getRandomMessages();
  //   setMessages(randomMessages);
  // }, []);

  const handleSend = () => {
    if (newMessage.trim() === "") return;

    sendMessage(newMessage);

    setNewMessage("");
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    if (textareaRef.current) {
      textareaRef.current.focus();
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
        {/* Messages Container */}
        {messages.length > 0 && (
          <div
            className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-white/70 dark:bg-zinc-900/90"
          >
            {/* Messages */}
            {messages.map((message) => (
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

                <div ref={messagesEndRef} />
              </div>
            ))}
          </div>
        )}

        {channels.length > 0 && (
          <div className='fixed bottom-0 left-0 lg:left-64 right-0 p-4 flex-shrink-0 bg-white pt-1 dark:bg-zinc-900'>
            <div className='mx-4 flex max-w-full items-center'>
              <Textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder='Type your message...'
                className='mr-2 flex-1 resize-none overflow-hidden rounded-lg font-bold focus:border-white'
                rows={1}
              />
              <Button onClick={handleSend} className='flex-shrink-0'>
                <PaperAirplaneIcon />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
