"use client";

import { useState, lazy, Suspense, useEffect } from "react";
import { Button } from "@headlessui/react";

import { useRoom } from "../hooks/useRoom";

import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
} from "../components/table";

import type { UniqueRoom } from "p2party";

const CatAvatar = lazy(() => import("../components/avatars/cat"));
const RoomListItem = lazy(() => import("../components/RoomItem"));
const RoomSetupAlert = lazy(() => import("../components/RoomSetupAlert"));

const RoomsPage = () => {
  const { getAllPastRooms } = useRoom({
    subscribeToMessages: false,
  });

  const [rooms, setRooms] = useState<UniqueRoom[]>([]);
  const [roomSetupOpen, setRoomSetupOpen] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    const getRooms = async () => {
      const r = await getAllPastRooms();

      setRooms(r.sort((a, b) => b.updatedAt - a.updatedAt));
    };

    getRooms();

    return () => {
      abortController.abort();
    };
  }, [getAllPastRooms]);

  useEffect(() => {
    const r = rooms.length;
    document.title = "P2Party: " + r + " past rooms";
  }, [rooms]);

  return (
    <div className='flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth pt-14 lg:my-2 lg:pt-0'>
      <div className='pointer-events-none fixed inset-0 z-0 flex items-center justify-center lg:ml-64'>
        <Suspense>
          <CatAvatar className='w-full opacity-[0.08] md:w-2/3 lg:w-2/5 dark:opacity-[0.06]' />
        </Suspense>
      </div>

      <div className='relative flex min-h-0 flex-1 flex-col items-center justify-center'>
        <Table
          dense
          className='h-full overflow-x-hidden overflow-y-auto overscroll-contain bg-white dark:bg-black'
        >
          <TableHead>
            <TableRow>
              <TableHeader>Rooms</TableHeader>
            </TableRow>
          </TableHead>

          <TableBody>
            {rooms.length === 0 && (
              <TableRow>
                <TableCell className='py-10 text-center font-mono text-sm text-zinc-500 dark:text-zinc-400'>
                  No past rooms yet — generate one to get started.
                </TableCell>
              </TableRow>
            )}
            {rooms.map((room) => (
              <Suspense key={room.roomId}>
                <RoomListItem {...room} />
              </Suspense>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className='fixed bottom-4 left-1/2 -translate-x-1/2 lg:right-4 lg:left-auto lg:translate-x-0'>
        <Button
          className='bg-darkOrange shadow-brutal-sm cursor-pointer rounded-none border-2 border-zinc-950 px-6 py-2.5 text-lg font-semibold text-white transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 motion-reduce:transition-none dark:border-zinc-200'
          onClick={() => setRoomSetupOpen(true)}
        >
          Generate Room
        </Button>
        <Suspense>
          <RoomSetupAlert isOpen={roomSetupOpen} setIsOpen={setRoomSetupOpen} />
        </Suspense>
      </div>
    </div>

    //         >
    //     >
    //   >
  );
};

export default RoomsPage;
