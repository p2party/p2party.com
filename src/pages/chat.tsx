"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";

import { useRoom } from "../hooks/useRoom";
import { Badge } from "../components/badge";

import type { SendMessageResult, MessageTransferHandle } from "../protocol/v3";
import type { TrackedTransfer } from "../components/TransferTray";

const CatAvatar = lazy(() => import("../components/avatars/cat"));
const MessageItem = lazy(() => import("../components/MessageItem"));
const MessageInput = lazy(() => import("../components/MessageInput"));
const TransferTray = lazy(() => import("../components/TransferTray"));

const deliveryResultFrom = (error: unknown): SendMessageResult | undefined => {
  if (!error || typeof error !== "object" || !("result" in error))
    return undefined;
  return (error as { result?: SendMessageResult }).result;
};

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : "Message transfer failed";

const terminalStatus = (
  result: SendMessageResult | undefined,
): TrackedTransfer["status"] => {
  if (!result || result.outcomes.length === 0) return "failed";
  const delivered = result.outcomes.filter(
    (outcome) => outcome.status === "delivered",
  ).length;
  if (delivered === result.outcomes.length) return "delivered";
  if (delivered > 0) return "partial";
  return "failed";
};

const ChatPage = () => {
  const {
    messages,
    peers,
    signalingServerConnectionState,
    selectedChannel,
    sendMessage,
    connectToSignalingServer,
    disconnectFromSignalingServer,
    roomUrl,
    // purgeRoom,
  } = useRoom();

  const [messageCount, setMessageCount] = useState(0);
  const [, setIsDragging] = useState(false);
  const [dots, setDots] = useState("");
  const [transfers, setTransfers] = useState<TrackedTransfer[]>([]);
  const [sendError, setSendError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cancelledTransfersRef = useRef(new Set<string>());

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

  const startTransfer = useCallback(
    (payload: string | File, channel: string): boolean => {
      setSendError("");
      let handle: MessageTransferHandle;
      try {
        handle = sendMessage(payload, channel);
      } catch (error) {
        setSendError(errorText(error));
        return false;
      }

      const label =
        typeof payload === "string"
          ? payload.length > 36
            ? `${payload.slice(0, 36)}…`
            : payload
          : payload.name;
      setTransfers((current) => [
        ...current,
        { handle, label, status: "preparing" },
      ]);

      void handle.done.then(
        (result) => {
          setTransfers((current) =>
            current.map((transfer) =>
              transfer.handle.transferId === handle.transferId
                ? {
                    ...transfer,
                    status: cancelledTransfersRef.current.has(handle.transferId)
                      ? "cancelled"
                      : terminalStatus(result),
                    result,
                    error:
                      result === undefined
                        ? "The transfer ended without a delivery result."
                        : undefined,
                  }
                : transfer,
            ),
          );
        },
        (error) => {
          const result = deliveryResultFrom(error);
          setTransfers((current) =>
            current.map((transfer) =>
              transfer.handle.transferId === handle.transferId
                ? {
                    ...transfer,
                    status: cancelledTransfersRef.current.has(handle.transferId)
                      ? "cancelled"
                      : terminalStatus(result),
                    result,
                    error: errorText(error),
                  }
                : transfer,
            ),
          );
        },
      );

      return true;
    },
    [sendMessage],
  );

  const handleFiles = useCallback(
    (files: FileList) => {
      Array.from(files).forEach((file) => {
        startTransfer(file, selectedChannel);
      });
    },
    [selectedChannel, startTransfer],
  );

  const cancelTransfer = useCallback(
    (transferId: string) => {
      const transfer = transfers.find(
        (candidate) => candidate.handle.transferId === transferId,
      );
      if (!transfer) return;
      cancelledTransfersRef.current.add(transferId);
      setTransfers((current) =>
        current.map((candidate) =>
          candidate.handle.transferId === transferId
            ? { ...candidate, status: "cancelling" }
            : candidate,
        ),
      );
      void transfer.handle.cancel().catch((error) => {
        setTransfers((current) =>
          current.map((candidate) =>
            candidate.handle.transferId === transferId
              ? {
                  ...candidate,
                  status: "failed",
                  error: errorText(error),
                }
              : candidate,
          ),
        );
      });
    },
    [transfers],
  );

  const dismissTransfer = useCallback((transferId: string) => {
    cancelledTransfersRef.current.delete(transferId);
    setTransfers((current) =>
      current.filter((transfer) => transfer.handle.transferId !== transferId),
    );
  }, []);

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
        <TransferTray
          messages={messages}
          transfers={transfers}
          onCancel={cancelTransfer}
          onDismiss={dismissTransfer}
        />
      </Suspense>

      {sendError && (
        <div
          role='alert'
          className='fixed right-3 bottom-24 z-50 max-w-sm rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-md lg:right-5 lg:bottom-28 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
        >
          {sendError}
        </div>
      )}

      <Suspense>
        <MessageInput handleFiles={handleFiles} onSend={startTransfer} />
      </Suspense>
    </div>
  );
};

export default ChatPage;
