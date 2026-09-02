import { BlogChrome } from "../components/blog/BlogChrome";
import { Link } from "../components/link";
import { blogPosts, blogSeries } from "../content/blog";

const BlogPage = () => (
  <BlogChrome>
    <main id='blog-content' className='relative mx-auto max-w-6xl px-5 sm:px-8'>
      <section className='grid gap-10 pt-14 pb-12 lg:grid-cols-[1.15fr_.85fr] lg:items-end lg:pt-20'>
        <div>
          <p className='mb-4 font-mono text-xs font-bold tracking-[0.18em] text-orange-700 uppercase dark:text-orange-400'>
            {blogPosts.length} commits-to-consequences reports
          </p>
          <h1 className='max-w-3xl text-4xl leading-[0.98] font-black tracking-[-0.055em] text-balance sm:text-6xl'>
            {blogSeries.title}
          </h1>
          <p className='mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300'>
            {blogSeries.description}
          </p>
        </div>

        <aside
          aria-label='Series status'
          className='shadow-brutal border border-zinc-900 bg-zinc-950 p-5 font-mono text-xs leading-6 text-zinc-300 dark:border-zinc-700'
        >
          <p className='text-orange-400'>$ ./threat-model --honest</p>
          <p className='mt-3'>
            shipped <span className='text-emerald-400'>≠</span> researched
          </p>
          <p>
            fixed cells <span className='text-emerald-400'>≠</span> anonymity
          </p>
          <p>
            green tests <span className='text-emerald-400'>≠</span> proof
          </p>
          <p>
            “free” <span className='text-emerald-400'>≠</span> zero cost
          </p>
          <p className='mt-3 text-zinc-500'>exit 0 only after measurements</p>
        </aside>
      </section>

      <ol className='border-t border-zinc-900/20 dark:border-white/20'>
        {blogPosts.map((post) => (
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
                {post.commitAnchors.length} commit anchors ·{" "}
                <time dateTime={post.date}>{post.date}</time>
              </p>
            </div>
            <Link
              href={post.href}
              aria-label={`Read ${post.title}`}
              className='w-fit rounded border border-zinc-900 px-3 py-2 font-mono text-xs font-bold transition group-hover:bg-orange-600 group-hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 dark:border-zinc-500'
            >
              read →
            </Link>
          </li>
        ))}
      </ol>
    </main>
  </BlogChrome>
);

export default BlogPage;
