"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from "react";

import { useRoom } from "../hooks/useRoom";
import { Badge } from "../components/badge";
import HandshakeStatusBanner from "../components/custom/HandshakeStatusBanner";
import PendingTransfers from "../components/custom/PendingTransfers";
import { unresolvedHandshakeFailures } from "../protocol/handshakeFailures";
import {
  isLayoutOnlyMessageScroll,
  isNearMessageBottom,
  type MessageScrollGeometry,
} from "./chatScroll";

import type { SendMessageResult, MessageTransferHandle } from "../protocol/v4";
import type { TrackedTransfer } from "../protocol/delivery";

const CatAvatar = lazy(() => import("../components/avatars/cat"));
const MessageItem = lazy(() => import("../components/MessageItem"));
const MessageInput = lazy(() => import("../components/MessageInput"));

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
    roomId,
    handshakeStatusByPeer,
    // purgeRoom,
  } = useRoom();

  // A failed handshake is reported by its own banner; showing "waiting for
  // peers" alongside it would contradict the real state. This has to ask the
  // same question the banner asks, or a failure the banner has decided is
  // stale still suppresses "waiting for peers" and the room says nothing at
  // all.
  const hasHandshakeFailure =
    unresolvedHandshakeFailures(handshakeStatusByPeer, peers).length > 0;

  const [isDragging, setIsDragging] = useState(false);
  const [dots, setDots] = useState("");
  const [transfers, setTransfers] = useState<TrackedTransfer[]>([]);
  const [sendError, setSendError] = useState("");

  const messageListRef = useRef<HTMLDivElement>(null);
  const messageContentRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const observedMessageGeometryRef = useRef<MessageScrollGeometry | null>(null);
  const resizeObserverOwnsGeometryRef = useRef(false);
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

  const scrollToMessageBottom = useCallback(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;
    messageList.scrollTop = messageList.scrollHeight;
    stickToBottomRef.current = true;
    observedMessageGeometryRef.current = {
      scrollHeight: messageList.scrollHeight,
      clientHeight: messageList.clientHeight,
      scrollTop: messageList.scrollTop,
    };
  }, []);

  // New messages follow the live edge only while the reader is already there.
  // Unlike scrollIntoView, this cannot scroll the page or jump a reader who is
  // looking at older history.
  useEffect(() => {
    if (stickToBottomRef.current) scrollToMessageBottom();
  }, [messages.length, scrollToMessageBottom]);

  // A channel switch is explicit navigation, so enter the selected thread at
  // its live edge. Per-channel scroll restoration does not exist here; carrying
  // an unrelated numeric scrollTop across threads would be accidental state.
  useEffect(() => {
    stickToBottomRef.current = true;
    scrollToMessageBottom();
  }, [selectedChannel, scrollToMessageBottom]);

  // The composer, keyboard spacer, and auto-growing textarea are normal flex
  // rows, so any of them can resize the message viewport. Preserve the live
  // edge across those geometry changes, but leave a reader who scrolled up at
  // the position they chose.
  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList || typeof ResizeObserver === "undefined") return;

    resizeObserverOwnsGeometryRef.current = true;
    observedMessageGeometryRef.current = {
      scrollHeight: messageList.scrollHeight,
      clientHeight: messageList.clientHeight,
      scrollTop: messageList.scrollTop,
    };
    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) scrollToMessageBottom();
      observedMessageGeometryRef.current = {
        scrollHeight: messageList.scrollHeight,
        clientHeight: messageList.clientHeight,
        scrollTop: messageList.scrollTop,
      };
    });
    observer.observe(messageList);
    if (messageContentRef.current) observer.observe(messageContentRef.current);
    return () => {
      observer.disconnect();
      resizeObserverOwnsGeometryRef.current = false;
      observedMessageGeometryRef.current = null;
    };
  }, [scrollToMessageBottom]);

  const handleMessageListScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const messageList = event.currentTarget;
      const previousGeometry = observedMessageGeometryRef.current;
      const currentGeometry = {
        scrollHeight: messageList.scrollHeight,
        clientHeight: messageList.clientHeight,
        scrollTop: messageList.scrollTop,
      };

      // Chrome and Safari can emit scroll before ResizeObserver when the
      // keyboard or an auto-growing composer shrinks this element. Preserve the
      // pre-resize pin in that case; the observer will restore the live edge.
      if (
        resizeObserverOwnsGeometryRef.current &&
        previousGeometry &&
        isLayoutOnlyMessageScroll(previousGeometry, currentGeometry)
      )
        return;

      stickToBottomRef.current = isNearMessageBottom(messageList);
      observedMessageGeometryRef.current = currentGeometry;
    },
    [],
  );

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
  }, [peers.length, messages.length]);

  const selectedMessages = useMemo(
    () =>
      messages.filter((message) => message.channelLabel === selectedChannel),
    [messages, selectedChannel],
  );

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    // dragleave also fires when moving between children; ignore those.
    if (event.currentTarget.contains(event.relatedTarget as Node | null))
      return;
    setIsDragging(false);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    // A drop ends the drag: without this the overlay stays up forever.
    setIsDragging(false);
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

  // Delivery state now rides on the bubble, so it has to be findable from a
  // message. transferId is sender-only and is exactly the right key: a received
  // message has no delivery state of ours to report.
  const transfersByMessage = useMemo(() => {
    const byTransfer = new Map<string, TrackedTransfer>();
    for (const transfer of transfers)
      byTransfer.set(transfer.handle.transferId, transfer);
    return byTransfer;
  }, [transfers]);

  // Deliberately no auto-dismiss. That was right for a floating card, which
  // had to get out of the way; a caption belongs to the message it labels and
  // should still be there when someone scrolls back to ask whether that file
  // ever arrived.

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
            className={`w-full max-w-3xl transition-opacity duration-500 md:w-4/5 lg:w-3/4 ${
              messages.length > 0
                ? "opacity-[0.09] dark:opacity-[0.14]"
                : "opacity-[0.16] dark:opacity-[0.26]"
            }`}
          />
        </Suspense>
      </div>

      {isDragging && (
        <div className='pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-white/85 lg:left-64 dark:bg-black/85'>
          <div className='border-2 border-dashed border-orange-500 px-8 py-6 text-center'>
            <p className='font-mono text-sm font-bold tracking-[0.15em] text-orange-700 uppercase dark:text-orange-400'>
              Drop to send
            </p>
            <p className='mt-1 text-xs text-zinc-600 dark:text-zinc-400'>
              Files go straight to your peers — never to a server.
            </p>
          </div>
        </div>
      )}

      <div className='relative z-10 flex min-h-0 flex-1 flex-col'>
        <HandshakeStatusBanner />

        {/* The socket is open but the server has not accepted our signed
            identity challenge yet. The library will not request the room's
            peer list until it does, so without this the user sits on
            "Waiting for peers" forever and blames the other person for a
            fault that is entirely on this side. */}
        {signalingServerConnectionState.isConnected &&
          !signalingServerConnectionState.isVerified && (
            <div className='fixed top-[calc(var(--safe-area-inset-top)+4rem)] right-(--safe-area-inset-right) left-(--safe-area-inset-left) z-50 mx-auto flex w-auto max-w-xs items-center justify-center pb-4 lg:left-[calc(var(--safe-area-inset-left)+16rem)]'>
              <Badge
                color='yellow'
                className='shadow-brutal-sm min-h-11 w-full items-center justify-center rounded-none border-2 border-zinc-950 px-4 py-2 text-center font-mono text-xs font-bold tracking-[0.1em] uppercase dark:border-zinc-200'
              >
                Verifying identity{dots}
              </Badge>
            </div>
          )}

        {peers.length === 0 &&
          signalingServerConnectionState.isConnected &&
          signalingServerConnectionState.isVerified &&
          !hasHandshakeFailure && (
            <div className='fixed top-[calc(var(--safe-area-inset-top)+4rem)] right-(--safe-area-inset-right) left-(--safe-area-inset-left) z-50 mx-auto flex w-auto max-w-xs items-center justify-center pb-4 lg:left-[calc(var(--safe-area-inset-left)+16rem)]'>
              <Badge
                color='orange'
                className='shadow-brutal-sm min-h-11 w-full cursor-pointer items-center justify-center rounded-none border-2 border-zinc-950 px-4 py-2 text-center font-mono text-xs font-bold tracking-[0.1em] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 dark:border-zinc-200'
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
          <div className='fixed top-[calc(var(--safe-area-inset-top)+4rem)] right-(--safe-area-inset-right) left-(--safe-area-inset-left) z-50 mx-auto flex w-auto max-w-xs items-center justify-center pb-4 lg:left-[calc(var(--safe-area-inset-left)+16rem)]'>
            <Badge
              color='red'
              className='shadow-brutal-sm min-h-11 w-full cursor-pointer items-center justify-center rounded-none border-2 border-zinc-950 px-4 py-2 text-center font-mono text-xs font-bold tracking-[0.1em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:border-zinc-200'
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
          <div className='fixed top-[calc(var(--safe-area-inset-top)+4rem)] right-(--safe-area-inset-right) left-(--safe-area-inset-left) z-50 mx-auto flex w-auto max-w-xs items-center justify-center pb-4 lg:left-[calc(var(--safe-area-inset-left)+16rem)]'>
            <Badge
              color='green'
              className='shadow-brutal-sm min-h-11 w-full cursor-pointer items-center justify-center rounded-none border-2 border-zinc-950 px-4 py-2 text-center font-mono text-xs font-bold tracking-[0.1em] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500 dark:border-zinc-200'
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

        {/* One scroll owner followed by one measured composer row. Keeping the
            empty list mounted preserves the same geometry before the first
            message instead of switching layout modes. */}
        <div
          ref={messageListRef}
          onScroll={handleMessageListScroll}
          role='log'
          aria-label={`Messages in ${selectedChannel}`}
          aria-live='polite'
          aria-relevant='additions text'
          tabIndex={0}
          className='min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-white dark:bg-black'
        >
          <div ref={messageContentRef} className='flow-root'>
            {selectedMessages.map((message) => (
              <Suspense key={`${message.sha512Hex}-${message.timestamp}`}>
                <MessageItem
                  message={message}
                  roomId={roomId}
                  transfer={
                    message.transferId === undefined
                      ? undefined
                      : transfersByMessage.get(message.transferId)
                  }
                  onCancelTransfer={cancelTransfer}
                />
              </Suspense>
            ))}
          </div>
        </div>

        {sendError && (
          <div
            role='alert'
            className='shadow-brutal-sm relative z-50 mx-3 mb-2 max-w-sm shrink-0 self-end border-2 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-800 lg:mx-5 dark:bg-red-950 dark:text-red-200'
          >
            {sendError}
          </div>
        )}

        <PendingTransfers
          key={roomId}
          roomId={roomId}
          channelLabel={selectedChannel}
          liveTransferIds={transfers
            .filter(
              (transfer) =>
                transfer.status === "preparing" ||
                transfer.status === "cancelling",
            )
            .map((transfer) => transfer.handle.transferId)}
        />
        <Suspense>
          <MessageInput handleFiles={handleFiles} onSend={startTransfer} />
        </Suspense>
      </div>
    </div>
  );
};

export default ChatPage;
