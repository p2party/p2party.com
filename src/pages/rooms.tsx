"use client";

import { useState, lazy, Suspense, useEffect } from "react";

import { Button } from "../components/button";
import { useRoom } from "../hooks/useRoom";

import type { UniqueRoom } from "p2party";

const CatAvatar = lazy(() => import("../components/avatars/cat"));
const RoomListItem = lazy(() => import("../components/RoomItem"));
const RoomSetupAlert = lazy(() => import("../components/RoomSetupAlert"));

const RoomsPage = () => {
  const { getAllPastRooms } = useRoom({
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

      <div className='relative z-10 mx-auto w-full max-w-3xl px-2 pb-28 sm:px-4'>
        <header className='pt-6 pb-4'>
          <h1 className='font-mono text-xs font-bold tracking-[0.18em] text-zinc-500 uppercase dark:text-zinc-400'>
            Saved rooms
          </h1>
          <p className='mt-1 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300'>
            This list is kept entirely client-side, in this browser&apos;s
            IndexedDB. No account, operator or backup holds it, and clearing
            site data deletes it for good. The secret part of an invite lives in
            the link&apos;s <code>#</code> fragment, which browsers do not send
            in web requests &mdash; joining sends it to the signaling server,
            which keeps only a hash of it.
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

        {/* An empty list here is the product working, not the product failing.
            Nobody can populate it for you, which is worth saying out loud
            instead of apologising for the blank space. */}
        {rooms !== null && rooms.length === 0 && (
          <div className='shadow-brutal-sm border-2 border-zinc-950 bg-white dark:border-zinc-200 dark:bg-zinc-950'>
            <div className='flex items-center gap-2 border-b-2 border-zinc-950 px-3 py-1.5 dark:border-zinc-200'>
              <span className='bg-darkOrange size-2' aria-hidden />
              <span className='font-mono text-[11px] font-bold tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400'>
                p2party://rooms
              </span>
            </div>

            <div className='px-4 py-6 sm:px-6 sm:py-8'>
              <pre className='overflow-x-auto font-mono text-xs leading-relaxed text-zinc-600 sm:text-sm dark:text-zinc-300'>
                <span className='text-darkOrange'>$</span> p2party ls ~/rooms
                {"\n"}
                <span className='text-zinc-950 dark:text-white'>
                  0 rooms on this device
                </span>
              </pre>

              <p className='mt-5 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-300'>
                That is not a sync problem. The store is entirely client-side:
                every invite link lives in this browser&apos;s IndexedDB and is
                never uploaded, so there is no account holding a list of them
                and no server that could hand you one. An empty list is the only
                thing we are able to show a new device.
              </p>
              <p className='mt-3 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-300'>
                The same goes for your identity: the secret key this browser
                signs with never leaves it. The matching public half is what the
                signaling server stores to recognise you, as the privacy policy
                explains. There is no restore flow yet, so a cleared profile is
                a new person as far as everyone else is concerned.
              </p>
              <p className='mt-3 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-300'>
                Generate a room and it appears here once you have been in it.
                Clearing site data removes it again, permanently &mdash; keep
                the link somewhere else if the room needs to outlive this
                browser profile.
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
    </div>
  );
};

export default RoomsPage;
