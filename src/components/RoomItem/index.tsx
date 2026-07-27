import { useState, useEffect, memo } from "react";
// import { useNavigate } from "react-router-dom";
import p2party from "../../protocol/sdk";

import { Avatar } from "../avatar";
import { Link } from "../link";
import { formatBytes } from "../../utils/formatBytes";
import { roomInvitePath } from "../../protocol/roomAccess";
import { immediateRoomPolicy } from "../../protocol/v4";

import type { FC } from "react";
import type { FileExtension, RoomStats, UniqueRoom } from "p2party";

const timeSince = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "week", seconds: 604800 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "min", seconds: 60 },
  ];

  for (const { label, seconds: unitSeconds } of intervals) {
    const count = Math.floor(seconds / unitSeconds);
    if (count >= 1) {
      return `${count} ${label}${count !== 1 ? "s" : ""} ago`;
    }
  }

  return "just now";
};

const RoomListItem: FC<UniqueRoom> = (room) => {
  // No redux subscription here: the row's data comes from the `room` prop, and
  // readMessage is a stable module function. Subscribing to the whole rooms
  // array (via useRoom) would re-render every room row on any store change.
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [lastMessage, setLastMessage] = useState<{
    msg: string;
    msgSize: number;
    msgFilename: string;
    msgCategory: string;
    msgExtension: FileExtension;
  }>({
    msg: "",
    msgSize: 0,
    msgFilename: "",
    msgCategory: p2party.MessageCategory.Text,
    msgExtension: "txt",
  });
  // A room persisted by a pre-v4 build carries a wireVersion-3 policy blob
  // that the protocol-v4 decoder (and roomInvitePath) reject. One legacy record
  // must degrade to a row without an invite link — it must never unmount the
  // whole saved-rooms list (there is no error boundary above this row).
  let inviteHref: string | undefined;
  try {
    const roomPolicy = room.roomPolicy
      ? p2party.decodeRoomPolicyV1(new Uint8Array(room.roomPolicy))
      : immediateRoomPolicy("nopin");
    inviteHref = roomInvitePath(room.roomUrl, roomPolicy);
  } catch {
    inviteHref = undefined;
  }

  useEffect(() => {
    if (!room.lastMessageMerkleRoot || room.lastMessageMerkleRoot.length === 0)
      return;

    let cancelled = false;

    const setMessage = async () => {
      try {
        // Metadata only — the list preview shows a text snippet or a filename,
        // never the file itself, so do NOT materialize (which would reassemble
        // the whole file to OPFS just to render a row).
        const m = await p2party.readMessage(
          room.lastMessageMerkleRoot,
          undefined,
          false,
        );
        if (cancelled) return;
        setLastMessage((prevState) => ({
          ...prevState,
          msg: typeof m.message === "string" ? m.message : "",
          msgSize: m.size,
          msgFilename: m.filename,
          msgCategory: m.category,
          msgExtension: m.extension,
        }));
      } catch (error) {
        console.error(error);
      }
    };

    setMessage();

    return () => {
      cancelled = true;
    };
  }, [room.lastMessageMerkleRoot]);

  useEffect(() => {
    let cancelled = false;

    // Defensive on purpose. getRoomStats arrived in 0.14.2, so a host running
    // an older SDK -- or a dev server holding a stale copy in its module cache
    // -- would throw a TypeError inside this effect. There is no error
    // boundary above the room list, so that one row would unmount the whole
    // app and leave a blank page that survives navigating back. A summary is
    // decoration; it must never be able to take the page down with it.
    try {
      const pending = p2party.getRoomStats?.(room.roomId);
      if (!pending) return;
      void pending
        .then((result) => {
          if (!cancelled) setStats(result);
        })
        .catch(() => {
          // Showing nothing beats showing zeroes that look like real history.
          if (!cancelled) setStats(null);
        });
    } catch {
      // stats is already null, so there is nothing to set -- and setting state
      // synchronously inside an effect would only trigger a cascading render.
      // Swallowing here is the whole point: the row must not take the app down.
    }

    return () => {
      cancelled = true;
    };
  }, [room.roomId]);

  const preview =
    lastMessage.msgCategory === p2party.MessageCategory.Text
      ? lastMessage.msg.length > 0
        ? lastMessage.msg
        : "No messages yet"
      : lastMessage.msgFilename.length > 0
        ? lastMessage.msgFilename + lastMessage.msgExtension
        : "No messages yet";

  // A retired-protocol room has no reachable invite, so it is a record rather
  // than a destination. Rendering it as a link that goes nowhere is worse than
  // rendering it as text that says why.
  const body = (
    <div className='flex items-center gap-3'>
      <Avatar
        initials={
          room.roomId.slice(0, 1) + room.roomId.slice(room.roomId.length - 1)
        }
        className='size-9 shrink-0'
      />

      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          <span className='truncate font-mono text-sm font-bold text-zinc-950 dark:text-white'>
            {room.roomId.slice(0, 8)}
          </span>
          {!inviteHref && (
            <span className='shrink-0 border-2 border-zinc-400 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.1em] text-zinc-600 uppercase dark:border-zinc-600 dark:text-zinc-400'>
              retired
            </span>
          )}
        </div>
        <p className='truncate text-sm text-zinc-600 dark:text-zinc-300'>
          {preview}
        </p>
      </div>

      <div className='hidden shrink-0 text-right font-mono text-[11px] text-zinc-500 sm:block dark:text-zinc-400'>
        {stats ? (
          <>
            <div className='text-zinc-950 dark:text-white'>
              {formatBytes(stats.bytesTotal)}
            </div>
            <div title='sent · received'>
              &uarr;{formatBytes(stats.bytesSent)} &darr;
              {formatBytes(stats.bytesReceived)}
            </div>
            <div>
              {stats.messageCount} msg{stats.messageCount === 1 ? "" : "s"} ·{" "}
              {stats.peerIds.length} peer
              {stats.peerIds.length === 1 ? "" : "s"}
            </div>
          </>
        ) : (
          <div>
            {room.messageCount} msg{room.messageCount === 1 ? "" : "s"}
          </div>
        )}
        <div>{timeSince(new Date(room.updatedAt))}</div>
      </div>
    </div>
  );

  return (
    <li>
      {inviteHref ? (
        <Link
          href={inviteHref}
          className='shadow-brutal-sm block border-2 border-zinc-950 bg-white p-3 transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 active:translate-x-0 active:translate-y-0 motion-reduce:transition-none dark:border-zinc-200 dark:bg-zinc-950'
        >
          {body}
        </Link>
      ) : (
        <div className='block border-2 border-zinc-300 bg-zinc-50 p-3 opacity-70 dark:border-zinc-700 dark:bg-zinc-900'>
          {body}
        </div>
      )}
    </li>
  );
  // return (
  //   >
  //           ? lastMessage.msg.slice(0, 20) + "..."
  //           : lastMessage.msgFilename.slice(0, 15) +
  //             "..." +
  //             lastMessage.msgExtension}
};

export default memo(RoomListItem);
