import { useEffect, useState } from "react";

import { FileCard, MessageBubble } from "./MessageBubble";

import { CELL_BYTES, PAYLOAD_BYTES_PER_CELL } from "../../protocol/v4";

/**
 * A looping, honest demonstration of one message crossing the wire.
 *
 * Every annotation names something the protocol actually does — the fixed
 * 65,490-byte cell, the per-message ratchet step, the Merkle proof, the 1:1
 * receipt — and the wire strip shows the property that matters: real cells
 * and cover cells are the same size, so the strip looks identical either way.
 * Nothing here is a live connection; it is a scripted illustration.
 */

interface Step {
  /** Chat side, if this step adds a bubble. */
  bubble?: { from: "you" | "them"; text: string };
  /** Adds the file attachment being transferred. */
  file?: boolean;
  /** The technical line shown under the chat. */
  note: string;
  /** Cells lit on the wire strip at this step. */
  cells: number;
  ms: number;
}

const SCRIPT: Step[] = [
  {
    file: true,
    note: "X25519 3DH ⊕ ML-KEM-768 encaps → HKDF-SHA512 root",
    cells: 0,
    ms: 1900,
  },
  { note: "Double Ratchet: DH step, chain key advance", cells: 0, ms: 1100 },
  {
    note: "sparse PQ healing · OFFER → ADVANCE → ACK · epoch 1",
    cells: 1,
    ms: 1300,
  },
  { note: "split into fixed 65,490-byte cells", cells: 3, ms: 900 },
  { note: "cover cells padded to the same length", cells: 6, ms: 900 },
  {
    note: "AEAD seal · ChaCha20-Poly1305 · PQ-combined key",
    cells: 8,
    ms: 1100,
  },
  {
    bubble: { from: "you", text: "the files are in the room" },
    note: "cells shuffled — emission order carries no meaning",
    cells: 8,
    ms: 900,
  },
  {
    bubble: { from: "them", text: "got them — nothing hit a server" },
    note: "SHA-512 Merkle proof verified per cell",
    cells: 8,
    ms: 1300,
  },
  { note: "receipt per cell — real and cover alike", cells: 8, ms: 2000 },
];

/**
 * Every number below is derived from the library's constants for the ONE
 * scenario this illustration depicts — there is no generic answer, because
 * cell counts depend on the payload and on the room's settings.
 *
 *   WIRE_CHUNK_FRAME_LEN  = 65,490 B  (the complete cell on the wire)
 *   CHUNK_PLAINTEXT_LEN   = 65,405 B  (authenticated plaintext)
 *   METADATA_LEN+PROOF_LEN=  3,493 B  (header + Merkle proof)
 *   → CHUNK_LEN           = 61,912 B  of your bytes per cell, at most
 *
 * Scenario: a 256 KiB file, the app's default 90% real-data fill, and
 * "minimum cells per message" set to 8.
 *   ceil(262,144 / (0.9 x 61,912)) = 5 cells carry payload
 *   the remaining 3 are pure cover → 8 cells total
 *   each cell fragments into ~54 datagrams (65,490 / 1,210 B of UDP payload,
 *   the packet size measured on the wire)
 */
const SCENARIO = "256 KiB file · 90% fill · min 8 cells";
const TOTAL_CELLS = 8;
const PACKETS_PER_CELL = 54;
const HEX = "0123456789abcdef";

/**
 * A deterministic pseudo-random hex run, so the illustration is stable
 * across renders. These are NOT real ciphertext bytes — a landing page has
 * no session — but they stand in for the only thing an observer gets: the
 * same amount of opaque, uniformly sized bytes from every cell.
 */
const cellHex = (cell: number, length: number): string => {
  let value = (cell + 1) * 2654435761;
  let out = "";
  for (let i = 0; i < length; i++) {
    value = (value * 1103515245 + 12345) & 0x7fffffff;
    out += HEX[(value >>> (7 + (i % 5))) & 0xf];
    if (i % 2 === 1 && i !== length - 1) out += " ";
  }
  return out;
};
// Five of the eight cells carry payload (derived above); which five is not
// observable, so the positions are arbitrary by design.
const REAL_CELLS = new Set([0, 2, 3, 5, 6]);

const HeroDemo = () => {
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    // Reduced motion holds the finished state; no timer, no state writes.
    if (reduced) return;
    const timer = setTimeout(() => {
      setStep((current) => (current + 1) % SCRIPT.length);
    }, SCRIPT[step]?.ms ?? 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [step, reduced]);

  // Derived, not stored: with reduced motion the last step is simply what we
  // render, so the effect never has to write state to reach it.
  const activeStep = reduced ? SCRIPT.length - 1 : step;
  const current = SCRIPT[activeStep];
  const showFile = SCRIPT.slice(0, activeStep + 1).some((s) => s.file);
  const transferPercent = Math.round((current.cells / TOTAL_CELLS) * 100);
  const bubbles = SCRIPT.slice(0, activeStep + 1)
    .map((s) => s.bubble)
    .filter((b): b is NonNullable<Step["bubble"]> => b !== undefined);

  return (
    <figure
      className='shadow-brutal relative w-full max-w-lg overflow-hidden border-2 border-zinc-950 bg-white dark:border-zinc-200 dark:bg-zinc-950'
      aria-label='Illustration of one message crossing the wire as uniform encrypted cells'
    >
      <figcaption className='relative flex items-center justify-between border-b-2 border-zinc-950 px-3 py-1.5 font-mono text-[10px] font-bold tracking-[0.15em] uppercase dark:border-zinc-200'>
        <span className='text-zinc-950 lowercase dark:text-white'>
          p2party
          <span className='text-orange-600 dark:text-orange-400'>://</span>
          room
        </span>
        <span className='text-orange-600 dark:text-orange-400'>
          {activeStep + 1}/{SCRIPT.length}
        </span>
      </figcaption>

      {/* Chat */}
      <div className='relative flex min-h-52 flex-col justify-end gap-2 px-4 py-3.5 sm:min-h-60'>
        {/* The mark is the backdrop of the screen, centred within it. */}
        <img
          src='/logo-cat-tight.svg'
          alt=''
          aria-hidden
          className='pointer-events-none absolute top-1/2 left-1/2 h-36 -translate-x-1/2 -translate-y-1/2 opacity-[0.15] select-none sm:h-44 dark:opacity-[0.2]'
        />

        {showFile && (
          <div className='max-w-[85%] self-end'>
            <FileCard
              filename='field-photos.zip'
              extension='zip'
              size={256 * 1024}
              percentage={transferPercent}
              animate
              compact
            />
          </div>
        )}

        {bubbles.map((bubble, index) => (
          <div
            key={`${bubble.from}-${String(index)}`}
            className={`max-w-[85%] ${bubble.from === "you" ? "self-end" : "self-start"}`}
          >
            <MessageBubble
              tone={bubble.from === "you" ? "own" : "peer"}
              size='sm'
              animate
            >
              {bubble.text}
            </MessageBubble>
          </div>
        ))}
      </div>

      {/* The wire */}
      <div className='relative border-t-2 border-zinc-950 bg-zinc-950 px-4 py-3 dark:border-zinc-200'>
        <div className='flex items-center gap-1' aria-hidden>
          {Array.from({ length: TOTAL_CELLS }, (_, index) => {
            const lit = index < current.cells;
            return (
              <span
                key={index}
                className={
                  "h-6 flex-1 border transition-colors duration-300 motion-reduce:transition-none " +
                  (lit
                    ? "border-orange-400 bg-orange-500/80"
                    : "border-zinc-700 bg-zinc-900")
                }
              />
            );
          })}
        </div>
        <p
          className='mt-2 flex min-h-[2.5rem] items-start gap-1.5 font-mono text-[11px] leading-relaxed text-zinc-300'
          aria-live='polite'
        >
          <span className='text-orange-400'>›</span> {current.note}
        </p>
        {/* What an observer actually collects: opaque bytes, and counts. */}
        <div className='mt-2 border-t border-zinc-800 pt-2'>
          <p className='truncate font-mono text-[10px] text-zinc-600 sm:text-[11px]'>
            <span className='text-zinc-700'>sample</span>{" "}
            {cellHex(Math.max(0, current.cells - 1), 20)}
          </p>
          <dl className='mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 font-mono text-[10px] sm:text-[11px]'>
            <div className='flex items-baseline gap-1.5'>
              <dt className='text-zinc-500'>packets</dt>
              <dd className='text-zinc-200'>
                {(current.cells * PACKETS_PER_CELL).toLocaleString()}
              </dd>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <dt className='text-zinc-500'>cells</dt>
              <dd className='text-zinc-200'>
                {current.cells}/{TOTAL_CELLS}
              </dd>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <dt className='text-zinc-500'>carrying payload</dt>
              <dd className='text-orange-400'>
                {[...REAL_CELLS].filter((cell) => cell < current.cells).length}/
                {REAL_CELLS.size}
              </dd>
            </div>
          </dl>
          <p className='mt-1 min-h-[2rem] font-mono text-[10px] leading-relaxed text-zinc-500 sm:min-h-[1.5rem]'>
            {SCENARIO} · every cell {CELL_BYTES.toLocaleString()} B, ≤{" "}
            {PAYLOAD_BYTES_PER_CELL.toLocaleString()} B of it yours
          </p>
        </div>
      </div>
    </figure>
  );
};

export default HeroDemo;
