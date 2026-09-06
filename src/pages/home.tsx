"use client";

import { useEffect, useState, lazy, Suspense } from "react";

import { Button } from "../components/button";
import { Link } from "../components/link";
import HeroDemo from "../components/custom/HeroDemo";

const RoomSetupAlert = lazy(() => import("../components/RoomSetupAlert"));

const features = [
  {
    icon: (
      // Two endpoints and the sealed line between them: a mesh edge, not a padlock.
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='square'
        className='size-6'
      >
        <rect x='2' y='8' width='7' height='8' />
        <rect x='15' y='8' width='7' height='8' />
        <path d='M9 12h6' />
      </svg>
    ),
    title: "Post-Quantum Handshake",
    desc: "Every pair of browsers runs an interactive 3DH plus a room-fixed ML-KEM-512/768/1024 exchange, mixes both into one key, and hands it to a per-peer Double Ratchet. Ed25519 identities cross-sign each side's X25519 key, and three chained confirmation flights bind the transcript. Messages never touch the signaling server.",
  },
  {
    icon: (
      // Four nodes with every pair joined: the actual topology, n(n-1)/2 edges.
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='square'
        className='size-6'
      >
        <path d='M5 5h14M5 19h14M5 5v14M19 5v14M5 5l14 14M19 5L5 19' />
        <rect x='2' y='2' width='6' height='6' fill='currentColor' />
        <rect x='16' y='2' width='6' height='6' fill='currentColor' />
        <rect x='2' y='16' width='6' height='6' fill='currentColor' />
        <rect x='16' y='16' width='6' height='6' fill='currentColor' />
      </svg>
    ),
    title: "Peer-to-Peer Mesh",
    desc: "No middlemen. Peers discover each other through a lightweight signaling server, then connect directly via WebRTC.",
  },
  {
    icon: (
      // Identical cells, one carrying payload. The wire cannot tell which.
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='square'
        className='size-6'
      >
        <rect x='2' y='2' width='9' height='9' />
        <rect x='13' y='2' width='9' height='9' />
        <rect x='2' y='13' width='9' height='9' />
        <rect x='13' y='13' width='9' height='9' fill='currentColor' />
      </svg>
    ),
    title: "Uniform Cells",
    desc: "Every message is split into 65,490-byte cells and padded to full, so a 9-byte reply and a 60 KiB photo produce the same-sized cell. The count and the timing of cells are still visible.",
  },
  {
    icon: (
      // A file split into equal chunks moving across: chunked, never uploaded.
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='square'
        className='size-6'
      >
        <rect x='2' y='4' width='7' height='16' />
        <rect x='12' y='5' width='3' height='3' fill='currentColor' />
        <rect x='12' y='11' width='3' height='3' fill='currentColor' />
        <rect x='12' y='17' width='3' height='3' fill='currentColor' />
        <path d='M18 6h4M18 12h4M18 18h4' />
      </svg>
    ),
    title: "Files Up To 10 GiB",
    desc: "Send text and large files directly between browsers — chunked, verified against a Merkle root, written straight to disk as they arrive where the browser supports it, and never uploaded. Reload mid-transfer and it picks up the gaps.",
  },
];

const steps = [
  {
    num: "01",
    title: "Chunk & Flood",
    body: "Your message is split into fixed-size 65,490-byte wire cells. Real bytes sit at randomized offsets and the remaining space is filled with cryptographic noise, so every emitted cell has the same outer size.",
  },
  {
    num: "02",
    title: "Ratchet & Scatter",
    body: "Each chunk is sealed with ChaCha20-Poly1305 under its own Double Ratchet message key, then emitted in a Fisher-Yates shuffled order, so cell 1 on the wire is not chunk 1 of your file. The room-fixed ML-KEM suite hardens the initial root, and classical X25519 stays in the mix as an independently understood second leg.",
  },
  {
    num: "03",
    title: "Verify & Reassemble",
    body: "The recipient decrypts each cell, checks its Merkle proof, and reassembles the payload. Immediate delivery is the default; a room can instead fix a timed cover schedule, which every peer then follows.",
  },
];

// Two lists that have to be read together. The left one is only credible
// because the right one exists, and the right one is only publishable because
// the project's own rule is that an untested guarantee does not get printed.
const shipped = [
  {
    title: "Rooms with a PIN",
    body: "Turn one on and both sides prove they know the same PIN without ever sending it. Get it wrong too many times and the room makes that identity wait before it will try again, and shows you the countdown.",
  },
  {
    title: "A fixed sending rhythm, if you want one",
    body: "A room can be created with a cover schedule. Every peer in it then emits cells on the same cadence whether or not anyone is typing, and the room header tells you when that schedule is actually running.",
  },
  {
    title: "Sessions that re-key themselves",
    body: "A long-running conversation periodically runs a fresh ML-KEM exchange and moves to a new epoch, so a session does not rest forever on the key it was born with. Traffic waits while that exchange is in flight.",
  },
  {
    title: "Contacts you can pin",
    body: "Save a peer under a name and the app remembers the identity key behind it. If that key ever changes, the app flags it on that contact's messages and in the verify dialog, so you can compare safety numbers before you trust the conversation.",
  },
  {
    title: "Sleep, move, come back",
    body: "A phone that was asleep with its radio off used to come back holding a connection the other side had already thrown away. Now an edge is bound to the certificate it was authenticated against, so a stale transport is replaced and re-authenticated rather than reused — and the app re-dials when the tab becomes visible again, when you navigate back to it, when the window regains focus, and when the network returns.",
  },
  {
    title: "An identity you can carry to another browser",
    body: "Create one from a 24-word recovery phrase and it can be rebuilt anywhere from those words, and the password you chose for them if you set one. The phrase is shown once, at creation: it is run one way into the key, so the app keeps nothing it could show you later and nothing an attacker could take from it. An identity made without a phrase stays in the browser that made it.",
  },
  {
    title: "A send that fails, says so",
    body: "A message to a peer that never finishes authenticating fails with a reason inside a bounded wait instead of spinning forever. The outcome is a caption on the message itself, not a toast that vanishes: delivered, delivered to some of the room, or not delivered — with the per-peer reason behind it.",
  },
];

const boundaries = [
  {
    title: "The signaling operator sees who is in the room",
    body: "It stores a hash of the room, the identity keys in it, and when they connect. Hiding that needs a server-blind rendezvous, which is designed and not built.",
  },
  {
    title: "Cover traffic is timing cover",
    body: "The fixed rhythm has been measured over a loopback connection, not over a real network and not against a published traffic-analysis attack. Until it has been, we call it timing cover and not resistance.",
  },
  {
    title: "Written, not yet demonstrated",
    body: "Two more things are implemented and believed correct but have never been shown working end to end: the PIN wait escalating under repeated wrong guesses, and packet traces staying indistinguishable in rooms bigger than two. Until a harness proves them, they are code and not claims.",
  },
  {
    title: "Nobody independent has audited this",
    body: "The protocol has had no third-party cryptographic review. The source and the threat model are public so that it can be checked; that is not the same as having been checked.",
  },
  {
    title: "Your identity is only as recoverable as you made it",
    body: "An identity created from a recovery phrase can be rebuilt in another browser from those words. An identity created without one cannot, because the phrase is run one way into the key and there is nothing to hand back after the fact. Clear site data on an identity that has no phrase and it is gone for good.",
  },
];

const HomePage = () => {
  const [roomSetupOpen, setRoomSetupOpen] = useState(false);
  // A browser that has never been in a room has no rooms to count, and the SDK
  // writes peerId on its first run -- so its absence is a reliable "there is
  // nothing here". Resolved as initial state rather than in an effect: it is
  // known before the first render, and setting it inside one would cascade.
  const [storedRooms, setStoredRooms] = useState<number | null>(() =>
    // Guarded: this initializer runs during the build's render too, where
    // there is no storage. 0 is the honest answer there -- a machine building
    // a static file has no saved rooms -- and it is what a first-time visitor
    // renders as well, so the two agree.
    typeof localStorage === "undefined" ||
    localStorage.getItem("peerId") === null
      ? 0
      : null,
  );

  // Anyone with a saved room used to have the landing page painted and then
  // yanked out from under them by a redirect to /rooms. That is the flicker,
  // and it also meant returning visitors could never read the page. The rooms
  // are offered as a destination instead of imposed as one.
  useEffect(() => {
    // First-time visitors, which is most of them, never load 406 KB of WebRTC
    // and cryptography to be told zero.
    if (localStorage.getItem("peerId") === null) return;
    let cancelled = false;
    // Otherwise: imported on demand, after paint, never before it.
    void import("../protocol/sdk")
      .then(({ default: p2party }) => p2party.getAllExistingRooms())
      .then((rooms) => {
        if (!cancelled) setStoredRooms(rooms.length);
      })
      .catch(() => {
        // A storage failure should not cost anyone the landing page.
        if (!cancelled) setStoredRooms(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      <div className='relative grid w-full max-w-6xl grid-cols-1 items-center gap-6 pt-8 pb-10 sm:gap-8 sm:pt-14 sm:pb-14 md:grid-cols-2 md:items-center md:gap-x-10 md:gap-y-4 lg:gap-x-12'>
        {/* Headline — first on every screen */}
        <div className='flex flex-col items-center text-center md:col-start-1 md:row-start-1 md:items-start md:justify-end md:self-end md:text-left'>
          {/*
            No nowrap: at 375px -- an iPhone SE, not a hypothetical -- the
            eyebrow ran past its own border and the last word was sliced in
            half. Left to wrap it stays inside the box on small screens and is
            still one line everywhere it fits, which is 414px up.
          */}
          <span className='animate-fade-in mb-4 inline-flex max-w-full items-center gap-2 border-2 border-zinc-950 px-2 py-1 font-mono text-[10px] font-bold tracking-[0.1em] text-zinc-950 uppercase sm:px-3 sm:text-xs sm:tracking-[0.18em] md:text-[10px] md:tracking-[0.08em] lg:text-xs lg:tracking-[0.18em] dark:border-zinc-200 dark:text-white'>
            <span className='bg-darkOrange inline-block size-1.5 shrink-0' />
            no accounts · peer-to-peer · no cloud storage
          </span>
          {/*
            Two rows, always. Left to itself the headline rewraps by width --
            four rows on a narrow phone, three on a tablet -- and the slogan
            stops reading as one line answered by another. Each half is its own
            nowrap block so the break is ours, and the smallest step is a clamp
            rather than a fixed size so "Privacy That" scales with the viewport
            instead of overflowing it.
          */}
          <h1 className='animate-fade-in text-[clamp(1.75rem,11vw,2.25rem)] leading-[1.05] font-black tracking-[-0.055em] text-zinc-950 sm:text-5xl lg:text-6xl dark:text-white'>
            <span className='block whitespace-nowrap'>Privacy That</span>
            <span className='block whitespace-nowrap text-orange-600 dark:text-orange-500'>
              Fights Back
            </span>
          </h1>
        </div>
        {/* Visual: a looping demonstration of one message on the wire */}
        <div className='flex justify-center md:col-start-2 md:row-span-2 md:row-start-1 md:justify-end md:self-center'>
          <HeroDemo />
        </div>
        {/* Copy + CTAs */}
        <div className='flex flex-col items-center text-center md:col-start-1 md:row-start-2 md:items-start md:self-start md:text-left'>
          <p className='animate-slide-up max-w-lg text-justify text-lg leading-relaxed hyphens-auto text-zinc-500 dark:text-zinc-400'>
            Send text and files, browser to browser, in identical 64 KB
            encrypted blocks. A block is the same size whatever you put in it.
          </p>

          <div className='animate-slide-up mt-6 flex w-full flex-col items-stretch gap-3 sm:mt-7'>
            <div className='flex w-full flex-col gap-3 sm:flex-row'>
              <Button
                onClick={() => setRoomSetupOpen(true)}
                color='orange'
                className='shadow-brutal-sm flex-1 rounded-none border-2 border-zinc-950 px-8 py-3 text-lg font-semibold whitespace-nowrap transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 motion-reduce:transition-none dark:border-zinc-200'
              >
                Generate Room
              </Button>

              {/* Always present, so the row never reflows when the count
                  arrives. The count appears once known; /rooms handles the
                  empty case with its own explanation and action. */}
              {/* `outline` paints border-zinc-950/10 -- a 10% black, which
                  renders grey next to the solid orange primary. `plain` sets
                  border-transparent instead, so the border below is stated
                  important to win against whichever the variant emits. */}
              <Button
                href='/rooms'
                plain
                className='shadow-brutal-sm flex-1 rounded-none border-2! border-black! bg-white px-8 py-3 text-lg font-semibold whitespace-nowrap text-black transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 motion-reduce:transition-none dark:border-white! dark:bg-black dark:text-white'
              >
                Your Rooms
                {storedRooms !== null && storedRooms > 0
                  ? ` (${storedRooms > 99 ? "99+" : String(storedRooms)})`
                  : ""}
              </Button>
            </div>
            <div className='-mx-3 flex w-[calc(100%+1.5rem)] items-center justify-between gap-1 sm:gap-0'>
              <Link
                href='/blog'
                className='inline-flex items-center justify-center gap-1.5 rounded-none px-3 py-2.5 font-mono text-sm font-semibold whitespace-nowrap text-zinc-600 transition-colors hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 sm:px-5 dark:text-zinc-400 dark:hover:text-orange-300'
              >
                Protocol
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
        {/* Mounted on demand: the chunk (and the SDK it needs to make a room)
            is fetched when someone actually asks for a room, not on the chance
            that they might. */}
        {roomSetupOpen && (
          <RoomSetupAlert isOpen={roomSetupOpen} setIsOpen={setRoomSetupOpen} />
        )}
      </Suspense>
      {/* Feature cards */}
      <div className='relative mx-auto mb-14 grid w-full max-w-6xl gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        {features.map((f, i) => (
          <div
            key={f.title}
            className='group shadow-brutal-sm hover:shadow-brutal border-2 border-zinc-950 bg-white p-6 transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 motion-reduce:transition-none dark:border-zinc-200 dark:bg-zinc-950'
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <div className='bg-darkOrange shadow-brutal-sm mb-3 inline-flex border-2 border-zinc-950 p-2 text-white dark:border-zinc-200'>
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
          Encryption hides what you said. It does not hide that a 4 MB file
          moved at 21:07. p2party works on that second layer: uniform cells,
          padding to full, and an optional fixed sending rhythm. How much that
          buys is a measurement, not a slogan — the boundaries are below.
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
      {/* What it does today, and what it does not */}
      <div className='relative mb-20 w-full max-w-6xl'>
        <h2 className='mb-2 text-center text-3xl font-black tracking-[-0.055em] text-zinc-950 sm:text-4xl dark:text-white'>
          What It Does&nbsp;
          <span className='text-orange-600 dark:text-orange-500'>Today</span>
        </h2>
        <p className='mx-auto mb-10 max-w-xl text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400'>
          Everything on the left is in the code you can read. Everything on the
          right is a thing p2party does not do, said out loud, because a
          guarantee nobody has tested is not a guarantee.
        </p>

        <div className='grid gap-6 lg:grid-cols-2'>
          <div>
            <h3 className='mb-3 font-mono text-xs font-bold tracking-[0.18em] text-orange-700 uppercase dark:text-orange-400'>
              Shipped
            </h3>
            <ul className='space-y-3'>
              {shipped.map((item) => (
                <li
                  key={item.title}
                  className='border-2 border-zinc-950 bg-white p-4 dark:border-zinc-200 dark:bg-zinc-950'
                >
                  <h4 className='font-mono text-sm font-bold text-zinc-950 dark:text-white'>
                    {item.title}
                  </h4>
                  <p className='mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400'>
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className='mb-3 font-mono text-xs font-bold tracking-[0.18em] text-zinc-500 uppercase dark:text-zinc-400'>
              Not claimed
            </h3>
            <ul className='space-y-3'>
              {boundaries.map((item) => (
                <li
                  key={item.title}
                  className='border-2 border-dashed border-zinc-400 bg-zinc-50 p-4 dark:border-zinc-600 dark:bg-black'
                >
                  <h4 className='font-mono text-sm font-bold text-zinc-950 dark:text-white'>
                    {item.title}
                  </h4>
                  <p className='mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400'>
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
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
            <div className='bg-darkOrange shadow-brutal-sm mb-3 inline-flex border-2 border-zinc-950 p-2 text-white dark:border-zinc-200'>
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
              another. It never sees or forwards your messages. It does keep a
              row for each identity key and for which room hashes it belongs to,
              which is how a peer stays reachable across server processes.
            </p>
          </div>

          <div className='relative border-2 border-zinc-950 bg-white p-6 dark:border-zinc-200 dark:bg-zinc-950'>
            <div className='bg-darkOrange shadow-brutal-sm mb-3 inline-flex border-2 border-zinc-950 p-2 text-white dark:border-zinc-200'>
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
            <div className='bg-darkOrange shadow-brutal-sm mb-3 inline-flex border-2 border-zinc-950 p-2 text-white dark:border-zinc-200'>
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
            Protocol
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
