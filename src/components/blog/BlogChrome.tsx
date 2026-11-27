import type { ReactNode } from "react";
import { Link } from "../link";

export const BlogChrome = ({ children }: { children: ReactNode }) => (
  <div className='relative isolate min-h-svh overflow-hidden bg-[#fffdf5] text-zinc-900 dark:bg-[#080604] dark:text-zinc-100'>
    <a
      href='#blog-content'
      className='sr-only z-50 rounded bg-orange-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3'
    >
      Skip to content
    </a>

    <div
      className='pointer-events-none fixed inset-0 opacity-[0.055] dark:opacity-[0.04]'
      style={{
        backgroundImage:
          "linear-gradient(rgba(249,115,22,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,.7) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
      aria-hidden
    />
    <div className='pointer-events-none fixed top-0 right-0 h-80 w-80 rounded-full bg-orange-300/20 blur-3xl dark:bg-orange-900/20' />

    <header className='relative border-b border-zinc-900/15 bg-[#fffdf5]/90 backdrop-blur dark:border-white/15 dark:bg-[#080604]/90'>
      <nav
        aria-label='Site navigation'
        className='mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8'
      >
        <Link
          href='/'
          className='rounded font-mono text-sm font-black tracking-[-0.04em] text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 dark:text-white'
        >
          p2party<span className='text-orange-600'>://</span>
        </Link>
        <div className='flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs'>
          {["Protocol", "Roadmap"].map((label) => (
            <Link
              key={label}
              href={`/${label.toLowerCase()}`}
              className='rounded text-zinc-600 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 dark:text-zinc-300 dark:hover:text-orange-300'
            >
              {label}
            </Link>
          ))}
          <Link
            href='/blog'
            className='rounded text-zinc-600 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 dark:text-zinc-300 dark:hover:text-orange-300'
          >
            Field notes
          </Link>
          <Link
            href='/session-lab'
            className='rounded text-zinc-600 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 dark:text-zinc-300 dark:hover:text-orange-300'
          >
            Crypto lab
          </Link>
          <Link
            href='https://github.com/p2party/p2party-js'
            target='_blank'
            rel='noopener noreferrer'
            className='rounded text-zinc-600 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 dark:text-zinc-300 dark:hover:text-orange-300'
          >
            source ↗
          </Link>
        </div>
      </nav>
    </header>

    {children}

    <footer className='relative mx-auto mt-20 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-zinc-900/15 px-5 py-8 font-mono text-xs text-zinc-500 sm:px-8 dark:border-white/15 dark:text-zinc-400'>
      <Link
        href='/'
        className='rounded hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 dark:hover:text-orange-300'
      >
        open a room →
      </Link>
    </footer>
  </div>
);
