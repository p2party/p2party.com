import { useEffect } from "react";
import { useParams } from "react-router";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { walletDocumentHref } from "../lib/walletRestore";
import remarkGfm from "remark-gfm";

import { Link } from "../components/link";
import { blogPosts, blogSeries, findBlogPost } from "../content/blog";

const BlogPostPage = () => {
  const { slug } = useParams();
  const post = findBlogPost(slug);

  useEffect(() => {
    if (!post) return;
    const previousTitle = document.title;
    document.title = `${post.title} · p2party`;
    return () => {
      document.title = previousTitle;
    };
  }, [post]);

  if (!post)
    return (
      <main className='site-reading'>
        <header className='site-reading-header'>
          <h1 className='site-title'>Field note not found</h1>
          <p className='site-intro'>
            Browse the series to find the article you need.
          </p>
        </header>
        <Link href='/blog' className='ex-text-button'>
          ← All field notes
        </Link>
      </main>
    );

  const previous = blogPosts[post.order - 2];
  const next = blogPosts[post.order];
  const sdkVersion = post.sdkVersion ?? "0.14.10";

  return (
    <main className='site-reading'>
      <header className='site-reading-header'>
        <Link href='/blog' className='site-back'>
          ← Field notes
        </Link>
        <h1 className='site-title'>{post.title}</h1>
        <p className='site-intro'>{post.description}</p>
        <p className='site-meta'>
          {post.author ?? blogSeries.author.name} ·{" "}
          <time dateTime={post.date}>{post.date}</time>
        </p>
      </header>

      <div className='site-reading-grid'>
        <article className='site-paper site-article-column blog-prose'>
          <ReactMarkdown
            urlTransform={(url) => walletDocumentHref(defaultUrlTransform(url))}
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href = "", children, ...props }) => {
                // These IDs describe the original development history, which
                // is retained privately and is not a public GitHub reference.
                if (
                  post.date < "2026-09-09" &&
                  /^https:\/\/github\.com\/p2party\/p2party-js\/commit\/[0-9a-f]{7,40}$/u.test(
                    href,
                  )
                )
                  return <span>{children}</span>;
                const external = /^https?:\/\//u.test(href);
                return (
                  <a
                    {...props}
                    href={href}
                    {...(external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {children}
                  </a>
                );
              },
              code: ({ className, children, ...props }) => {
                const isMermaid = className === "language-mermaid";
                return (
                  <code
                    {...props}
                    className={isMermaid ? "blog-mermaid" : className}
                    data-label={isMermaid ? "protocol sketch" : undefined}
                  >
                    {children}
                  </code>
                );
              },
            }}
          >
            {post.markdown}
          </ReactMarkdown>
        </article>

        <aside className='site-contents'>
          <h2>
            {post.commitAnchors.length > 0
              ? "Historical development IDs"
              : "Release references"}
          </h2>
          {post.commitAnchors.length > 0 && (
            <>
              <ul className='site-reference-ids'>
                {post.commitAnchors.map((commit) => (
                  <li key={commit}>
                    <code>{commit}</code>
                  </li>
                ))}
              </ul>
              <p className='site-reference-note'>
                These IDs refer to the original development history. The links
                below point to the public release sources.
              </p>
            </>
          )}
          <ul className='mt-3'>
            <li>
              <a
                href={`https://github.com/p2party/p2party-js/tree/v${sdkVersion}`}
                target='_blank'
                rel='noopener noreferrer'
              >
                SDK {sdkVersion} source ↗
              </a>
            </li>
            <li>
              <a href='/privacy-policy'>Service privacy policy</a>
            </li>
          </ul>
        </aside>
      </div>

      <nav aria-label='Series pagination' className='site-pagination'>
        {previous ? (
          <Link href={previous.href} className='site-paper'>
            <span className='block font-mono text-xs text-zinc-500 dark:text-zinc-400'>
              ← Previous field note
            </span>
            <span className='mt-2 block font-bold'>{previous.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={next.href} className='site-paper'>
            <span className='block font-mono text-xs text-zinc-500 dark:text-zinc-400'>
              Next field note →
            </span>
            <span className='mt-2 block font-bold'>{next.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
};

export default BlogPostPage;
