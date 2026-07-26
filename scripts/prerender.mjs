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

// One description and canonical per route. Without these every prerendered
// page inherited the landing page's, so eleven URLs advertised themselves as
// the same document -- the classic way to get your own pages treated as
// duplicates of each other.
const STATIC_ROUTES = [
  {
    path: "/",
    description:
      "End-to-end encrypted messaging and file transfer straight between browsers. No accounts, no cloud storage, no server that can read your messages.",
  },
  {
    path: "/privacy-policy",
    title: "Privacy policy · p2party",
    description:
      "What p2party's signaling service can and cannot see, what is stored, and for how long.",
  },
  {
    path: "/terms-of-service",
    title: "Terms of service · p2party",
    description: "The terms covering use of p2party.com.",
  },
  {
    path: "/session-lab",
    title: "Session lab · p2party",
    description:
      "Run the protocol-v4 handshake and Double Ratchet in your browser, with no network and no room, and watch each step.",
  },
  {
    path: "/blog",
    title: "Field notes · p2party",
    description:
      "How p2party's protocol was built and what it does not claim: uniform cells, hybrid post-quantum key agreement, ratcheting, and cover traffic.",
  },
];

const ROUTE_META = new Map([
  ...STATIC_ROUTES.map((route) => [route.path, route]),
  ...manifest.posts.map((post) => [
    post.href,
    {
      path: post.href,
      title: `${post.title} · p2party`,
      description: post.description,
      article: post,
    },
  ]),
]);

export const ROUTES = [...ROUTE_META.keys()];

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

  const meta = ROUTE_META.get(route);
  const canonical = `${ORIGIN}${route}`;
  const escape = (value) =>
    value
      .replace(/&/gu, "&amp;")
      .replace(/"/gu, "&quot;")
      .replace(/</gu, "&lt;");

  let html = "<!doctype html>\n" + (await page.content());

  // The app sets document.title for some routes and not others; take whatever
  // it rendered unless this route states one.
  const rendered = /<title>([^<]*)<\/title>/u.exec(html)?.[1];
  const title = meta?.title ?? rendered ?? "p2party";
  const description = meta?.description ?? "";

  const replaceTag = (pattern, replacement) => {
    html = pattern.test(html)
      ? html.replace(pattern, replacement)
      : html.replace("</head>", `    ${replacement}\n  </head>`);
  };

  html = html.replace(
    /<title>[^<]*<\/title>/u,
    `<title>${escape(title)}</title>`,
  );
  replaceTag(
    /<meta name="description" content="[^"]*"\s*\/?>/u,
    `<meta name="description" content="${escape(description)}" />`,
  );
  replaceTag(
    /<link rel="canonical" href="[^"]*"\s*\/?>/u,
    `<link rel="canonical" href="${canonical}" />`,
  );
  replaceTag(
    /<meta property="og:url" content="[^"]*"\s*\/?>/u,
    `<meta property="og:url" content="${canonical}" />`,
  );
  replaceTag(
    /<meta property="og:title" content="[^"]*"\s*\/?>/u,
    `<meta property="og:title" content="${escape(title)}" />`,
  );
  replaceTag(
    /<meta property="og:description" content="[^"]*"\s*\/?>/u,
    `<meta property="og:description" content="${escape(description)}" />`,
  );
  replaceTag(
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/u,
    `<meta name="twitter:title" content="${escape(title)}" />`,
  );
  replaceTag(
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/u,
    `<meta name="twitter:description" content="${escape(description)}" />`,
  );

  if (meta?.article) {
    html = html.replace(
      /<meta property="og:type" content="[^"]*"\s*\/?>/u,
      '<meta property="og:type" content="article" />',
    );
    const article = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: meta.article.title,
      description: meta.article.description,
      datePublished: meta.article.date,
      author: { "@type": "Person", name: manifest.series.author.name },
      mainEntityOfPage: canonical,
      url: canonical,
    };
    html = html.replace(
      "</head>",
      `    <script type="application/ld+json">${JSON.stringify(article)}</script>\n  </head>`,
    );
  }
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
