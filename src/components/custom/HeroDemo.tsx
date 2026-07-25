import { useEffect, useState } from "react";

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
  /** The technical line shown under the chat. */
  note: string;
  /** Cells lit on the wire strip at this step. */
  cells: number;
  ms: number;
}

const SCRIPT: Step[] = [
  {
    bubble: { from: "you", text: "the files are in the room" },
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

const TOTAL_CELLS = 8;
// Which strip positions carry real bytes. The point of the illustration is
// that this is not observable — the marker only appears on the legend.
const REAL_CELLS = new Set([1, 4, 6]);

const HeroDemo = () => {
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => {
      setReduced(query.matches);
    };
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    // Reduced motion gets the finished state, not a loop.
    if (reduced) {
      setStep(SCRIPT.length - 1);
      return;
    }
    const timer = setTimeout(() => {
      setStep((current) => (current + 1) % SCRIPT.length);
    }, SCRIPT[step]?.ms ?? 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [step, reduced]);

  const current = SCRIPT[step];
  const bubbles = SCRIPT.slice(0, step + 1)
    .map((s) => s.bubble)
    .filter((b): b is NonNullable<Step["bubble"]> => b !== undefined);

  return (
    <figure
      className='shadow-brutal relative w-full max-w-lg overflow-hidden border-2 border-zinc-950 bg-white dark:border-zinc-200 dark:bg-zinc-950'
      aria-label='Illustration of one message crossing the wire as uniform encrypted cells'
    >
      {/* The mark sits behind the demo rather than beside it. */}
      <img
        src='/logo-cat-tight.svg'
        alt=''
        aria-hidden
        className='pointer-events-none absolute top-4 left-1/2 h-48 -translate-x-1/2 opacity-[0.15] select-none sm:h-56 dark:opacity-[0.18]'
      />

      <figcaption className='relative flex items-center justify-between border-b-2 border-zinc-950 px-3 py-1.5 font-mono text-[10px] font-bold tracking-[0.15em] uppercase dark:border-zinc-200'>
        <span className='text-zinc-950 dark:text-white'>one message</span>
        <span className='text-orange-600 dark:text-orange-400'>
          {step + 1}/{SCRIPT.length}
        </span>
      </figcaption>

      {/* Chat */}
      <div className='relative flex min-h-56 flex-col justify-end gap-2 px-4 py-4 sm:min-h-64'>
        {bubbles.map((bubble, index) => (
          <p
            key={`${bubble.from}-${String(index)}`}
            className={
              bubble.from === "you"
                ? "animate-fade-in max-w-[85%] self-end border-2 border-zinc-950 bg-orange-500 px-2.5 py-1.5 text-xs text-white dark:border-zinc-200"
                : "animate-fade-in max-w-[85%] self-start border-2 border-zinc-950 bg-white px-2.5 py-1.5 text-xs text-zinc-950 dark:border-zinc-200 dark:bg-zinc-900 dark:text-white"
            }
          >
            {bubble.text}
          </p>
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
          className='mt-2 font-mono text-[11px] leading-relaxed text-zinc-300'
          aria-live='polite'
        >
          <span className='text-orange-400'>›</span> {current.note}
        </p>
        <p className='mt-1 font-mono text-[10px] text-zinc-500 sm:text-[11px]'>
          {REAL_CELLS.size} of {TOTAL_CELLS} cells carry your bytes — the wire
          cannot tell which
        </p>
      </div>
    </figure>
  );
};

export default HeroDemo;
