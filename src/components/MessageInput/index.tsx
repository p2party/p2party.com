import { useState, useRef, useEffect, useCallback, memo } from "react";

import { Textarea } from "../textarea";
// import { Input } from "../input";
import { Button } from "../button";

import { PaperAirplaneIcon } from "@heroicons/react/24/solid";

import FileButton from "./FileButton";
import MicrophoneButton from "./MicrophoneButton";

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
  const [bottomOffset, setBottomOffset] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);

  // Virtual keyboard handling for mobile browsers
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      // When virtual keyboard opens, visualViewport.height shrinks
      // The offset is the difference between the window inner height and viewport height
      const offset = window.innerHeight - vv.height;
      setBottomOffset(offset > 0 ? offset : 0);

      // Scroll the textarea into view when keyboard opens
      if (offset > 0 && textareaRef.current) {
        requestAnimationFrame(() => {
          textareaRef.current?.scrollIntoView({
            block: "nearest",
            behavior: "smooth",
          });
        });
      }
    };

    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);

    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  // Also handle focus/blur events for iOS Safari
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const onFocus = () => {
      // Small delay to let keyboard open
      setTimeout(() => {
        const vv = window.visualViewport;
        if (vv) {
          const offset = window.innerHeight - vv.height;
          setBottomOffset(offset > 0 ? offset : 0);
        }
        textarea.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }, 300);
    };

    const onBlur = () => {
      // Delay to avoid flash during keyboard dismiss animation
      setTimeout(() => {
        setBottomOffset(0);
      }, 100);
    };

    textarea.addEventListener("focus", onFocus);
    textarea.addEventListener("blur", onBlur);

    return () => {
      textarea.removeEventListener("focus", onFocus);
      textarea.removeEventListener("blur", onBlur);
    };
  }, [channels.length]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"; // reset first so shrinking works
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [newMessage]);

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
          style={{ bottom: bottomOffset }}
          className='fixed right-0 left-0 z-50 shrink-0 border-t-2 border-zinc-950 bg-white px-2 py-2 sm:px-4 sm:py-3 lg:mr-2 lg:ml-64 lg:px-14 dark:border-zinc-200 dark:bg-black'
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
              aria-describedby='message-input-hint'
              resizable={false}
              className='shadow-brutal-sm flex-1 overflow-hidden rounded-none border-2 border-zinc-950 font-medium dark:border-zinc-200'
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
        </div>
      )}
    </>
  );
};

export default memo(MessageInput);
