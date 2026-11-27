import { useEffect } from "react";
import { WalletGuide } from "./wallet";
import ReactMarkdown from "react-markdown";

import { ProtocolWalkthrough } from "../components/protocol-walkthrough/Walkthrough";
import guides from "../content/guides.json";
import protocol from "../content/protocol.md?raw";
import roadmap from "../content/roadmap.md?raw";

import whitepaper from "../content/whitepaper.md?raw";

const articles = { protocol, roadmap, whitepaper };

const Guide = ({ page }: { page: keyof typeof guides }) => {
  const { title, description } = guides[page];
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · p2party`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  if (page === "wallet") return <WalletGuide />;

  const headings = [...articles[page].matchAll(/^## (.+)$/gm)].map(
    (match) => match[1],
  );
  const anchor = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-$/, "");
  const contents = (
    <ul>
      {page === "protocol" && (
        <li>
          <a href='#walkthrough'>Walk through the protocol</a>
        </li>
      )}
      {headings.map((heading) => (
        <li key={heading}>
          <a href={`#${anchor(heading)}`}>{heading}</a>
        </li>
      ))}
    </ul>
  );
  return (
    <main className='site-reading'>
      <header className='site-reading-header'>
        <h1 className='site-title'>{title}</h1>
        <p className='mt-4 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300'>
          {description}
        </p>
        <p className='mt-4 font-mono text-xs text-zinc-600 dark:text-zinc-400'>
          Updated <time dateTime='2026-11-27'>27 November 2026</time>
        </p>
      </header>
      {page === "protocol" && <ProtocolWalkthrough />}
      <div className='site-reading-grid'>
        <nav aria-label='On this page' className='site-contents'>
          <details className='site-mobile-contents'>
            <summary>On this page</summary>
            {contents}
          </details>
          <div className='site-desktop-contents'>
            <h2>On this page</h2>
            {contents}
          </div>
        </nav>
        <div className='site-article-column'>
          <article className='site-paper blog-prose'>
            <ReactMarkdown
              components={{
                h2: ({ children }) => (
                  <h2 id={anchor(String(children))}>{children}</h2>
                ),
              }}
            >
              {articles[page]}
            </ReactMarkdown>
          </article>
        </div>
      </div>
    </main>
  );
};

export default Guide;
