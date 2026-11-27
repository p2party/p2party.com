import { useEffect } from "react";
import { ArticleContents } from "../components/ArticleContents";
import { WalletGuide } from "./wallet";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { walletDocumentHref } from "../lib/walletRestore";

import { ProtocolWalkthrough } from "../components/protocol-walkthrough/Walkthrough";
import guides from "../content/guides.json";
import protocol from "../content/protocol.md?raw";
import roadmap from "../content/roadmap.md?raw";

import whitepaper from "../content/whitepaper.md?raw";

const articles = { protocol, roadmap, whitepaper };

const Guide = ({ page }: { page: Exclude<keyof typeof guides, "wallet"> }) => {
  const { title, description } = guides[page];
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · p2party`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  if (page === "wallet/help") return <WalletGuide />;

  const headings = [...articles[page].matchAll(/^## (.+)$/gm)].map(
    (match) => match[1],
  );
  const anchor = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-$/, "");
  const sections = headings.map((title) => ({ id: anchor(title), title }));
  if (page === "protocol")
    sections.unshift({ id: "walkthrough", title: "Walk through the protocol" });
  return (
    <main className='site-reading'>
      <header className='site-reading-header'>
        <h1 className='site-title'>{title}</h1>
        <p className='site-intro'>{description}</p>
        <p className='site-meta'>
          Updated <time dateTime='2026-11-27'>27 November 2026</time>
        </p>
      </header>
      {page === "protocol" && <ProtocolWalkthrough />}
      <div className='site-reading-grid'>
        <ArticleContents sections={sections} />
        <div className='site-article-column'>
          <article className='site-paper blog-prose'>
            <ReactMarkdown
              urlTransform={(url) =>
                walletDocumentHref(defaultUrlTransform(url))
              }
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
