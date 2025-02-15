"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import p2party from "p2party";

import { Button } from "../components/button";
import { Link } from "../components/link";

const CatAvatar = lazy(() => import("../components/avatars/cat"));

const HomePage = () => {
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
    <div className='relative isolate flex min-h-[calc(100dvh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom))] w-full flex-col content-center items-center justify-center bg-white bg-gradient-to-b px-6 dark:bg-black'>
      <div className='flex flex-col items-center space-y-6'>
        <Suspense>
          <CatAvatar className='m-0 w-3/4 p-0 drop-shadow-lg' />
        </Suspense>

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

      <footer className='absolute bottom-0 sm:right-3'>
        <div className='md:order-1'>
          <Link
            href={"https://github.com/p2party"}
            target='_blank'
            rel='noopener noreferrer'
            className='text-center text-xs leading-5 text-gray-500'
          >
            &copy; 2025 Deliberative Technologies. All rights reserved.
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
