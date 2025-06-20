import { useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
import p2party from "p2party";

import { Avatar } from "../avatar";
import { TableRow, TableCell } from "../table";

import { useRoom } from "../../hooks/useRoom";

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
  const { readMessage } = useRoom();

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

  useEffect(() => {
    const controller = new AbortController();

    const setMessage = async () => {
      const m = await readMessage(room.lastMessageMerkleRoot);

      if (m.percentage === 100) {
        setLastMessage((prevState) => ({
          ...prevState,
          msg:
            typeof m.message === "string"
              ? m.message
              : m.message
                ? URL.createObjectURL(m.message)
                : "",
          msgSize: m.size,
          msgFilename: m.filename,
          msgCategory: m.category,
          msgExtension: m.extension,
        }));
      } else {
        setLastMessage((prevState) => ({
          ...prevState,
          msgSize: m.size,
          msgFilename: m.filename,
          msgCategory: m.category,
          msgExtension: m.extension,
        }));
      }
    };

    setMessage();

    return () => {
      controller.abort();

      if (
        lastMessage.msg.length > 0 &&
        lastMessage.msgCategory !== p2party.MessageCategory.Text
      )
        URL.revokeObjectURL(lastMessage.msg);
    };
  }, [room.lastMessageMerkleRoot]);

  return (
    <TableRow key={room.roomId} href={`/rooms/${room.roomUrl}`}>
      <TableCell>
        <div className='flex items-center gap-2'>
          <Avatar
            initials={
              room.roomId.slice(0, 1) +
              room.roomId.slice(room.roomId.length - 1)
            }
            className='size-9'
          />
          <div>
            <div className='font-medium'>
              p2party.com/rooms/
              {room.roomUrl.slice(0, 3) +
                ".." +
                room.roomUrl.slice(room.roomUrl.length - 2)}
            </div>
            <div className='font-normal'>
              {lastMessage.msg.length > 0
                ? lastMessage.msgCategory === p2party.MessageCategory.Text
                  ? lastMessage.msg.slice(0, 28) + "..."
                  : lastMessage.msgFilename.slice(0, 15) +
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
  //   <li
  //     onClick={() => navigate("/rooms/" + room.roomUrl)}
  //     className='group relative flex cursor-pointer items-center justify-between gap-x-6 px-4 py-4 transition hover:bg-gray-50/30 dark:hover:bg-zinc-800'
  //   >
  //     {/* Left Section (Room ID & Timestamp) */}
  //     <div className='min-w-0 flex-auto'>
  //       <p className='text-base font-semibold text-gray-900 dark:text-white'>
  //         <a href={room.roomUrl} className='hover:underline'>
  //           {room.roomId}
  //         </a>
  //       </p>
  //       <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
  //         Created: {new Date(room.createdAt).toLocaleString()}
  //       </p>
  //     </div>
  //
  //
  //       <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
  //         Updated: {new Date(room.updatedAt).toLocaleString()}
  //       </p>
  //
  //     {/* Right Section (Message Count & Last Hash) */}
  //     <div className='flex flex-col items-end'>
  //       <p className='text-sm font-medium text-gray-900 dark:text-white'>
  //         {room.messageCount} messages
  //       </p>
  //       <p className='mt-1 max-w-[160px] truncate text-xs text-gray-500 dark:text-gray-400'>
  //         {lastMessage.msgCategory === MessageCategory.Text
  //           ? lastMessage.msg.slice(0, 20) + "..."
  //           : lastMessage.msgFilename.slice(0, 15) +
  //             "..." +
  //             lastMessage.msgExtension}
  //       </p>
  //     </div>
  //
  //   </li>
  // );
};

export default RoomListItem;
