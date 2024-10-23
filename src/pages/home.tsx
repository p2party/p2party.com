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
    <div className='flex min-h-screen flex-col items-center justify-center bg-gradient-to-r from-darkOrange to-darkRed z-10'>
      <div className='px-4 text-center'>
        <CatAvatar className='w-1/2 border-0 outline-0' />

        <h1 className='mb-4 text-5xl font-bold text-white'>
          P2Party generates WebRTC meeting points
        </h1>
        <p className='mb-6 text-lg text-gray-200'>
          Send the room URL to your friends and connect with them peer-to-peer
        </p>
      </div>

      <div className='flex flex-col items-center space-y-2 z-100'>
        <Button
          href={`/${roomId}`}
          // onClick={handleCreateRandomRoom}
          className='rounded-lg bg-darkOrange px-6 py-5 font-bold text-white'
        >
          Generate Random Room
        </Button>
      </div>

      <Footer />
    </div>
  );
};

export default HomePage;
