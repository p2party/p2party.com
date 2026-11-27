import { useEffect } from "react";
import ReactMarkdown from "react-markdown";

import { BlogChrome } from "../components/blog/BlogChrome";
import guides from "../content/guides.json";
import protocol from "../content/protocol.md?raw";
import roadmap from "../content/roadmap.md?raw";

const Guide = ({ page }: { page: keyof typeof guides }) => {
  const { title, description } = guides[page];
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · p2party`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <BlogChrome>
      <main
        id='blog-content'
        className='relative mx-auto max-w-4xl px-5 sm:px-8'
      >
        <header className='border-b border-zinc-900/20 pt-14 pb-8 lg:pt-20 dark:border-white/20'>
          <h1 className='text-5xl font-black tracking-[-0.055em] sm:text-6xl'>
            {title}
          </h1>
          <p className='mt-5 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300'>
            {description}
          </p>
          <p className='mt-5 font-mono text-xs text-zinc-500 dark:text-zinc-400'>
            Updated <time dateTime='2026-11-27'>27 November 2026</time>
          </p>
        </header>
        <article className='blog-prose py-8'>
          <ReactMarkdown>
            {page === "protocol" ? protocol : roadmap}
          </ReactMarkdown>
        </article>
      </main>
    </BlogChrome>
  );
};

export default Guide;
