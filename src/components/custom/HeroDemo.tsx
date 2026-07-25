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
    note: "3DH + ML-KEM-768 → per-peer Double Ratchet",
    cells: 0,
    ms: 1600,
  },
  { note: "split into fixed 65,490-byte cells", cells: 2, ms: 900 },
  { note: "padded with cover cells — same size", cells: 5, ms: 900 },
  { note: "sealed · ChaCha20-Poly1305 · fresh nonce", cells: 8, ms: 900 },
  { note: "sent in randomized order", cells: 8, ms: 800 },
  {
    bubble: { from: "them", text: "got them — nothing hit a server" },
    note: "Merkle proof verified per cell",
    cells: 8,
    ms: 1100,
  },
  { note: "receipt per cell, real or cover", cells: 8, ms: 2000 },
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
      className='shadow-brutal relative w-full max-w-md overflow-hidden border-2 border-zinc-950 bg-white dark:border-zinc-200 dark:bg-zinc-950'
      aria-label='Illustration of one message crossing the wire as uniform encrypted cells'
    >
      {/* The mark sits behind the demo rather than beside it. */}
      <img
        src='/logo-cat-tight.svg'
        alt=''
        aria-hidden
        className='pointer-events-none absolute top-1/2 left-1/2 h-56 -translate-x-1/2 -translate-y-1/2 opacity-[0.13] select-none dark:opacity-[0.16]'
      />

      <figcaption className='relative flex items-center justify-between border-b-2 border-zinc-950 px-3 py-1.5 font-mono text-[10px] font-bold tracking-[0.15em] uppercase dark:border-zinc-200'>
        <span className='text-zinc-950 dark:text-white'>one message</span>
        <span className='text-orange-600 dark:text-orange-400'>
          {step + 1}/{SCRIPT.length}
        </span>
      </figcaption>

      {/* Chat */}
      <div className='relative flex min-h-24 flex-col justify-end gap-1.5 px-3 py-3'>
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
      <div className='relative border-t-2 border-zinc-950 bg-zinc-950 px-3 py-2.5 dark:border-zinc-200'>
        <div className='flex items-center gap-1' aria-hidden>
          {Array.from({ length: TOTAL_CELLS }, (_, index) => {
            const lit = index < current.cells;
            return (
              <span
                key={index}
                className={
                  "h-5 flex-1 border transition-colors duration-300 motion-reduce:transition-none " +
                  (lit
                    ? "border-orange-400 bg-orange-500/80"
                    : "border-zinc-700 bg-zinc-900")
                }
              />
            );
          })}
        </div>
        <p
          className='mt-2 font-mono text-[10px] leading-relaxed text-zinc-400'
          aria-live='polite'
        >
          <span className='text-orange-400'>›</span> {current.note}
        </p>
        <p className='mt-1 font-mono text-[10px] text-zinc-500'>
          {REAL_CELLS.size} of {TOTAL_CELLS} cells carry your bytes — the wire
          cannot tell which
        </p>
      </div>
    </figure>
  );
};

export default HeroDemo;
