import { useState, useEffect, memo } from "react";
// import { useNavigate } from "react-router-dom";
import p2party from "p2party";

import { Avatar } from "../avatar";
import { TableRow, TableCell } from "../table";
import { roomInvitePath } from "../../protocol/roomAccess";
import { immediateRoomPolicy } from "../../protocol/v4";

import type { FC } from "react";
import type { FileExtension, UniqueRoom } from "p2party";

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
  // that the 0.13.0 decoder (and roomInvitePath) reject. One legacy record
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

  return (
    <TableRow key={room.roomId} href={inviteHref}>
      <TableCell>
        <div className='flex items-center gap-2'>
          <Avatar
            initials={
              room.roomId.slice(0, 1) +
              room.roomId.slice(room.roomId.length - 1)
            }
            className='size-9'
          />
          <div className='min-w-0'>
            <div className='truncate font-medium'>
              Room {room.roomId.slice(0, 8)}
              {!inviteHref && (
                <span className='ml-2 border-2 border-zinc-400 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.1em] text-zinc-600 uppercase dark:border-zinc-600 dark:text-zinc-400'>
                  protocol v3 — retired
                </span>
              )}
            </div>
            <div className='truncate font-normal'>
              {lastMessage.msgCategory === p2party.MessageCategory.Text
                ? lastMessage.msg.length > 0
                  ? lastMessage.msg.slice(0, 28) + "..."
                  : "No messages yet"
                : lastMessage.msgFilename.length > 0
                  ? lastMessage.msgFilename.slice(0, 15) +
                    "..." +
                    lastMessage.msgExtension
                  : "No messages yet"}
            </div>
          </div>

          <div className='pl-2 md:pl-6'>
            <div className='text-zinc-500'>
              Messages: {room.messageCount > 99 ? "99+" : room.messageCount}
            </div>
            <div className='text-zinc-500'>
              {timeSince(new Date(room.updatedAt))}
            </div>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );

  // return (
  //   >
  //           ? lastMessage.msg.slice(0, 20) + "..."
  //           : lastMessage.msgFilename.slice(0, 15) +
  //             "..." +
  //             lastMessage.msgExtension}
};

export default memo(RoomListItem);
