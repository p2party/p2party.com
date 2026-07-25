import { useEffect } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { BlogChrome } from "../components/blog/BlogChrome";
import { Link } from "../components/link";
import { blogPosts, findBlogPost } from "../content/blog";

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
      <BlogChrome>
        <main
          id='blog-content'
          className='relative mx-auto max-w-3xl px-5 py-24 sm:px-8'
        >
          <p className='font-mono text-sm text-orange-700 dark:text-orange-400'>
            404 / no such field note
          </p>
          <h1 className='mt-4 text-4xl font-black tracking-tight'>
            This packet never arrived.
          </h1>
          <Link
            href='/blog'
            className='mt-8 inline-block rounded font-mono text-sm underline decoration-orange-500 decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500'
          >
            return to the series
          </Link>
        </main>
      </BlogChrome>
    );

  const previous = blogPosts[post.order - 2];
  const next = blogPosts[post.order];

  return (
    <BlogChrome>
      <main
        id='blog-content'
        className='relative mx-auto max-w-6xl px-5 sm:px-8'
      >
        <header className='grid gap-8 pt-14 pb-10 lg:grid-cols-[1fr_15rem] lg:pt-20'>
          <div>
            <Link
              href='/blog'
              className='rounded font-mono text-xs font-bold text-orange-700 uppercase hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 dark:text-orange-400'
            >
              ← Road to protocol-v3 / {String(post.order).padStart(2, "0")}
            </Link>
            <h1 className='mt-5 max-w-4xl text-4xl leading-[1.02] font-black tracking-[-0.05em] text-balance sm:text-6xl'>
              {post.title}
            </h1>
            <p className='mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300'>
              {post.description}
            </p>
          </div>
          <dl className='h-fit border-l-4 border-orange-500 pl-4 font-mono text-xs leading-6 text-zinc-500 dark:text-zinc-400'>
            <dt className='text-zinc-900 dark:text-zinc-100'>author</dt>
            <dd>Dimitris Karoukis</dd>
            <dt className='mt-2 text-zinc-900 dark:text-zinc-100'>date</dt>
            <dd>
              <time dateTime={post.date}>{post.date}</time>
            </dd>
            <dt className='mt-2 text-zinc-900 dark:text-zinc-100'>receipts</dt>
            <dd>{post.commitAnchors.length} commits</dd>
          </dl>
        </header>

        <div className='grid gap-10 border-t border-zinc-900/20 pt-10 lg:grid-cols-[minmax(0,46rem)_1fr] dark:border-white/20'>
          <article className='blog-prose min-w-0'>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href = "", children, ...props }) => {
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

          <aside className='order-first lg:order-last'>
            <div className='sticky top-6 border border-zinc-900/20 bg-white/70 p-5 font-mono text-xs leading-6 backdrop-blur dark:border-white/20 dark:bg-black/40'>
              <p className='font-bold text-zinc-900 dark:text-zinc-100'>
                commit anchors
              </p>
              <ul className='mt-3 grid grid-cols-2 gap-x-4 lg:grid-cols-1'>
                {post.commitAnchors.map((commit) => (
                  <li key={commit}>
                    <a
                      href={`https://github.com/p2party/p2party-js/commit/${commit}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='rounded text-orange-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 dark:text-orange-400'
                    >
                      {commit} ↗
                    </a>
                  </li>
                ))}
              </ul>
              <p className='mt-5 border-t border-zinc-900/15 pt-4 text-zinc-500 dark:border-white/15 dark:text-zinc-400'>
                Shipped, gated, and research claims stay separate throughout
                this series.
              </p>
            </div>
          </aside>
        </div>

        <nav
          aria-label='Series pagination'
          className='mt-16 grid gap-4 border-t border-zinc-900/20 pt-8 sm:grid-cols-2 dark:border-white/20'
        >
          {previous ? (
            <Link
              href={previous.href}
              className='rounded border border-zinc-900/20 p-5 text-sm hover:border-orange-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 dark:border-white/20'
            >
              <span className='block font-mono text-xs text-zinc-500 dark:text-zinc-400'>
                ← previous
              </span>
              <span className='mt-2 block font-bold'>{previous.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={next.href}
              className='rounded border border-zinc-900/20 p-5 text-right text-sm hover:border-orange-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 dark:border-white/20'
            >
              <span className='block font-mono text-xs text-zinc-500 dark:text-zinc-400'>
                next →
              </span>
              <span className='mt-2 block font-bold'>{next.title}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </main>
    </BlogChrome>
  );
};

export default BlogPostPage;
