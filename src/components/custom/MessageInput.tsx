import { useState, useRef, useEffect } from "react";

import { Textarea } from "../textarea";
// import { Input } from "../input";
import { Button } from "../button";

import { PaperAirplaneIcon } from "@heroicons/react/20/solid";
import { PaperClipIcon } from "@heroicons/react/24/solid";

import { useRoom } from "../../hooks/useRoom";

import type { KeyboardEvent } from "react";

export interface MessageInputProps {
  handleFiles: (files: FileList) => void;
}

const MessageInput = ({ handleFiles }: MessageInputProps) => {
  const { channels, messages, selectedChannel, sendMessage } = useRoom();

  const [newMessage, setNewMessage] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.focus();
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.focus();
    }
  }, [messages]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) handleFiles(files);
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleSend = () => {
    // if (newMessage.trim() === "") return;

    sendMessage(newMessage, selectedChannel);
    setNewMessage("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSend();
    }
    // else if (e.key === "Enter" || e.key === "Return") {
    //   setNewMessage(newMessage + "\n");
    // }
  };

  return (
    <>
      {channels.length > 0 && (
        <div className='fixed bottom-0 left-0 right-0 flex-shrink-0 bg-white pb-6 pt-1 lg:ml-64 lg:px-20 dark:bg-zinc-900'>
          <div className='mx-4 flex max-w-full items-center'>
            <input
              type='file'
              ref={fileInputRef}
              onChange={handleFileSelect}
              className='hidden'
              multiple
            />

            <Button
              plain
              onClick={handleFileClick}
              className='fixed inset-y-0 left-0 cursor-pointer rounded-l-lg'
            >
              <PaperClipIcon />
            </Button>
            <Textarea
              // <Input
              ref={textareaRef}
              value={newMessage}
              disabled={channels.length === 0}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e)}
              placeholder='Type your message...'
              resizable={false}
              className='mr-2 flex-1 overflow-hidden font-bold focus:border-white'
              rows={1}
            />
            <Button
              onClick={handleSend}
              className='flex-shrink-0 cursor-pointer'
            >
              <PaperAirplaneIcon />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageInput;
