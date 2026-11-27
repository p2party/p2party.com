import { Link } from "../components/link";
import { blogPosts } from "../content/blog";

const BlogPage = () => (
  <main className='site-reading'>
    <section className='grid gap-10 pt-14 pb-12 lg:grid-cols-[1.15fr_.85fr] lg:items-end lg:pt-20'>
      <div>
        <p className='mb-4 font-mono text-xs font-bold tracking-[0.18em] text-orange-700 uppercase dark:text-orange-400'>
          {blogPosts.length} protocol and research reports
        </p>
        <h1 className='site-title'>Field notes</h1>
        <p className='mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300'>
          Release reports and experiments from the first fixed-size cells to the
          current browser protocol and public testnet.
        </p>
      </div>

      <aside
        aria-label='Current documentation'
        className='shadow-brutal border-2 border-zinc-950 bg-zinc-950 p-5 font-mono text-xs leading-6 text-zinc-300 dark:border-zinc-700'
      >
        <p className='mb-2 font-bold text-orange-400'>Current documentation</p>
        <Link
          href='/protocol'
          className='block underline underline-offset-4 hover:text-white'
        >
          Protocol guide
        </Link>
        <Link
          href='/roadmap'
          className='block underline underline-offset-4 hover:text-white'
        >
          Roadmap and measured results
        </Link>
        <Link
          href='/blog/room-history-and-purge'
          className='block underline underline-offset-4 hover:text-white'
        >
          Room recovery and purge · SDK 0.15.1
        </Link>
      </aside>
    </section>

    <ol className='border-t-2 border-zinc-950 dark:border-zinc-200'>
      {blogPosts.toReversed().map((post) => (
        <li
          key={post.slug}
          className='group grid gap-4 border-b border-zinc-900/20 py-8 sm:grid-cols-[5rem_1fr_auto] sm:items-start dark:border-white/20'
        >
          <span className='font-mono text-3xl font-black text-orange-600 dark:text-orange-500'>
            {String(post.order).padStart(2, "0")}
          </span>
          <div>
            <h2 className='text-2xl leading-tight font-extrabold tracking-[-0.025em] sm:text-3xl'>
              <Link
                href={post.href}
                className='rounded decoration-orange-500 decoration-2 underline-offset-4 group-hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500'
              >
                {post.title}
              </Link>
            </h2>
            <p className='mt-3 max-w-3xl leading-7 text-zinc-600 dark:text-zinc-300'>
              {post.description}
            </p>
            <p className='mt-4 font-mono text-[11px] tracking-wide text-zinc-500 uppercase dark:text-zinc-400'>
              {post.commitAnchors.length > 0
                ? `${post.commitAnchors.length} historical development IDs`
                : "Release and research update"}{" "}
              · <time dateTime={post.date}>{post.date}</time>
            </p>
          </div>
          <Link
            href={post.href}
            aria-label={`Read ${post.title}`}
            className='shadow-brutal-sm w-fit border-2 border-zinc-950 bg-white px-3 py-2 text-sm font-bold transition group-hover:bg-orange-600 group-hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 dark:border-zinc-500 dark:bg-black'
          >
            read →
          </Link>
        </li>
      ))}
    </ol>
  </main>
);

export default BlogPage;
