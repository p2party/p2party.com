import manifest from "./index.json";
import post01 from "./01-the-64-kib-lie.md?raw";
import post02 from "./02-green-tests-are-not-a-security-proof.md?raw";
import post03 from "./03-a-room-is-n-minus-one-sessions.md?raw";
import post04 from "./04-protocol-v3-is-not-pqxdh.md?raw";
import post05 from "./05-free-is-a-dangerous-word.md?raw";
import post06 from "./06-borrowing-from-spqr.md?raw";
import post07 from "./07-an-open-channel-is-not-a-live-peer.md?raw";
import post08 from "./08-after-the-desync-fixes.md?raw";
import post09 from "./09-rooms-after-signaling-v5.md?raw";
import post10 from "./10-room-history-and-purge.md?raw";

import post11 from "./11-ai-math-and-p2party-keys.md?raw";

import post12 from "./12-restoring-a-p2party-wallet.md?raw";

const markdownByFile = new Map<string, string>([
  ["01-the-64-kib-lie.md", post01],
  ["02-green-tests-are-not-a-security-proof.md", post02],
  ["03-a-room-is-n-minus-one-sessions.md", post03],
  ["04-protocol-v3-is-not-pqxdh.md", post04],
  ["05-free-is-a-dangerous-word.md", post05],
  ["06-borrowing-from-spqr.md", post06],
  ["07-an-open-channel-is-not-a-live-peer.md", post07],
  ["08-after-the-desync-fixes.md", post08],
  ["09-rooms-after-signaling-v5.md", post09],
  ["10-room-history-and-purge.md", post10],
  ["11-ai-math-and-p2party-keys.md", post11],
  ["12-restoring-a-p2party-wallet.md", post12],
]);

const stripFrontmatter = (markdown: string): string => {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n/u.exec(markdown);
  if (!match) throw new Error("Blog post is missing YAML frontmatter");
  return markdown.slice(match[0].length);
};

export interface BlogPost {
  order: number;
  slug: string;
  href: string;
  title: string;
  description: string;
  date: string;
  commitAnchors: string[];
  author?: string;
  sdkVersion?: string;
  markdown: string;
}

export const blogSeries = manifest.series;

export const blogPosts: BlogPost[] = manifest.posts.map((post) => {
  const markdown = markdownByFile.get(post.file);
  if (!markdown) throw new Error(`Missing blog source: ${post.file}`);
  return { ...post, markdown: stripFrontmatter(markdown) };
});

export const findBlogPost = (slug: string | undefined): BlogPost | undefined =>
  blogPosts.find((post) => post.slug === slug);
