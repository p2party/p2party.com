"use client";

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";

import { useRoom } from "../hooks/useRoom";
import { Badge } from "../components/badge";

const CatAvatar = lazy(() => import("../components/avatars/cat"));
const MessageItem = lazy(() => import("../components/MessageItem"));
const MessageInput = lazy(() => import("../components/custom/MessageInput"));

const ChatPage = () => {
  const {
    messages,
    peers,
    signalingServerConnectionState,
    selectedChannel,
    sendMessage,
    connectToSignalingServer,
    disconnectFromSignalingServer,
    // purgeRoom,
  } = useRoom();
  const { roomUrl } = useParams();

  // const [messages, setMessages] = useState<Message[]>([]);

  const [_isDragging, setIsDragging] = useState(false);
  const [dots, setDots] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
        inline: "start",
      });
    }
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) =>
        prev.length < 3 &&
        signalingServerConnectionState.isConnected &&
        (peers.length === 0 || messages.length === 0)
          ? prev + "."
          : "",
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [signalingServerConnectionState.isConnected]);

  useEffect(() => {
    const p = peers.length + 1;
    document.title =
      "P2Party:" + p + " peers, " + messages.length + " messages";
  }, [peers, messages]);

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files) {
      handleFiles(files);
    }
  };

  const handleFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      sendMessage(file, selectedChannel);

      //   const reader = new FileReader();
      //   reader.onload = (e: ProgressEvent<FileReader>) => {
      //     const arrayBuffer = e.target?.result;
      //     if (arrayBuffer && typeof arrayBuffer !== "string") {
      //       const uint8Array = new Uint8Array(arrayBuffer);
      //       // Handle the Uint8Array as needed
      //       console.log("File converted to Uint8Array:", uint8Array);
      //     }
      //   };
      //   reader.readAsArrayBuffer(file);
    });
  };

  // const dropHandler = (ev) => {
  //   console.log("File(s) dropped");
  //
  //   // Prevent default behavior (Prevent file from being opened)
  //   ev.preventDefault();
  //
  //   if (ev.dataTransfer.items) {
  //     // Use DataTransferItemList interface to access the file(s)
  //     [...ev.dataTransfer.items].forEach((item, i) => {
  //       // If dropped items aren't files, reject them
  //       if (item.kind === "file") {
  //         const file = item.getAsFile();
  //         console.log(`… file[${i}].name = ${file.name}`);
  //       }
  //     });
  //   } else {
  //     // Use DataTransfer interface to access the file(s)
  //     [...ev.dataTransfer.files].forEach((file, i) => {
  //       console.log(`… file[${i}].name = ${file.name}`);
  //     });
  //   }
  // };
  //
  // const dragOverHandler = (ev) => {
  //   console.log("File(s) in drop zone");
  //
  //   // Prevent default behavior (Prevent file from being opened)
  //   ev.preventDefault();
  // };

  // useEffect(() => {
  //   if (textareaRef.current) {
  //     textareaRef.current.style.height = "auto";
  //     textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  //   }
  // }, [newMessage]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className='flex max-h-[calc(94svh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom))] min-h-0 flex-col overflow-y-auto scroll-smooth pt-14 lg:my-2 lg:pt-0'
    >
      <div className='pointer-events-none fixed inset-0 z-0 flex items-center justify-center lg:ml-64'>
        <Suspense>
          <CatAvatar className='w-2/3 w-full outline-white md:w-2/3 lg:w-2/5 dark:outline-zinc-900' />
        </Suspense>
      </div>

      <div className='relative flex flex-1 flex-col'>
        {peers.length === 0 && signalingServerConnectionState.isConnected && (
          <div className='fixed top-16 right-0 left-0 z-50 mx-auto flex w-36 items-center justify-center pb-4 lg:left-64'>
            <Badge
              color='orange'
              className='w-full text-center'
              onClick={disconnectFromSignalingServer}
            >
              Waiting for peers{dots}
            </Badge>
          </div>
        )}

        {!signalingServerConnectionState.isConnected && (
          <div className='fixed top-16 right-0 left-0 z-50 mx-auto flex w-64 items-center justify-center pb-4 lg:left-64'>
            <Badge
              color='red'
              className='w-full text-center text-left'
              onClick={() => connectToSignalingServer(roomUrl ?? "")}
            >
              Press to connect to the signaling server and discover new peers
            </Badge>
          </div>
        )}

        {messages.length === 0 && peers.length > 0 && (
          <div className='fixed top-16 right-0 left-0 z-50 mx-auto flex w-48 items-center justify-center pb-4 lg:left-64'>
            <Badge
              color='orange'
              className='w-full text-center text-left'
              onClick={() => {
                signalingServerConnectionState.isConnected
                  ? disconnectFromSignalingServer()
                  : connectToSignalingServer(roomUrl ?? "");
              }}
            >
              Waiting for messages{dots}
            </Badge>
          </div>
        )}

        {messages.length > 0 && (
          <>
            <div className='mb-10 overflow-x-hidden overflow-y-auto overscroll-contain bg-white/70 dark:bg-black/60'>
              {/* Messages */}
              {messages.map((message, i) => {
                if (message.channelLabel === selectedChannel) {
                  return (
                    <Suspense key={i}>
                      <MessageItem message={message} />
                    </Suspense>
                  );
                }
              })}
            </div>
          </>
        )}
      </div>

      <div ref={messagesEndRef} />

      <Suspense>
        <MessageInput handleFiles={handleFiles} />
      </Suspense>
    </div>
  );
};

export default ChatPage;
