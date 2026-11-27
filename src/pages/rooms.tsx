"use client";

import { useState, lazy, Suspense, useEffect } from "react";

import { useLocation, useNavigate } from "react-router";
import { Button } from "../components/button";
import { useRoom } from "../hooks/useRoom";

import type { UniqueRoom } from "p2party";

const CatAvatar = lazy(() => import("../components/avatars/cat"));
const RoomListItem = lazy(() => import("../components/RoomItem"));
const RoomSetupAlert = lazy(() => import("../components/RoomSetupAlert"));

const RestoreIdentityAlert = lazy(
  () => import("../components/alerts/RestoreIdentityAlert"),
);

const RoomsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { getAllPastRooms, identityBackupIsAvailable } = useRoom({
    subscribeToMessages: false,
  });

  // `null` is "we have not looked yet", which is a different thing from "there
  // are none". Starting at [] rendered the empty state for a frame on every
  // visit, so a returning user's first impression of their own room list was
  // the words "no saved rooms".
  const [rooms, setRooms] = useState<UniqueRoom[] | null>(null);
  const [roomSetupOpen, setRoomSetupOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getAllPastRooms()
      .then((saved) => {
        if (!cancelled)
          setRooms([...saved].sort((a, b) => b.updatedAt - a.updatedAt));
      })
      .catch(() => {
        if (!cancelled) setRooms([]);
      });

    return () => {
      cancelled = true;
    };
  }, [getAllPastRooms]);

  useEffect(() => {
    document.title =
      rooms === null
        ? "Your rooms · p2party"
        : `${String(rooms.length)} saved room${rooms.length === 1 ? "" : "s"} · p2party`;
  }, [rooms]);

  return (
    <div className='relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth pt-14 lg:pt-0'>
      <div className='pointer-events-none fixed inset-0 z-0 flex items-center justify-center lg:ml-64'>
        <Suspense fallback={null}>
          <CatAvatar className='w-full max-w-3xl opacity-[0.12] md:w-4/5 lg:w-3/4 dark:opacity-[0.20]' />
        </Suspense>
      </div>

      <div className='relative z-10 mx-auto w-full max-w-3xl px-5 pb-28 sm:px-8'>
        <header className='pt-8 pb-6 sm:pt-12'>
          <h1 className='site-title'>Your rooms</h1>
          <p className='mt-3 text-base leading-relaxed text-zinc-600 dark:text-zinc-300'>
            Rooms you join are saved in this browser. Keep a copy of the invite
            link to reopen a room on another device.
          </p>
        </header>

        {rooms === null && (
          <ul aria-hidden className='space-y-2'>
            {[0, 1, 2].map((row) => (
              <li
                key={row}
                className='h-[4.5rem] animate-pulse border-2 border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900'
              />
            ))}
          </ul>
        )}

        {rooms !== null && rooms.length === 0 && (
          <div className='shadow-brutal-sm border-2 border-zinc-950 bg-white dark:border-zinc-200 dark:bg-zinc-950'>
            <div className='p-5 sm:p-8'>
              <h2 className='text-2xl font-extrabold tracking-tight'>
                No saved rooms yet
              </h2>
              <p className='mt-2 max-w-prose text-base leading-relaxed text-zinc-600 dark:text-zinc-300'>
                Open an invite from a friend or generate a room and share its
                link. You can chat and send files without a wallet.
              </p>
              <Button
                onClick={() => setRoomSetupOpen(true)}
                color='orange'
                className='shadow-brutal-sm mt-6 cursor-pointer rounded-none border-2 border-zinc-950 px-6 py-2.5 font-semibold whitespace-nowrap transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 motion-reduce:transition-none dark:border-zinc-200'
              >
                Generate Room
              </Button>
            </div>
          </div>
        )}

        {rooms !== null && rooms.length > 0 && (
          <ul className='space-y-2'>
            {rooms.map((room) => (
              <Suspense
                key={room.roomId}
                fallback={
                  <li className='h-[4.5rem] border-2 border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900' />
                }
              >
                <RoomListItem {...room} />
              </Suspense>
            ))}
          </ul>
        )}
      </div>

      {/* Hidden when the empty state already offers the same action, so the
          page never shows two Generate Room buttons at once. */}
      {rooms !== null && rooms.length > 0 && (
        <div className='fixed right-4 bottom-4 left-4 z-20 flex justify-center lg:left-auto lg:justify-end'>
          <Button
            onClick={() => setRoomSetupOpen(true)}
            color='orange'
            className='shadow-brutal-sm w-full max-w-xs cursor-pointer rounded-none border-2 border-zinc-950 px-6 py-2.5 text-lg font-semibold transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 motion-reduce:transition-none lg:w-auto dark:border-zinc-200'
          >
            Generate Room
          </Button>
        </div>
      )}

      <Suspense fallback={null}>
        <RoomSetupAlert isOpen={roomSetupOpen} setIsOpen={setRoomSetupOpen} />
      </Suspense>
      {location.hash === "#restore-room-identity" &&
        identityBackupIsAvailable() && (
          <Suspense>
            <RestoreIdentityAlert
              isOpen
              setIsOpen={(open) => {
                if (!open)
                  void navigate(
                    { pathname: location.pathname, search: location.search },
                    { replace: true },
                  );
              }}
            />
          </Suspense>
        )}
    </div>
  );
};

export default RoomsPage;
