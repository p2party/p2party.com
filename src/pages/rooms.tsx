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
} from "../components/table";

import type { UniqueRoom } from "p2party";

const CatAvatar = lazy(() => import("../components/avatars/cat"));
const RoomListItem = lazy(() => import("../components/RoomItem"));

const RoomsPage = () => {
  const { goToRandomRoom, getAllPastRooms } = useRoom();

  const [rooms, setRooms] = useState<UniqueRoom[]>([]);

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
  }, []);

  useEffect(() => {
    const r = rooms.length;
    document.title = "P2Party: " + r + " past rooms";
  }, [rooms]);

  return (
    <div className='flex max-h-[calc(90svh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom))] min-h-0 flex-col overflow-y-auto scroll-smooth pt-14 lg:my-2 lg:pt-0'>
      <div className='pointer-events-none fixed inset-0 z-0 flex items-center justify-center lg:ml-64'>
        <Suspense>
          <CatAvatar className='w-2/3 w-full outline-white md:w-2/3 lg:w-2/5 dark:outline-zinc-900' />
        </Suspense>
      </div>

      <div className='relative flex flex-1 flex-col items-center justify-center'>
        <Table
          dense
          className='h-full overflow-x-hidden overflow-y-auto overscroll-contain bg-white/95 dark:bg-black/85'
        >
          <TableHead>
            <TableRow>
              <TableHeader>Rooms</TableHeader>
            </TableRow>
          </TableHead>

          <TableBody>
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
          className='bg-darkOrange cursor-pointer rounded-lg px-4 py-2 text-lg font-semibold text-white transition hover:bg-black'
          onClick={async () => await goToRandomRoom()}
        >
          Generate Room
        </Button>
      </div>
    </div>

    // <div className='flex max-h-[calc(94svh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom))] min-h-0 flex-col overflow-y-auto scroll-smooth pt-14 lg:my-2 lg:pt-0'>
    //   <div className='pointer-events-none fixed inset-0 z-0 flex items-center justify-center lg:ml-64'>
    //     <Suspense>
    //       <CatAvatar className='w-2/3 w-full outline-white md:w-2/3 lg:w-2/5 dark:outline-zinc-900' />
    //     </Suspense>
    //   </div>
    //
    //   <div className='relative flex flex-1 flex-col px-6'>
    //     {rooms.length === 0 && (
    //       <div className='fixed top-16 right-0 left-0 z-50 mx-auto flex w-36 items-center justify-center pb-4 lg:left-64'>
    //         <Badge
    //           color='orange'
    //           className='w-full text-center'
    //           onClick={async () => await goToRandomRoom()}
    //         >
    //           No past rooms found
    //         </Badge>
    //       </div>
    //     )}
    //
    //     <ul
    //       role='list'
    //       className='mb-10 divide-y divide-gray-200 overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg bg-white/80 shadow-sm dark:bg-black/60'
    //     >
    //       {rooms.map((room) => (
    //         <RoomListItem key={room.roomId} {...room} />
    //       ))}
    //     </ul>
    //   </div>
    //
    //   <Button
    //       className='rounded-lg text-lg font-semibold text-white transition hover:bg-white/20'
    //     // className='bg-darkOrange hover:bg-darkRed fixed right-0 bottom-0 left-0 z-50 flex cursor-pointer items-center justify-between gap-x-6 p-4 text-black transition hover:text-white lg:mb-2 lg:ml-64 lg:px-16'
    //     onClick={async () => await goToRandomRoom()}
    //   >
    //     New random room
    //   </Button>
    // </div>
  );
};

export default RoomsPage;
