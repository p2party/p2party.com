#!/usr/bin/env node
// ============================================================================
// Prerender the static routes into real HTML.
//
// The app is a client-rendered SPA, so `curl https://p2party.com` returned a
// bare <div id="root"></div>: zero words for any crawler that does not run
// JavaScript, which includes most social-preview fetchers and several search
// engines. The blog is entirely prose and was invisible to all of them.
//
// Each route is loaded in a real browser and its rendered DOM written to
// dist/<route>/index.html. The script tags survive, so the SPA still boots and
// takes over on load; the difference is that the first response now contains
// the text.
//
// Room routes are deliberately excluded. A room is addressed by a secret
// capability, so there is nothing to prerender and nothing that should be
// discoverable.
// ============================================================================
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";

const DIST = "dist";
const ORIGIN = "https://p2party.com";

const manifest = JSON.parse(
  await readFile("src/content/blog/index.json", "utf8"),
);

export const ROUTES = [
  "/",
  "/privacy-policy",
  "/terms-of-service",
  "/session-lab",
  "/blog",
  ...manifest.posts.map((post) => post.href),
];

const CONTENT_TYPES = {
  ".js": "text/javascript",
  ".html": "text/html",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

const serveDist = async () => {
  const server = createServer(async (request, response) => {
    let filePath = join(DIST, decodeURIComponent(request.url.split("?")[0]));
    try {
      if ((await stat(filePath)).isDirectory())
        filePath = join(filePath, "index.html");
    } catch {
      filePath = join(DIST, "index.html");
    }
    try {
      const body = await readFile(filePath);
      response.writeHead(200, {
        "content-type":
          CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("not found");
    }
  });
  await new Promise((resolve) => server.listen(0, resolve));
  return server;
};

const server = await serveDist();
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();

let failures = 0;
for (const route of ROUTES) {
  await page.goto(`http://localhost:${port}${route}`, {
    waitUntil: "networkidle",
  });
  // The router resolves lazily; wait for real text rather than a fixed delay.
  await page
    .waitForFunction(() => document.body.innerText.trim().length > 200, {
      timeout: 15_000,
    })
    .catch(() => undefined);

  const text = (await page.locator("body").innerText()).trim();
  if (text.length < 200) {
    console.error(`  FAILED ${route} rendered only ${text.length} chars`);
    failures += 1;
    continue;
  }

  const html = "<!doctype html>\n" + (await page.content());
  const outPath =
    route === "/"
      ? join(DIST, "index.html")
      : join(DIST, route.replace(/^\//u, ""), "index.html");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html, "utf8");
  console.log(`  ${route.padEnd(34)} ${String(text.length).padStart(6)} chars`);
}

await browser.close();
server.close();

// robots.txt and sitemap.xml describe exactly the routes that were rendered,
// so they cannot drift from what is actually crawlable.
await writeFile(
  join(DIST, "robots.txt"),
  [
    "User-agent: *",
    "Allow: /",
    "# Rooms are addressed by a secret capability; there is nothing to index.",
    "Disallow: /rooms",
    "",
    `Sitemap: ${ORIGIN}/sitemap.xml`,
    "",
  ].join("\n"),
  "utf8",
);

const urls = ROUTES.map((route) => {
  const post = manifest.posts.find((entry) => entry.href === route);
  return [
    "  <url>",
    `    <loc>${ORIGIN}${route === "/" ? "/" : route}</loc>`,
    post ? `    <lastmod>${post.date}</lastmod>` : "",
    `    <changefreq>${route.startsWith("/blog/") ? "yearly" : "weekly"}</changefreq>`,
    `    <priority>${route === "/" ? "1.0" : route.startsWith("/blog") ? "0.8" : "0.5"}</priority>`,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}).join("\n");

await writeFile(
  join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  "utf8",
);

console.log(`  robots.txt and sitemap.xml written (${ROUTES.length} routes)`);
if (failures > 0) {
  console.error(`Prerender failed for ${failures} route(s)`);
  process.exit(1);
}
