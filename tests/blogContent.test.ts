import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

type BlogManifest = {
  series: { id: string; status: string; author: { name: string } };
  posts: Array<{
    author?: string;
    order: number;
    slug: string;
    href: string;
    file: string;
    title: string;
    commitAnchors: string[];
  }>;
};

const contentRoot = join(import.meta.dir, "..", "src", "content", "blog");
const manifest = JSON.parse(
  readFileSync(join(contentRoot, "index.json"), "utf8"),
) as BlogManifest;

describe("protocol-v3 blog series", () => {
  test("has one ordered, unique route for every source file", () => {
    expect(manifest.series.id).toBe("road-to-protocol-v3");
    expect(manifest.series.status).toBe("published");
    const sourceFiles = readdirSync(contentRoot).filter((file) =>
      file.endsWith(".md"),
    );
    expect(manifest.posts.map(({ file }) => file).sort()).toEqual(
      sourceFiles.sort(),
    );
    expect(manifest.posts.map(({ order }) => order)).toEqual(
      manifest.posts.map((_, index) => index + 1),
    );
    expect(new Set(manifest.posts.map(({ slug }) => slug)).size).toBe(
      manifest.posts.length,
    );

    for (const post of manifest.posts) {
      expect(post.href).toBe(`/blog/${post.slug}`);
      for (const commit of post.commitAnchors)
        expect(commit).toMatch(/^[0-9a-f]{7,40}$/u);
      expect(post.title.length).toBeGreaterThan(10);
    }
  });

  test("frontmatter and public-copy boundaries stay intact", () => {
    for (const post of manifest.posts) {
      const markdown = readFileSync(join(contentRoot, post.file), "utf8");
      expect(markdown.startsWith("---\n")).toBe(true);
      expect(markdown).toContain(`slug: "${post.slug}"`);
      expect(markdown).toContain(
        `author: "${post.author ?? manifest.series.author.name}"`,
      );
      expect(markdown).not.toContain("—");
    }
  });
});
