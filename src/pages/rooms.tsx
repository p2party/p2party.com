"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import p2party from "p2party";

import { Button } from "../components/button";

const CatAvatar = lazy(() => import("../components/avatars/cat"));

const RoomsPage = () => {
  const [roomId, setRoomId] = useState("");
  // const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();

    const getRandomRoomId = async () => {
      const random = await p2party.generateRandomRoomUrl();
      setRoomId(random);
    };

    getRandomRoomId();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className='flex max-h-[calc(94svh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom))] min-h-0 flex-col content-center items-center justify-center overflow-y-auto scroll-smooth bg-white pt-14 lg:my-2 lg:pt-0 dark:bg-black'>
      <div className='pointer-events-none fixed inset-0 z-0 flex items-center justify-center lg:ml-64'>
        <Suspense>
          <CatAvatar className='w-2/3 w-full outline-white md:w-2/3 lg:w-2/5 dark:outline-zinc-900' />
        </Suspense>
      </div>

      <div className='flex flex-col items-center space-y-6'>
        <h1 className='text-center text-4xl leading-tight font-extrabold text-black md:text-5xl dark:text-white'>
          Instant, Secure Rooms
        </h1>

        <p className='max-w-xl text-center text-lg text-gray-800 dark:text-gray-200'>
          Share the link, wait for peers, connect using WebRTC, enjoy p2p text &
          file sharing with privacy.
        </p>

        <Button
          href={`/room/${roomId}`}
          className='rounded-lg text-lg font-semibold text-white transition hover:bg-white/20'
        >
          Generate Room
        </Button>
      </div>
    </div>
  );
};

export default RoomsPage;
