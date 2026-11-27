import { Link } from "../components/link";
import { blogPosts } from "../content/blog";

const BlogPage = () => (
  <main className='site-reading'>
    <header className='site-reading-header'>
      <h1 className='site-title'>Field notes</h1>
      <p className='site-intro'>
        Release reports and experiments from the first fixed-size cells to the
        current browser protocol and public testnet.
      </p>
    </header>
    <div className='site-reading-grid'>
      <ol className='site-article-column site-post-list'>
        {blogPosts.toReversed().map((post) => (
          <li key={post.slug}>
            <div className='site-meta'>
              <time dateTime={post.date}>{post.date}</time>
              {post.commitAnchors.length > 0 &&
                ` · ${post.commitAnchors.length} historical development IDs`}
            </div>
            <h2>
              <Link href={post.href}>
                {post.title}
                <span aria-hidden='true'> →</span>
              </Link>
            </h2>
            <p>{post.description}</p>
          </li>
        ))}
      </ol>
      <aside className='site-contents' aria-label='Current documentation'>
        <h2>Current documentation</h2>
        <ul>
          <li>
            <Link href='/protocol'>Protocol guide</Link>
          </li>
          <li>
            <Link href='/roadmap'>Roadmap and measured results</Link>
          </li>
          <li>
            <Link href='/blog/room-history-and-purge'>
              Room recovery and purge · SDK 0.15.1
            </Link>
          </li>
        </ul>
      </aside>
    </div>
  </main>
);

export default BlogPage;
