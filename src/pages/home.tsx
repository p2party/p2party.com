"use client";

import { useState, useEffect } from "react";

import { Button } from "../components/button";

import generateRandomAlphanumeric from "../utils/generateRandomRoomUrl";

const HomePage = () => {
  const [roomId, setRoomId] = useState("");
  // const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();

    const getRandomRoomId = async () => {
      const random = await generateRandomAlphanumeric(64);
      setRoomId(random);
    };

    getRandomRoomId();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-gradient-to-r from-darkOrange to-darkRed'>
      {/* Hero Section */}
      <div className='px-4 text-center'>
        <h1 className='mb-6 text-5xl font-bold text-white'>
          P2Party creates instant WebRTC mesh networks
        </h1>
        <p className='mb-10 text-lg text-gray-200'>
          Send the room URL to your friends and make peer-to-peer connections
          with them.
        </p>
      </div>

      {/* Call to Action Buttons */}
      <div className='flex flex-col items-center space-y-4'>
        <Button
          href={`/room/${roomId}`}
          // onClick={handleCreateRandomRoom}
          className='rounded-lg bg-darkOrange px-6 py-5 font-bold text-white transition hover:bg-orange-500'
        >
          Create Random Room
        </Button>
      </div>
    </div>
  );
};

export default HomePage;
