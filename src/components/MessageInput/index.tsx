import { useState, useRef, useEffect, useCallback, memo } from "react";

import { Textarea } from "../textarea";
// import { Input } from "../input";
import { Button } from "../button";

import { PaperAirplaneIcon } from "@heroicons/react/24/solid";

import FileButton from "./FileButton";
import MicrophoneButton from "./MicrophoneButton";
import { composerBottomOffset } from "./viewportGeometry";

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

  // Keyboard avoidance.
  //
  // The composer is a normal flex row below the message scroller. Where the
  // engine shrinks the LAYOUT viewport for the keyboard -- Chrome Android
  // honouring interactive-widget=resizes-content, or Capacitor with a single
  // inset owner -- the row follows it and this spacer computes to zero. The
  // correction exists for engines that shrink only the VISUAL viewport, iOS
  // Safari above all.
  //
  // iOS can also pan the visual viewport after focus without resizing it.
  // VisualViewport.scroll therefore re-measures offsetTop, but this listener
  // never scrolls the document. The spacer participates in flex layout, so the
  // message row shrinks with it instead of being covered by an overlay.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const updateOffset = () => {
      const inputBar = inputBarRef.current;
      if (!inputBar) {
        setBottomOffset(0);
        return;
      }

      // marginBottom moves the row up; add the rendered margin back to recover
      // the bottom assigned by the shell. Reading both values from the same
      // layout frame also keeps consecutive viewport events idempotent.
      const renderedMargin =
        Number.parseFloat(inputBar.style.marginBottom) || 0;
      const layoutBottom =
        inputBar.getBoundingClientRect().bottom + renderedMargin;
      const offset = composerBottomOffset(
        layoutBottom,
        vv.height,
        vv.offsetTop,
      );
      setBottomOffset((current) => (current === offset ? current : offset));
    };

    updateOffset();
    window.addEventListener("resize", updateOffset);
    vv.addEventListener("resize", updateOffset);
    vv.addEventListener("scroll", updateOffset);
    return () => {
      window.removeEventListener("resize", updateOffset);
      vv.removeEventListener("resize", updateOffset);
      vv.removeEventListener("scroll", updateOffset);
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
          style={{ marginBottom: bottomOffset }}
          className='relative z-50 w-full shrink-0 border-t-2 border-zinc-950 bg-white px-2 py-2 sm:px-4 sm:py-3 lg:px-14 dark:border-zinc-200 dark:bg-black'
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
