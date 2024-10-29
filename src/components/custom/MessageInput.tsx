import { useState, useRef, useEffect } from "react";

import { Textarea } from "../textarea";
import { Button } from "../button";

import { PaperAirplaneIcon } from "@heroicons/react/20/solid";

import { useRoom } from "../../hooks/useRoom";

const MessageInput = () => {
  const { channels, messages, selectedChannel, sendMessage } = useRoom();

  const [newMessage, setNewMessage] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.focus();
    }
  }, [messages]);

  const handleSend = () => {
    if (newMessage.trim() === "") return;

    sendMessage(newMessage, selectedChannel);
    setNewMessage("");
  };

  return (
    <>
      {channels.length > 0 && (
        <div className='fixed bottom-0 left-0 right-0 flex-shrink-0 bg-white p-4 pb-6 pt-1 lg:left-64 lg:right-2 dark:bg-zinc-900'>
          <div className='mx-4 flex max-w-full items-center'>
            <Textarea
              ref={textareaRef}
              value={newMessage}
              disabled={channels.length === 0}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder='Type your message...'
              className='mr-2 flex-1 resize-none overflow-hidden rounded-lg font-bold focus:border-white'
              rows={1}
            />
            <Button onClick={handleSend} className='flex-shrink-0 cursor-pointer'>
              <PaperAirplaneIcon />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageInput;
