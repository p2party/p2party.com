"use client";

import { useState, useEffect } from "react";

import { Button } from "../components/button";
import CatAvatar from "../components/avatars/cat";
import Footer from "../components/custom/footer";

import p2party from "p2party";

const HomePage = () => {
  const [roomId, setRoomId] = useState("");
  // const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();

    const getRandomRoomId = async () => {
      const random = await p2party.generateRandomRoomUrl(64);
      setRoomId(random);
    };

    getRandomRoomId();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className='relative flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-darkOrange to-darkRed px-6 pt-20 md:justify-center md:pt-0'>
      <div className='flex max-w-lg flex-col items-center text-center'>
        <CatAvatar className='mb-2 w-2/3 drop-shadow-lg' />

        <h1 className='mb-4 text-4xl font-extrabold leading-tight text-white md:text-5xl'>
          Instant, Secure Rooms
        </h1>

        <p className='mb-8 max-w-xl text-lg text-gray-300'>
          Share the link, wait for peers, connect, enjoy p2p text & file sharing
          with privacy.
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
