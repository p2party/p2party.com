"use client";

import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import p2party from "p2party";

import { Button } from "../components/button";
import { Link } from "../components/link";

const RoomSetupAlert = lazy(() => import("../components/RoomSetupAlert"));

const features = [
  {
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='currentColor'
        className='size-6'
      >
        <path
          fillRule='evenodd'
          d='M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z'
          clipRule='evenodd'
        />
      </svg>
    ),
    title: "End-to-End Encrypted",
    desc: "Interactive 3DH + a room-fixed ML-KEM-512/768/1024 suite feeds each per-peer Double Ratchet. Messages never touch the signaling server.",
  },
  {
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='currentColor'
        className='size-6'
      >
        <path d='M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-2.234a8.865 8.865 0 0 1-1.088-.196c-1.922-.25-3.291-1.861-3.405-3.727A51.838 51.838 0 0 1 1.5 10.59c0-1.686.018-3.35.077-4.986.114-1.866 1.483-3.477 3.406-3.727ZM15 9.75a.75.75 0 0 1 .75-.75c2.043 0 4.07.12 6.07.36 1.922.25 3.291 1.861 3.405 3.727.056 1.636.075 3.3.075 4.986s-.019 3.35-.075 4.986c-.114 1.866-1.483 3.477-3.405 3.727a49.18 49.18 0 0 1-6.07.36c-2.043 0-4.07-.12-6.07-.36-1.921-.25-3.291-1.861-3.405-3.727A51.768 51.768 0 0 1 6.2 18.857c0-1.686.018-3.35.077-4.986.114-1.866 1.483-3.477 3.405-3.727A49.58 49.58 0 0 1 15.75 9h-.001a.75.75 0 0 1 .001.75Z' />
      </svg>
    ),
    title: "Peer-to-Peer Mesh",
    desc: "No middlemen. Peers discover each other through a lightweight signaling server, then connect directly via WebRTC.",
  },
  {
    icon: (
      // Shield with exclamation — "offensive" / active defense
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='currentColor'
        className='size-6'
      >
        <path
          fillRule='evenodd'
          d='M11.484 2.17a.75.75 0 0 1 1.032 0 11.209 11.209 0 0 0 7.877 3.08.75.75 0 0 1 .722.515 12.74 12.74 0 0 1 .635 3.985c0 5.942-4.064 10.933-9.563 12.348a.749.749 0 0 1-.374 0C6.314 20.683 2.25 15.692 2.25 9.75c0-1.39.223-2.73.635-3.985a.75.75 0 0 1 .722-.516l.143.001c2.996 0 5.718-1.17 7.734-3.08ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75ZM12 15a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75v-.008a.75.75 0 0 0-.75-.75H12Z'
          clipRule='evenodd'
        />
      </svg>
    ),
    title: "Offensive Cryptography",
    desc: "Every message is split into uniform 64 KB chunks padded with cryptographic noise. Eavesdroppers harvest mountains of junk.",
  },
  {
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='currentColor'
        className='size-6'
      >
        <path
          fillRule='evenodd'
          d='M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875Zm5.845 17.03a.75.75 0 0 0 1.06 0l3-3a.75.75 0 1 0-1.06-1.06l-1.72 1.72V12a.75.75 0 0 0-1.5 0v4.19l-1.72-1.72a.75.75 0 0 0-1.06 1.06l3 3Z'
          clipRule='evenodd'
        />
        <path d='M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375V5.25Z' />
      </svg>
    ),
    title: "Text & File Sharing",
    desc: "Send text and large files directly between browsers — chunked, verified by Merkle proofs, and never uploaded.",
  },
];

const steps = [
  {
    num: "01",
    title: "Chunk & Flood",
    body: "Your message is split into fixed-size 64 KiB wire cells. Real bytes sit at randomized offsets and the remaining space is filled with cryptographic noise, so every emitted cell has the same outer size.",
  },
  {
    num: "02",
    title: "Ratchet & Scatter",
    body: "Each chunk is protected by ChaCha20-Poly1305 under a per-peer Double Ratchet message key, then shuffled. The room-fixed ML-KEM suite hardens the initial root while classical X25519 retains an independently understood security leg.",
  },
  {
    num: "03",
    title: "Verify & Reassemble",
    body: "The recipient decrypts each cell, checks its Merkle proof, and reassembles the payload. Immediate delivery is the default; timed room-wide cover is an explicit future policy, not a claim about today’s network.",
  },
];

const HomePage = () => {
  const navigate = useNavigate();
  const [roomSetupOpen, setRoomSetupOpen] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    const getRooms = async () => {
      const r = await p2party.getAllExistingRooms();

      if (r.length > 0) navigate("/rooms/", { replace: true });
    };

    getRooms();

    return () => {
      abortController.abort();
    };
  }, [navigate]);

  return (
    <div className='relative isolate flex min-h-[calc(100svh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom))] w-full flex-col items-center overflow-hidden bg-white px-6 dark:bg-black'>
      {/* Retro dot grid */}
      <div
        className='pointer-events-none absolute inset-0 text-orange-500 opacity-[0.08] dark:opacity-[0.05]'
        style={{
          backgroundImage:
            "radial-gradient(currentColor 1px, transparent 1.5px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden
      />

      {/* Hero */}
      <div className='relative grid w-full max-w-6xl grid-cols-1 items-center gap-4 pt-8 pb-12 sm:gap-6 sm:pt-16 sm:pb-20 md:grid-cols-2 md:gap-8 lg:gap-12'>
        {/* Visual */}
        <div className='order-first flex justify-center md:order-last md:justify-end'>
          {/* The square asset carries ~44% empty margin; logo-cat-tight.svg is
              the same art cropped to its bounding box, so the mark fills the
              space it reserves. */}
          <img
            src='/logo-cat-tight.svg'
            alt=''
            aria-hidden
            className='animate-float h-40 w-auto select-none motion-reduce:animate-none sm:h-56 md:h-64 lg:h-88'
          />
        </div>

        {/* Copy + CTAs */}
        <div className='flex flex-col items-center text-center md:items-start md:text-left'>
          <span className='animate-fade-in mb-4 inline-flex max-w-full items-center gap-2 border-2 border-zinc-950 px-2 py-1 font-mono text-[10px] font-bold tracking-[0.1em] whitespace-nowrap text-zinc-950 uppercase sm:px-3 sm:text-xs sm:tracking-[0.18em] md:text-[10px] md:tracking-[0.08em] lg:text-xs lg:tracking-[0.18em] dark:border-zinc-200 dark:text-white'>
            <span className='bg-darkOrange inline-block size-1.5' />
            direct mesh · protocol v4 · no accounts
          </span>
          <h1 className='animate-fade-in text-4xl leading-tight font-black tracking-[-0.055em] text-balance text-zinc-950 sm:text-5xl lg:text-6xl dark:text-white'>
            Privacy That{" "}
            <span className='text-orange-600 dark:text-orange-500'>
              Fights Back
            </span>
          </h1>

          <p className='animate-slide-up mt-4 max-w-lg text-lg leading-relaxed text-balance text-zinc-500 dark:text-zinc-400'>
            Peer-to-peer rooms with post-quantum-hardened ratchets.{" "}
            <br className='hidden lg:block' />
            Sniffers get uniform cells. You get privacy. No accounts.
          </p>

          <div className='animate-slide-up mt-6 flex w-full flex-col items-stretch gap-3 sm:mt-7 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-center md:justify-start'>
            <Button
              onClick={() => setRoomSetupOpen(true)}
              color='orange'
              className='shadow-brutal-sm rounded-none border-2 border-zinc-950 px-8 py-3 text-lg font-semibold whitespace-nowrap transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 motion-reduce:transition-none dark:border-zinc-200'
            >
              Generate Room
            </Button>
            <div className='-ml-3 flex items-center justify-center gap-1 sm:gap-0'>
              <Link
                href='/blog'
                className='inline-flex items-center justify-center gap-1.5 rounded-none px-3 py-2.5 font-mono text-sm font-semibold whitespace-nowrap text-zinc-600 transition-colors hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 sm:px-5 dark:text-zinc-400 dark:hover:text-orange-300'
              >
                protocol field notes
              </Link>
              <span
                aria-hidden
                className='text-zinc-300 sm:hidden dark:text-zinc-700'
              >
                ·
              </span>
              <Link
                href='https://github.com/p2party/p2party-js'
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center justify-center gap-1.5 rounded-none px-3 py-2.5 font-mono text-sm font-semibold whitespace-nowrap text-zinc-600 transition-colors hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 sm:px-5 dark:text-zinc-400 dark:hover:text-white'
              >
                <svg className='size-4' fill='currentColor' viewBox='0 0 24 24'>
                  <path
                    fillRule='evenodd'
                    d='M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z'
                    clipRule='evenodd'
                  />
                </svg>
                View on GitHub
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Suspense>
        <RoomSetupAlert isOpen={roomSetupOpen} setIsOpen={setRoomSetupOpen} />
      </Suspense>

      {/* Feature cards */}
      <div className='relative mx-auto mb-16 grid w-full max-w-6xl gap-5 sm:grid-cols-2 xl:grid-cols-4'>
        {features.map((f, i) => (
          <div
            key={f.title}
            className='group shadow-brutal-sm hover:shadow-brutal border-2 border-zinc-950 bg-white p-6 transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 motion-reduce:transition-none dark:border-zinc-200 dark:bg-zinc-950'
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <div className='bg-darkOrange mb-3 inline-flex p-2 text-white'>
              {f.icon}
            </div>
            <h3 className='font-mono text-base font-bold text-zinc-950 dark:text-white'>
              {f.title}
            </h3>
            <p className='mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400'>
              {f.desc}
            </p>
          </div>
        ))}
      </div>

      {/* How it works — the offensive protocol */}
      <div className='relative mb-20 w-full max-w-6xl'>
        <h2 className='mb-2 text-center text-3xl font-black tracking-[-0.055em] text-zinc-950 sm:text-4xl dark:text-white'>
          How&nbsp;
          <span className='text-orange-600 dark:text-orange-500'>
            Offensive
          </span>
          &nbsp;Cryptography Works
        </h2>
        <p className='mx-auto mb-10 max-w-xl text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400'>
          Traditional encryption hides content. p2party goes further — it
          actively punishes anyone trying to intercept your traffic by burying
          the real data inside an avalanche of cryptographically random noise.
        </p>

        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
          {steps.map((s) => (
            <div
              key={s.num}
              className='relative border-2 border-zinc-950 bg-white p-6 dark:border-zinc-200 dark:bg-zinc-950'
            >
              <span className='text-darkOrange mb-3 block font-mono text-3xl font-black'>
                {s.num}
              </span>
              <h3 className='mb-2 font-mono text-base font-bold text-zinc-950 dark:text-white'>
                {s.title}
              </h3>
              <p className='text-sm leading-relaxed text-zinc-500 dark:text-zinc-400'>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Infrastructure */}
      <div className='relative mb-20 w-full max-w-6xl'>
        <h2 className='mb-2 text-center text-3xl font-black tracking-[-0.055em] text-zinc-950 sm:text-4xl dark:text-white'>
          Minimal&nbsp;
          <span className='text-orange-600 dark:text-orange-500'>
            Infrastructure
          </span>
        </h2>
        <p className='mx-auto mb-10 max-w-xl text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400'>
          p2party runs on a handful of lightweight servers — just enough to
          bootstrap direct connections. Once peers find each other the servers
          are out of the loop.
        </p>

        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
          <div className='relative border-2 border-zinc-950 bg-white p-6 dark:border-zinc-200 dark:bg-zinc-950'>
            <div className='bg-darkOrange mb-3 inline-flex p-2 text-white'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='currentColor'
                className='size-6'
              >
                <path d='M5.507 4.048A3 3 0 0 1 7.785 3h8.43a3 3 0 0 1 2.278 1.048l1.722 2.008A4.533 4.533 0 0 0 19.5 6h-15c-.243 0-.482.02-.715.056l1.722-2.008Z' />
                <path
                  fillRule='evenodd'
                  d='M1.5 10.5a3 3 0 0 1 3-3h15a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3v-6Zm15 3.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm2.25-.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            <h3 className='mb-2 font-mono text-base font-bold text-zinc-950 dark:text-white'>
              Signaling Server
            </h3>
            <p className='text-sm leading-relaxed text-zinc-500 dark:text-zinc-400'>
              A lightweight WebSocket relay that introduces peers to one
              another. It never sees, stores, or forwards your messages — only
              ephemeral connection metadata.
            </p>
          </div>

          <div className='relative border-2 border-zinc-950 bg-white p-6 dark:border-zinc-200 dark:bg-zinc-950'>
            <div className='bg-darkOrange mb-3 inline-flex p-2 text-white'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='currentColor'
                className='size-6'
              >
                <path
                  fillRule='evenodd'
                  d='M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM8.547 4.505a8.25 8.25 0 1 0 11.672 8.214l-.46-.46a2.252 2.252 0 0 1-.422-.586l-1.08-2.16a.414.414 0 0 0-.663-.107.827.827 0 0 1-.812.21l-1.273-.363a.89.89 0 0 0-.738.135l-.57.38a.716.716 0 0 1-.88-.106l-1.289-1.29a.354.354 0 0 0-.174-.1l-1.835-.459a.429.429 0 0 0-.39.114l-.7.7a.418.418 0 0 1-.58.013l-.646-.573a.428.428 0 0 0-.695.16l-.874 2.185a.753.753 0 0 1-.393.375.74.74 0 0 1-.54 0 .752.752 0 0 1-.394-.375c-.05-.125-.073-.259-.068-.393l.098-2.467a.419.419 0 0 1 .318-.39l.749-.188a.428.428 0 0 0 .317-.393V4.98c0-.074-.019-.147-.056-.212a.418.418 0 0 0-.2-.19l-.178-.082Z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            <h3 className='mb-2 font-mono text-base font-bold text-zinc-950 dark:text-white'>
              STUN Server
            </h3>
            <p className='text-sm leading-relaxed text-zinc-500 dark:text-zinc-400'>
              Helps each browser discover its own public address so peers behind
              NATs can connect directly. No media is relayed — STUN only
              reflects your address back to you.
            </p>
          </div>

          <div className='relative border-2 border-zinc-950 bg-white p-6 dark:border-zinc-200 dark:bg-zinc-950'>
            <div className='bg-darkOrange mb-3 inline-flex p-2 text-white'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='currentColor'
                className='size-6'
              >
                <path
                  fillRule='evenodd'
                  d='M15.97 2.47a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06l3.22-3.22H7.5a.75.75 0 0 1 0-1.5h11.69l-3.22-3.22a.75.75 0 0 1 0-1.06Zm-7.94 9a.75.75 0 0 1 0 1.06L4.81 15.75H16.5a.75.75 0 0 1 0 1.5H4.81l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 0Z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            <h3 className='mb-2 font-mono text-base font-bold text-zinc-950 dark:text-white'>
              TURN Relay
            </h3>
            <p className='text-sm leading-relaxed text-zinc-500 dark:text-zinc-400'>
              A last-resort relay for the rare case when two peers are both
              behind symmetric NATs. Traffic is still end-to-end encrypted — the
              relay cannot read it. All servers are hosted in the EU on Hetzner.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className='relative mb-4 w-full text-center'>
        <div className='flex flex-wrap items-center justify-center gap-x-4 gap-y-1'>
          <Link
            href='/privacy-policy'
            className='rounded text-[13px] text-zinc-500 transition-colors hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 dark:text-zinc-400 dark:hover:text-zinc-200'
          >
            Privacy
          </Link>
          <span className='text-zinc-300 dark:text-zinc-700'>·</span>
          <Link
            href='/terms-of-service'
            className='rounded text-[13px] text-zinc-500 transition-colors hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 dark:text-zinc-400 dark:hover:text-zinc-200'
          >
            Terms
          </Link>
          <span className='text-zinc-300 dark:text-zinc-700'>·</span>
          <Link
            href='/blog'
            className='rounded text-[13px] text-zinc-500 transition-colors hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 dark:text-zinc-400 dark:hover:text-zinc-200'
          >
            Field notes
          </Link>
          <span className='text-zinc-300 dark:text-zinc-700'>·</span>
          <Link
            href='https://github.com/p2party'
            target='_blank'
            rel='noopener noreferrer'
            className='rounded text-[13px] text-zinc-500 transition-colors hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 dark:text-zinc-400 dark:hover:text-zinc-200'
          >
            GitHub
          </Link>
        </div>
        <p className='mt-1.5 text-[13px] text-zinc-500 dark:text-zinc-400'>
          &copy; 2026 p2party. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default HomePage;
