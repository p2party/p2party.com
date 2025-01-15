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
    <div className='z-10 flex min-h-screen flex-col items-center justify-center bg-gradient-to-r from-darkOrange to-darkRed'>
      <div className='px-4 text-center'>
        <CatAvatar className='w-2/5 border-0 outline-0' />

        <h1 className='mb-4 text-5xl font-bold text-white'>
          Generate throwaway rooms
        </h1>
        <p className='mb-6 text-lg text-gray-200'>
          Send the URL to your friends, connect peer-to-peer, enjoy text and
          file sharing with secrecy.
        </p>
      </div>

      <div className='z-100 flex flex-col items-center space-y-2'>
        <Button
          href={`/${roomId}`}
          // onClick={handleCreateRandomRoom}
          className='rounded-lg bg-darkOrange px-12 py-8 font-bold text-white'
        >
          Random Room
        </Button>
      </div>

      <Footer />
    </div>
  );
};

export default HomePage;
