"use client";

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";

import { useRoom } from "../hooks/useRoom";
import { Badge } from "../components/badge";

const CatAvatar = lazy(() => import("../components/avatars/cat"));
const MessageItem = lazy(() => import("../components/MessageItem"));
const MessageInput = lazy(() => import("../components/MessageInput"));

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

  const [messageCount, setMessageCount] = useState(0);
  const [, setIsDragging] = useState(false);
  const [dots, setDots] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // const handleUnload = () => {
  //   let connected = localStorage.getItem("connected-rooms") ?? "";
  //   if (connected.indexOf(roomId) > -1) {
  //     connected = connected.replace(roomId, "");
  //   }
  //   connected = connected.replace(",,", ",");
  //   if (connected[0] === ",") connected = connected.slice(1);
  //
  //   localStorage.setItem("connected-rooms", connected);
  //   console.log(connected);
  // }
  //
  // window.addEventListener("popstate", handleUnload);
  //
  // return () => {
  //   window.removeEventListener("popstate", handleUnload);
  // }

  // useEffect(() => {
  //   let connected = localStorage.getItem("connected-rooms");
  //   if (!connected) {
  //     connected = "";
  //   } else if (connected[0] === ",") {
  //     connected = connected.slice(1);
  //   }
  //
  //   if (roomId.length > 0 && connected.indexOf(roomId) === -1) {
  //     connected += roomId + ",";
  //     localStorage.setItem("connected-rooms", connected);
  //   }
  // }, [roomId]);

  useEffect(() => {
    const scroll = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView(
          // false
          {
            block: "end",
            behavior: "smooth",
            inline: "nearest",
          },
        );
      }
    };

    if (messageCount === 0 && messages.length > 0) {
      setTimeout(() => {
        scroll();

        setMessageCount(messages.length);
      }, 500);
    } else {
      scroll();
    }
  }, [messageCount, messages.length]);

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
  }, [
    signalingServerConnectionState.isConnected,
    peers.length,
    messages.length,
  ]);

  useEffect(() => {
    const p = peers.length + 1;
    document.title =
      "P2Party: " + p + " peers, " + messages.length + " messages";
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
      className='relative flex min-h-0 flex-1 flex-col overflow-hidden pt-14 lg:my-2 lg:pt-0'
    >
      <div className='pointer-events-none fixed inset-0 z-0 flex items-center justify-center lg:right-2 lg:left-64'>
        <Suspense>
          <CatAvatar
            className={`w-full transition-opacity duration-500 md:w-2/3 lg:w-2/5 ${
              messages.length > 0
                ? "opacity-[0.22] dark:opacity-[0.20]"
                : "opacity-[0.15] dark:opacity-[0.12]"
            }`}
          />
        </Suspense>
      </div>

      <div className='relative z-10 flex min-h-0 flex-1 flex-col'>
        {peers.length === 0 && signalingServerConnectionState.isConnected && (
          <div className='fixed top-16 right-0 left-0 z-50 mx-auto flex w-auto max-w-xs items-center justify-center pb-4 lg:left-64'>
            <Badge
              color='orange'
              className='w-full animate-pulse cursor-pointer text-center shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500'
              role='button'
              tabIndex={0}
              onClick={disconnectFromSignalingServer}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  disconnectFromSignalingServer();
                }
              }}
            >
              Waiting for peers{dots}
            </Badge>
          </div>
        )}

        {!signalingServerConnectionState.isConnected && (
          <div className='fixed top-16 right-0 left-0 z-50 mx-auto flex w-auto max-w-xs items-center justify-center pb-4 lg:left-64'>
            <Badge
              color='red'
              className='w-full cursor-pointer text-center shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500'
              role='button'
              tabIndex={0}
              onClick={() => connectToSignalingServer(roomUrl ?? "")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  connectToSignalingServer(roomUrl ?? "");
                }
              }}
            >
              Press to connect to the signaling server and discover new peers
            </Badge>
          </div>
        )}

        {messages.length === 0 && peers.length > 0 && (
          <div className='fixed top-16 right-0 left-0 z-50 mx-auto flex w-auto max-w-xs items-center justify-center pb-4 lg:left-64'>
            <Badge
              color='green'
              className='w-full cursor-pointer text-center shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500'
              role='button'
              tabIndex={0}
              onClick={() => {
                if (signalingServerConnectionState.isConnected) {
                  disconnectFromSignalingServer();
                } else {
                  connectToSignalingServer(roomUrl ?? "");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (signalingServerConnectionState.isConnected) {
                    disconnectFromSignalingServer();
                  } else {
                    connectToSignalingServer(roomUrl ?? "");
                  }
                }
              }}
            >
              Connected with user {peers[peers.length - 1].peerId.slice(0, 8)}{" "}
              and waiting for messages {dots}
            </Badge>
          </div>
        )}

        {messages.length > 0 && (
          <div className='mb-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg bg-white/35 pb-24 backdrop-blur-sm dark:bg-black/35'>
            {messages
              .filter((message) => message.channelLabel === selectedChannel)
              .map((message) => (
                <Suspense key={`${message.sha512Hex}-${message.timestamp}`}>
                  <MessageItem message={message} />
                </Suspense>
              ))}
            <div
              ref={messagesEndRef}
              className='scroll-mb-24 md:scroll-mb-24 lg:scroll-mb-28'
            />
          </div>
        )}
      </div>

      <Suspense>
        <MessageInput handleFiles={handleFiles} />
      </Suspense>
    </div>
  );
};

export default ChatPage;
