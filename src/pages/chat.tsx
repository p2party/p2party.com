"use client";

import { useState, useEffect, useRef } from "react";
import { PaperAirplaneIcon } from "@heroicons/react/16/solid";

import { QRCodeAvatar } from "../components/qrcodeavatar";
import { Textarea } from "../components/textarea";
import { Text } from "../components/text";
import { Button } from "../components/button";

import { getRandomMessages } from "../utils/randomMessages";

export interface Message {
  id: number;
  text: string;
  sender: string;
  avatarUrl: string;
  replyTo: number | null;
}

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    const randomMessages = getRandomMessages();
    setMessages(randomMessages);
  }, []);

  const handleSend = () => {
    if (newMessage.trim() === "") return;

    const message = {
      id: messages.length + 1,
      text: newMessage,
      sender: "user",
      avatarUrl: "https://example.com/avatar2.png", // Replace with the current user's avatar URL
      replyTo: null,
    };

    setMessages([...messages, message]);
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
    <div className='flex h-full flex-col'>
      <div className='flex-1 overflow-auto p-4 pb-24'>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`relative mb-4 flex items-center ${
              message.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.sender !== "user" && (
              <QRCodeAvatar
                src={message.avatarUrl}
                className='mr-4 w-10 rounded-full'
              />
            )}
            <div
              className={`max-w-lg rounded-lg border border-2 border-darkOrange bg-darkRed p-3 font-bold shadow`}
            >
              <Text className='text-white dark:text-white'>{message.text}</Text>
            </div>
            {message.sender === "user" && (
              <QRCodeAvatar
                src={message.avatarUrl}
                className='ml-4 w-10 rounded-full'
              />
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className='fixed bottom-0 left-0 right-0 flex-1 bg-white pb-6 pl-4 pr-4 pt-3 lg:left-64 dark:bg-zinc-900'>
        <div className='ml-4 mr-4 flex max-w-full items-center'>
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
    </div>
  );
};

export default ChatPage;
