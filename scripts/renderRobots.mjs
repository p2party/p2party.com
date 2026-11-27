/** Match each private route, its query strings, and its descendants. */
export const renderRobots = (privateRoutes, origin) =>
  [
    "User-agent: *",
    "Allow: /",
    ...privateRoutes.flatMap(({ path }) => [
      `Disallow: ${path}$`,
      `Disallow: ${path}?`,
      `Disallow: ${path}/`,
    ]),
    "Allow: /roadmap",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
