import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `vite preview` is what this project verifies against before it deploys, so it
 * has to answer like the bucket does. When it does not, it manufactures bugs.
 *
 * It did. With Vite's default SPA fallback, every prerendered route was
 * answered with dist/index.html, so /rooms/ served the landing page's markup
 * and React reported a hydration mismatch on /blog, /privacy-policy and /rooms
 * that the live site does not have. Two behaviours have to hold, and neither is
 * visible to the type checker:
 *
 *  - prerendered routes are served from their own dist/<route>/index.html; and
 *  - a directory path with no trailing slash gets a 302 to the slashed form,
 *    which is what S3 does and what Vite's static handler does not.
 */
const config = readFileSync(
  join(import.meta.dir, "..", "vite.config.ts"),
  "utf8",
);

describe("preview answers like the bucket", () => {
  test("the SPA fallback is off for preview, and only for preview", () => {
    // Scoped to preview: the dev server has no prerendered output to serve and
    // still needs the fallback for client-side routes.
    expect(config).toContain(
      'appType: configEnv.isPreview === true ? "mpa" : "spa"',
    );
  });

  test("a directory path without a trailing slash is redirected, not 404ed", () => {
    expect(config).toContain("previewLikeTheBucket()");
    expect(config).toContain("configurePreviewServer");
    expect(config).toContain("res.statusCode = 302");
    // A request carrying an extension is an asset, not a route.
    expect(config).toContain('pathname.split("/").pop()?.includes(".")');
  });

  test("a path with no prerendered index.html still 404s", () => {
    // The redirect exists to match S3, not to invent routes. Without this
    // guard every unknown path would bounce to a slashed form and then 404
    // anyway, turning one wrong answer into two.
    expect(config).toContain(
      '!existsSync(resolve(__dirname, "dist", pathname.slice(1), "index.html"))',
    );
  });
});
