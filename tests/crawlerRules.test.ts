import { expect, test } from "bun:test";
import { renderRobots } from "../scripts/renderRobots.mjs";

test("crawler exclusions stop at room route boundaries", () => {
  const robots = renderRobots(
    [{ path: "/r" }, { path: "/rooms" }],
    "https://p2party.com",
  );
  expect(
    robots.split("\n").filter((line: string) => line.startsWith("Disallow: ")),
  ).toEqual([
    "Disallow: /r$",
    "Disallow: /r?",
    "Disallow: /r/",
    "Disallow: /rooms$",
    "Disallow: /rooms?",
    "Disallow: /rooms/",
  ]);
  expect(robots).toContain("Allow: /roadmap\n");
  expect(robots).toContain("Sitemap: https://p2party.com/sitemap.xml\n");
});
