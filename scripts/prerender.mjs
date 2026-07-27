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
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

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

/**
 * Rendered for their chrome, never indexed.
 *
 * A room is addressed by a secret capability and the saved-room list is
 * per-device, so neither belongs in an index -- but the sidebar, header and
 * layout around them are the same for everyone, and shipping those as static
 * HTML is what stops a room invite from opening on a blank page. The pages
 * pages render their pre-data state here for free: server rendering never
 * runs effects, so the room list is its skeleton rather than this machine's.
 */
const PRIVATE_ROUTES = [
  { path: "/r", title: "Room · p2party", noindex: true },
  { path: "/rooms", title: "Your rooms · p2party", noindex: true },
];

for (const route of PRIVATE_ROUTES) ROUTE_META.set(route.path, route);

export const ROUTES = [...ROUTE_META.keys()];

// A browser's worth of globals, for a build step that runs in Node.
//
// The room routes import the SDK, which reads localStorage and constructs its
// database Worker at module scope. Rendering them at all therefore needs those
// to exist. Nothing here has to behave -- the SDK's real work happens in
// effects, which server rendering never runs -- it only has to be present so
// the modules can be imported.
const memory = new Map();
globalThis.localStorage ??= {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => void memory.set(key, String(value)),
  removeItem: (key) => void memory.delete(key),
  clear: () => void memory.clear(),
  key: () => null,
  length: 0,
};
globalThis.Worker ??= class {
  postMessage() {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
};
globalThis.WebSocket ??= class {
  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
};
globalThis.indexedDB ??= {
  open: () => ({ addEventListener() {} }),
  databases: async () => [],
};

const { render } = await import("../dist-ssr/entry-server.js");

// Vite's own index.html: correct script and stylesheet tags, empty #root.
const shellHtml = await readFile(join(DIST, "index.html"), "utf8");
const ROOT_MARKER = '<div id="root"></div>';
if (!shellHtml.includes(ROOT_MARKER))
  throw new Error(`Could not find ${ROOT_MARKER} in the built index.html`);

let failures = 0;
for (const route of ROUTES) {
  let rendered;
  try {
    rendered = await render(route);
  } catch (error) {
    console.error(`  FAILED ${route}: ${error.message}`);
    failures += 1;
    continue;
  }

  const text = rendered
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  // A route that renders nothing is a broken build, not a page.
  if (text.length < 200) {
    console.error(`  FAILED ${route} rendered only ${text.length} chars`);
    failures += 1;
    continue;
  }

  let html = shellHtml.replace(ROOT_MARKER, `<div id="root">${rendered}</div>`);

  const meta = ROUTE_META.get(route);
  const canonical = `${ORIGIN}${route}`;
  const escape = (value) =>
    value
      .replace(/&/gu, "&amp;")
      .replace(/"/gu, "&quot;")
      .replace(/</gu, "&lt;");

  // Titles come from the route table only. The app sets document.title in an
  // effect, and effects do not run during server rendering, so there is no
  // rendered title to fall back to -- and inventing one from the shell would
  // give every page the same one.
  const title = meta?.title ?? "p2party";
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

  if (meta?.noindex)
    replaceTag(
      /<meta name="robots" content="[^"]*"\s*\/?>/u,
      '<meta name="robots" content="noindex, nofollow" />',
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

// The empty-shell pass that used to live here is gone: /r and /rooms are
// rendered like every other route now, minus anything device-specific, so the
// chrome is on screen immediately instead of after a third of a second of
// nothing.

// robots.txt and sitemap.xml describe exactly the routes that were rendered,
// so they cannot drift from what is actually crawlable.
await writeFile(
  join(DIST, "robots.txt"),
  [
    "User-agent: *",
    "Allow: /",
    "# Rooms are addressed by a secret capability; there is nothing to index.",
    "Disallow: /rooms",
    "Disallow: /r",
    "",
    `Sitemap: ${ORIGIN}/sitemap.xml`,
    "",
  ].join("\n"),
  "utf8",
);

// A route that carries noindex must never be advertised here. /r and /rooms are
// rendered for their chrome, not for crawlers, and listing them would both
// contradict their own robots meta and publish the shape of the private routes.
const INDEXABLE = ROUTES.filter((route) => !ROUTE_META.get(route)?.noindex);

const urls = INDEXABLE.map((route) => {
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

console.log(
  `  robots.txt and sitemap.xml written (${String(INDEXABLE.length)} indexable of ${String(ROUTES.length)} rendered)`,
);
if (failures > 0) {
  console.error(`Prerender failed for ${failures} route(s)`);
  process.exit(1);
}
