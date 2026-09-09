import { useState, useRef, useLayoutEffect, useCallback, memo } from "react";

import { Textarea } from "../textarea";
// import { Input } from "../input";
import { Button } from "../button";

import { PaperAirplaneIcon } from "@heroicons/react/24/solid";

import FileButton from "./FileButton";
import MicrophoneButton from "./MicrophoneButton";
import { boundedComposerHeight, composerHeightLimit } from "./viewportGeometry";

import { useRoom } from "../../hooks/useRoom";

import type { KeyboardEvent } from "react";

export interface MessageInputProps {
  handleFiles: (files: FileList) => void;
  onSend: (message: string | File, channel: string) => boolean;
}

const MessageInput = ({ handleFiles, onSend }: MessageInputProps) => {
  const { channels, selectedChannel } = useRoom({
    subscribeToMessages: false,
  });

  const [newMessage, setNewMessage] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);

  // The shell owns keyboard avoidance. Only the draft scrolls once it uses
  // a quarter of the available height; never reserve a second keyboard inset.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const shell = inputBarRef.current?.closest("main");
    if (!textarea) return;
    const resize = () => {
      textarea.style.height = "auto";
      const contentHeight = textarea.scrollHeight + 2;
      const availableHeight = shell?.clientHeight ?? window.innerHeight;
      const height = boundedComposerHeight(
        contentHeight,
        composerHeightLimit(availableHeight),
      );
      textarea.style.height = `${height}px`;
      textarea.style.overflowY = contentHeight > height ? "auto" : "hidden";
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (shell) observer.observe(shell);
    return () => observer.disconnect();
  }, [newMessage, channels.length]);

  const handleSend = useCallback(async () => {
    if (newMessage.length === 0) return;
    if (!onSend(newMessage, selectedChannel)) return;
    setNewMessage("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [newMessage, onSend, selectedChannel]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Chat convention: Enter sends, Shift+Enter starts a new line. Ctrl/Cmd
      // +Enter keeps working for anyone used to it. Never send mid-composition
      // — an IME candidate selection also fires Enter.
      if (e.key !== "Enter") return;
      if (e.nativeEvent.isComposing) return;
      if (e.shiftKey) return;
      e.preventDefault();
      handleSend();
    },
    [handleSend],
  );

  return (
    <>
      {channels.length > 0 && (
        <div
          ref={inputBarRef}
          className='relative z-50 w-full shrink-0 border-t-2 border-zinc-950 bg-white px-2 py-1 sm:px-4 sm:py-2 lg:px-14 dark:border-zinc-200 dark:bg-black'
        >
          <div className='flex max-w-full items-end gap-1.5'>
            <FileButton handleFiles={handleFiles} />

            <MicrophoneButton handleFiles={handleFiles} />

            <Textarea
              ref={textareaRef}
              value={newMessage}
              disabled={channels.length === 0}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e)}
              placeholder='Type your message…'
              aria-label='Message'
              aria-describedby='message-input-hint'
              resizable={false}
              style={{ fontSize: "max(16px, 1em)" }}
              className='shadow-brutal-sm min-w-0 flex-1 overflow-hidden rounded-none border-2 border-zinc-950 font-medium dark:border-zinc-200'
              rows={1}
            />
            <Button
              onClick={handleSend}
              color='orange'
              disabled={newMessage.length === 0}
              aria-label='Send message'
              title='Send message'
              className='shadow-brutal-sm shrink-0 cursor-pointer rounded-none border-2 border-zinc-950 dark:border-zinc-200'
            >
              <PaperAirplaneIcon />
            </Button>
          </div>
          <p id='message-input-hint' className='sr-only'>
            Press Enter to send. Press Shift+Enter for a new line.
          </p>
        </div>
      )}
    </>
  );
};

export default memo(MessageInput);
