"use client";

import { useState, useEffect, lazy, Suspense } from "react";

import { Button } from "../components/button";

import Footer from "../components/custom/footer";

const CatAvatar = lazy(() => import("../components/avatars/cat"));

import p2party from "p2party";

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
    <div className='from-darkOrange to-darkRed relative flex min-h-screen flex-col items-center justify-start bg-gradient-to-br px-6 pt-20 md:justify-center md:pt-0'>
      <div className='flex max-w-lg flex-col items-center text-center'>
        <Suspense>
          <CatAvatar className='mb-2 w-2/3 drop-shadow-lg' />
        </Suspense>

        <h1 className='mb-4 text-4xl leading-tight font-extrabold text-white md:text-5xl'>
          Instant, Secure Rooms
        </h1>

        <p className='mb-8 max-w-xl text-lg text-gray-300'>
          Share the link, wait for peers, connect using WebRTC, enjoy p2p text &
          file sharing with privacy.
        </p>

        <Button
          href={`/${roomId}`}
          className='rounded-lg bg-white/10 px-10 py-4 text-lg font-semibold text-white transition hover:bg-white/20'
        >
          Generate Random Room
        </Button>
      </div>

      <Footer />
    </div>
  );
};

export default HomePage;
