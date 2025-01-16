"use client";

import { useState, useEffect, useRef } from "react";

import CatAvatar from "../components/avatars/cat";
// import ChatHeading from "../components/custom/ChatHeader";
// import MessageBubble from "../components/custom/MessageBubble";
import MessageItem from "../components/custom/MessageItem";
import MessageInput from "../components/custom/MessageInput";

import { useRoom } from "../hooks/useRoom";
import { Badge } from "../components/badge";

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
  // const [messages, setMessages] = useState<Message[]>([]);

  const [_isDragging, setIsDragging] = useState(false);
  const [dots, setDots] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // useEffect(() => {
  //   window.addEventListener("beforeunload", purgeRoom);
  //   return () => {
  //     window.removeEventListener("beforeunload", purgeRoom);
  //   };
  // }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
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
    document.title =
      "P2Party:" + peers.length + " peers, " + messages.length + " messages";
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
      className='relative flex min-h-0 flex-col'
    >
      <div className='pointer-events-none fixed inset-0 z-0 flex items-center justify-center'>
        <CatAvatar className='w-full outline-white md:w-5/6 lg:w-2/5 dark:outline-zinc-900' />
      </div>

      <div className='relative z-10 flex min-h-0 flex-1 flex-col pb-1'>
        {peers.length === 0 && signalingServerConnectionState.isConnected && (
          <div className='mx-auto flex w-36 items-center justify-center'>
            <Badge
              color='orange'
              className='w-full text-center'
              onClick={() => disconnectFromSignalingServer()}
            >
              Waiting for peers{dots}
            </Badge>
          </div>
        )}

        {peers.length === 0 && !signalingServerConnectionState.isConnected && (
          <div className='mx-auto flex w-48 items-center justify-center pb-4'>
            <Badge
              color='red'
              className='w-full text-left text-center'
              onClick={() => connectToSignalingServer()}
            >
              Connect to the signaling server to discover and be discoverred by
              peers
            </Badge>
          </div>
        )}

        {messages.length === 0 && peers.length > 0 && (
          <div className='mx-auto flex w-48 items-center justify-center pb-4'>
            <Badge color='orange' className='w-full text-left text-center'>
              Waiting for messages{dots}
            </Badge>
          </div>
        )}

        {messages.length > 0 && (
          <>
            <div className='flex-1 overflow-y-auto overflow-x-hidden bg-white/70 px-1 pb-9 pt-1 lg:px-4 lg:pt-8 dark:bg-zinc-900/90'>
              {/* Messages */}
              {messages.map((message) => {
                // console.log(message.channelLabel);
                // console.log(selectedChannel);
                if (message.channelLabel === selectedChannel)
                  // return <MessageBubble message={message} />;
                  return <MessageItem message={message} />;
              })}
            </div>
            <div ref={messagesEndRef} />
          </>
        )}

        <MessageInput handleFiles={handleFiles} />
      </div>
    </div>
  );
};

export default ChatPage;
