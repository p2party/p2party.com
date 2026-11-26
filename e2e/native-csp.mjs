// Checks the native build's Content-Security-Policy in headless Chromium.
// Never connects a room or contacts production.
//
// Run after `npm run build:native` (`npm run e2e:native-csp` does both), and
// again after any change to the policy in docs/deployment.md, to
// vite.config.ts, or to the vendored SDK version.
//
// dist/ is served the way Capacitor's local server serves the app -- the file
// if it exists, otherwise index.html -- on loopback, with no CSP header, so the
// meta element is the only policy. A securitypolicyviolation listener reports
// through a binding as events happen. Every request that is not to the local
// origin is aborted and every WebSocket is closed before it connects.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const out = new URL("../logs/native-csp/", import.meta.url);
const port = Number(process.env.NATIVE_CSP_PORT ?? 5847);
assert(port > 5000, "use a port above 5000");

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpeg": "image/jpeg",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(
    new URL(request.url, "http://localhost").pathname,
  );
  let file = fileURLToPath(new URL("." + pathname, new URL(`file://${dist}`)));
  if (!file.startsWith(dist)) {
    response.statusCode = 403;
    response.end();
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) file += "/index.html";
    await stat(file);
  } catch {
    file = dist + "index.html";
  }
  response.setHeader(
    "Content-Type",
    types[extname(file)] ?? "application/octet-stream",
  );
  response.end(await readFile(file));
});
await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${port}`;

const report = {
  started: new Date().toISOString(),
  origin,
  steps: [],
  violations: [],
  cspConsole: [],
  pageErrors: [],
  unexpectedRequests: [],
};
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
try {
  await context.routeWebSocket(/.*/, (socket) => {
    report.unexpectedRequests.push(socket.url());
    socket.close();
  });
  const localRequests = new Set();
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      report.unexpectedRequests.push(url.origin + url.pathname);
      await route.abort();
      return;
    }
    localRequests.add(url.pathname);
    await route.continue();
  });
  await context.exposeBinding("reportViolation", ({ page }, violation) => {
    report.violations.push({ url: page.url(), ...violation });
  });
  await context.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      window.reportViolation({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
        sample: event.sample,
      });
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (/Content.Security.Policy|Refused to/i.test(message.text()))
      report.cspConsole.push(message.text());
  });
  // Let queued violation events reach the binding before the next step.
  const settle = () =>
    page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 250)));

  // The start URL Capacitor opens.
  await page.goto(origin + "/", { waitUntil: "networkidle" });
  report.policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  assert(
    report.policy?.includes("script-src"),
    "dist/ has no CSP meta element; run npm run build:native first",
  );
  await page.locator("#root *").first().waitFor();
  await settle();
  report.steps.push("home rendered");

  // The room dialog. Visible to Playwright includes opacity 0, so wait for
  // the panel's entrance transition to finish.
  await page.goto(origin + "/rooms", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Generate Room" }).first().click();
  await page
    .getByRole("dialog")
    .getByText("New room", { exact: true })
    .waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const title = [...document.querySelectorAll('[role="dialog"] *')].find(
      (node) => node.textContent === "New room",
    );
    let opacity = 1;
    for (let node = title; node; node = node.parentElement)
      opacity *= Number(getComputedStyle(node).opacity);
    return opacity === 1;
  });
  await settle();
  report.steps.push("room dialog open");

  // An invitation: no Connect click, which would start signaling.
  await page.goto(origin + "/r#v1." + randomBytes(32).toString("base64url"), {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "Connect", exact: true }).waitFor();
  await settle();
  report.steps.push("invitation ready");

  // The local crypto proof fetches and compiles the WASM, offline.
  await page.goto(origin + "/session-lab", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "run local crypto proof" }).click();
  await page
    .getByText(/^OK — protocol |^FAILED: /)
    .first()
    .waitFor({ timeout: 60_000 });
  await settle();
  assert.deepEqual(
    await page.getByRole("alert").allTextContents(),
    [],
    "the local crypto proof failed",
  );
  report.steps.push("local crypto proof finished");

  report.wasmLoaded = [...localRequests].some((path) =>
    path.endsWith("/libcrypto.wasm"),
  );
  assert(report.wasmLoaded, "the WASM was never fetched");
  assert.equal(report.violations.length, 0, "CSP violations");
  assert.equal(report.pageErrors.length, 0, "uncaught page errors");
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
  server.close();
  report.finished = new Date().toISOString();
  await mkdir(out, { recursive: true });
  await writeFile(
    new URL("result.json", out),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
