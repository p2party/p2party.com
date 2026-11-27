import { useEffect } from "react";
import ReactMarkdown from "react-markdown";

import { WALLET_RESTORE_URL } from "../lib/walletRestore";
import { WalletBalance } from "../components/WalletBalance";
import wallet from "../content/wallet.md?raw";
import guides from "../content/guides.json";
import protocol from "../content/protocol.md?raw";
import roadmap from "../content/roadmap.md?raw";

import whitepaper from "../content/whitepaper.md?raw";

const articles = { protocol, roadmap, whitepaper, wallet };

const Guide = ({ page }: { page: keyof typeof guides }) => {
  const { title, description } = guides[page];
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · p2party`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  const headings = [...articles[page].matchAll(/^## (.+)$/gm)].map(
    (match) => match[1],
  );
  const anchor = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-$/, "");
  if (page === "wallet") headings.push("Check a public balance");
  const contents = (
    <ul>
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
        {page === "wallet" && (
          <div className='mt-4 flex flex-wrap items-center gap-4'>
            <a
              className='ex-button'
              href={WALLET_RESTORE_URL}
              referrerPolicy='no-referrer'
            >
              Restore a wallet
            </a>
            <a className='ex-text-button' href='#check-a-public-balance'>
              Watch a balance
            </a>
          </div>
        )}
        <p className='mt-4 font-mono text-xs text-zinc-600 dark:text-zinc-400'>
          Updated <time dateTime='2026-11-27'>27 November 2026</time>
        </p>
      </header>
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
          {page === "wallet" && <WalletBalance />}
        </div>
      </div>
    </main>
  );
};

export default Guide;
