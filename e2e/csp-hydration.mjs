// Run against the built local preview. Never connects a room or contacts production.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const app = new URL(process.env.APP_URL ?? "http://127.0.0.1:5840");
assert(["127.0.0.1", "localhost", "[::1]"].includes(app.hostname));
const manifest = JSON.parse(
  await readFile(
    new URL("../src/content/blog/index.json", import.meta.url),
    "utf8",
  ),
);
const policy =
  "default-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' https: wss:; worker-src 'self' blob:; manifest-src 'self'; frame-ancestors 'none'";
const routes = [
  "/",
  "/privacy-policy/",
  "/terms-of-service/",
  "/session-lab/",
  "/protocol/",
  "/roadmap/",
  "/explorer/",
  "/explorer/mainnet/",
  "/whitepaper/",
  "/blog/",
  ...manifest.posts.map((post) => post.href + "/"),
  "/rooms/",
  "/r/",
];
const report = {
  started: new Date().toISOString(),
  app: app.origin,
  policy,
  routes: [],
  errors: [],
  violations: [],
  unexpectedRequests: [],
};
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
try {
  await context.routeWebSocket("**/*", (socket) => {
    report.unexpectedRequests.push(socket.url());
    socket.close();
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== app.origin) {
      report.unexpectedRequests.push(url.origin + url.pathname);
      await route.abort();
      return;
    }
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": policy },
    });
  });
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__cspViolations.push({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
      });
    });
  });
  for (const pathname of routes) {
    const page = await context.newPage();
    page.on("pageerror", (error) =>
      report.errors.push({ path: pathname, message: error.message }),
    );
    const fragment =
      pathname === "/r/" ? "#v1." + randomBytes(32).toString("base64url") : "";
    const response = await page.goto(new URL(pathname + fragment, app).href, {
      waitUntil: "networkidle",
    });
    assert.equal(response.status(), 200, pathname);
    const scripts = await page
      .locator("script:not([src]):not([type='application/ld+json'])")
      .allTextContents();
    assert(
      scripts.every((text) => !text.trim()),
      `${pathname} contains executable inline scripts`,
    );
    if (pathname === "/r/") {
      await page
        .getByRole("button", { name: "Connect", exact: true })
        .waitFor();
      // No click: creating production signaling state is outside this fixture.
    }
    if (pathname === "/") {
      for (const [label, path, heading] of [
        ["Protocol", "/protocol", "Protocol"],
        ["Roadmap", "/roadmap", "Roadmap"],
        ["Explorer", "/explorer", "Ledger explorer"],
      ]) {
        await page
          .getByRole("link", { name: label, exact: true })
          .first()
          .click();
        await page.waitForURL(new URL(path, app).href);
        await page
          .getByRole("heading", { level: 1, name: heading, exact: true })
          .waitFor();
        await page.goBack();
        await page.waitForURL(new URL("/", app).href);
      }
      await page
        .getByRole("link", { name: "Field notes", exact: true })
        .click();
      await page.waitForURL(new URL("/blog", app).href);
      await page
        .getByRole("heading", {
          level: 1,
          name: "Field notes",
          exact: true,
        })
        .waitFor();
      const article = manifest.posts[0];
      await page
        .getByRole("link", { name: article.title, exact: true })
        .click();
      await page.waitForURL(new URL(article.href, app).href);
      await page
        .getByRole("heading", { level: 1, name: article.title, exact: true })
        .waitFor();
    }
    await page.waitForTimeout(100);
    report.violations.push(
      ...(await page.evaluate(() => window.__cspViolations)).map((value) => ({
        path: pathname,
        ...value,
      })),
    );
    report.routes.push({ path: pathname, status: response.status() });
    await page.close();
  }
  assert.equal(report.errors.length, 0, "uncaught hydration errors");
  assert.equal(report.violations.length, 0, "CSP violations");
  assert.equal(
    report.unexpectedRequests.length,
    0,
    "unexpected external requests",
  );
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
  report.finished = new Date().toISOString();
  const out = new URL("../logs/csp-hydration/", import.meta.url);
  await mkdir(out, { recursive: true });
  await writeFile(
    new URL("result.json", out),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
