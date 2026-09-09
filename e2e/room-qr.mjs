import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, firefox, webkit, expect } from "@playwright/test";

// Real production React, HeadlessUI portal and QRCodeAlert. The unused SDK and
// native filesystem boundary are controlled; no identity or room is created.
const root = new URL("../", import.meta.url);
const out = new URL("../logs/room-qr/", import.meta.url);
const policy =
  "default-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' https: wss:; worker-src 'self' blob:; manifest-src 'self'; frame-ancestors 'none'";
const fixture = `
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import QRCodeAlert from "./src/components/alerts/QRCodeAlert";
const roomPolicy = {version:1,revision:0,wireVersion:4,authMode:"none",pqMode:"hybrid-mlkem768",rendezvousMode:"legacy-signaling",coverMode:"immediate",coverCadenceMs:0,coverLanes:0,coverFramesPerCell:0,coverDurationEpochs:0};
const originalQrCanvas = QRCode.toCanvas.bind(QRCode);
window.pendingQr = [];
window.deferQr = false;
window.rejectQr = false;
window.throwQr = false;
QRCode.toCanvas = (...args) => {
  if (window.throwQr) throw new Error("Controlled synchronous QR failure");
  if (window.rejectQr) return Promise.reject(new Error("Controlled QR generation failure"));
  const generated = originalQrCanvas(...args);
  if (!window.deferQr) return generated;
  return new Promise((resolve, reject) => window.pendingQr.push(() => generated.then(resolve, reject)));
};
function Fixture() {
  const [open, setOpen] = useState(new URLSearchParams(location.search).get("initial") === "open");
  const [inviteUrl, setInviteUrl] = useState(location.origin + "/r#v1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  useEffect(() => {window.changeFixtureInvite = suffix => setInviteUrl(location.origin + "/r#v1." + suffix);}, []);
  return <><button onClick={() => setOpen(true)}>Open room QR</button><QRCodeAlert inviteUrl={inviteUrl} roomPolicy={roomPolicy} isOpen={open} setIsOpen={setOpen}/></>;
}
createRoot(document.getElementById("root")).render(<Fixture/>);
`;
const bundled = await build({
  stdin: {
    contents: fixture,
    resolveDir: fileURLToPath(root),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "no-signaling-sdk",
      setup(plugin) {
        plugin.onResolve({ filter: /(?:^|\/)sdk$/ }, () => ({
          path: "sdk",
          namespace: "fixture",
        }));
        plugin.onLoad({ filter: /^sdk$/, namespace: "fixture" }, () => ({
          contents:
            "export default {WIRE_CHUNK_FRAME_LEN:65490,MAX_CHUNK_SIZE:61912};",
          loader: "js",
        }));
        plugin.onResolve(
          { filter: /^@capacitor\/(core|filesystem)$/ },
          (args) => ({
            path: args.path,
            namespace: "fixture",
          }),
        );
        plugin.onLoad(
          { filter: /^@capacitor\/core$/, namespace: "fixture" },
          () => ({
            contents:
              'export const Capacitor = {getPlatform: () => window.fixtureNative ? "ios" : "web"};',
            loader: "js",
          }),
        );
        plugin.onLoad(
          { filter: /^@capacitor\/filesystem$/, namespace: "fixture" },
          () => ({
            contents: `window.nativeWrites = [];
            export const Directory = {Documents:"DOCUMENTS"};
            export const Filesystem = {writeFile: options => new Promise((resolve,reject) =>
              window.nativeWrites.push({options,resolve,reject}))};`,
            loader: "js",
          }),
        );
      },
    },
  ],
});
const logo = await readFile(new URL("public/logo-cat.svg", root));
const html =
  '<!doctype html><html><head><meta charset="utf-8"><title>Room QR regression</title></head><body><div id="root"></div><script src="/fixture.js" defer></script></body></html>';
const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  response.setHeader("Content-Security-Policy", policy);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "no-store");
  if (pathname === "/fixture.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(bundled.outputFiles[0].contents);
  } else if (pathname === "/logo-cat.svg") {
    response.setHeader("Content-Type", "image/svg+xml");
    response.end(logo);
  } else if (pathname === "/") {
    response.setHeader("Content-Type", "text/html");
    response.end(html);
  } else {
    response.writeHead(404).end();
  }
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const report = {
  started: new Date().toISOString(),
  componentSha256: createHash("sha256")
    .update(
      await readFile(new URL("src/components/alerts/QRCodeAlert.tsx", root)),
    )
    .digest("hex"),
  policy,
  fixtureInlineScripts: false,
  cases: [],
};
await mkdir(out, { recursive: true });
const pixels = (canvas) => {
  const context = canvas.getContext("2d");
  if (!context)
    return {
      width: canvas.width,
      height: canvas.height,
      opaque: 0,
      colored: 0,
    };
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let opaque = 0;
  let colored = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] > 0) opaque += 1;
    if (
      data[offset + 3] > 0 &&
      (data[offset] < 245 || data[offset + 1] < 245 || data[offset + 2] < 245)
    )
      colored += 1;
  }
  return { width: canvas.width, height: canvas.height, opaque, colored };
};
const button = (page, name) => page.getByRole("button", { name, exact: true });
const openDialog = async (page) => {
  await button(page, "Open room QR").click();
  await expect(page.getByRole("dialog")).toBeVisible();
};
const closeDialog = async (page) => {
  await button(page, "Close").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
};
const expectReady = async (page) => {
  await expect(button(page, "Download QR")).toBeEnabled();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  const rendered = await page.locator("canvas").evaluate(pixels);
  assert.equal(rendered.opaque, 1024 * 1024);
  assert(rendered.colored > 1000);
  return rendered;
};
const expectRenderFailure = async (page) => {
  await expect(page.getByRole("alert")).toHaveText(
    "Could not create the QR code. You can still copy the link.",
  );
  await expect(button(page, "Download QR")).toBeDisabled();
  await expect(button(page, "Copy link")).toBeEnabled();
};
const canvasPng = (page) =>
  page.locator("canvas").evaluate((canvas) => canvas.toDataURL("image/png"));
// Observe late asynchronous completion across browser paint/task boundaries.
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(resolve, 100)),
        ),
      ),
  );
async function controlledCase(
  browser,
  browserName,
  name,
  exercise,
  path = "/",
) {
  const context = await browser.newContext({ acceptDownloads: true });
  const result = {
    browser: browserName,
    name,
    errors: [],
    consoleErrors: [],
    violations: [],
    unexpectedRequests: [],
  };
  let page;
  try {
    await context.routeWebSocket("**/*", (socket) => {
      result.unexpectedRequests.push("websocket");
      socket.close();
    });
    await context.route("**/*", async (route) => {
      if (new URL(route.request().url()).origin !== origin) {
        result.unexpectedRequests.push(route.request().url());
        await route.abort();
      } else await route.continue();
    });
    await context.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener("securitypolicyviolation", (event) =>
        window.__cspViolations.push({
          directive: event.effectiveDirective,
          blocked: event.blockedURI,
        }),
      );
    });
    page = await context.newPage();
    page.on("pageerror", (error) => result.errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") result.consoleErrors.push(message.text());
    });
    const response = await page.goto(origin + path);
    assert.equal(response.headers()["content-security-policy"], policy);
    await page.waitForFunction(
      () => typeof window.changeFixtureInvite === "function",
    );
    await exercise(page, context, result);
    result.violations = await page.evaluate(() => window.__cspViolations);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.violations, []);
    assert.deepEqual(result.unexpectedRequests, []);
    if (name !== "failed-logo-and-recovery")
      assert.deepEqual(result.consoleErrors, []);
    result.passed = true;
  } catch (error) {
    result.passed = false;
    result.failure = error.message;
    if (page)
      result.violations = await page
        .evaluate(() => window.__cspViolations)
        .catch(() => []);
  } finally {
    await context.close();
    report.cases.push(result);
    console.log(
      JSON.stringify({
        browser: browserName,
        name,
        passed: result.passed,
        failure: result.failure,
      }),
    );
  }
}

async function exerciseFailures(browser, browserName) {
  for (const failure of [
    "null-context",
    "qr-promise-rejection",
    "qr-sync-throw",
  ]) {
    await controlledCase(
      browser,
      browserName,
      `${failure}-and-recovery`,
      async (page) => {
        await page.evaluate((mode) => {
          if (mode === "null-context") {
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (...args) {
              return args[0] === "2d" ? null : original.apply(this, args);
            };
            window.restoreCanvas = () => {
              HTMLCanvasElement.prototype.getContext = original;
            };
          } else if (mode === "qr-promise-rejection") window.rejectQr = true;
          else window.throwQr = true;
        }, failure);
        await openDialog(page);
        await expectRenderFailure(page);
        await closeDialog(page);
        await page.evaluate(() => {
          window.restoreCanvas?.();
          window.rejectQr = false;
          window.throwQr = false;
        });
        await openDialog(page);
        await expectReady(page);
      },
    );
  }
  await controlledCase(
    browser,
    browserName,
    "canvas-readback-blocked-display-and-live-unblock",
    async (page, _context, result) => {
      await page.evaluate(() => {
        const originalExport = HTMLCanvasElement.prototype.toDataURL;
        const originalRead = CanvasRenderingContext2D.prototype.getImageData;
        window.blockedCanvasCalls = { exports: 0, reads: 0 };
        HTMLCanvasElement.prototype.toDataURL = () => {
          window.blockedCanvasCalls.exports++;
          throw new DOMException(
            "Controlled canvas export restriction",
            "SecurityError",
          );
        };
        CanvasRenderingContext2D.prototype.getImageData = () => {
          window.blockedCanvasCalls.reads++;
          throw new DOMException(
            "Controlled canvas readback restriction",
            "SecurityError",
          );
        };
        window.restoreCanvas = () => {
          HTMLCanvasElement.prototype.toDataURL = originalExport;
          CanvasRenderingContext2D.prototype.getImageData = originalRead;
        };
      });
      await openDialog(page);
      await expect(button(page, "Download QR")).toBeEnabled();
      await expect(page.getByRole("status")).toHaveCount(0);
      await expect(page.getByRole("alert")).toHaveCount(0);
      assert.deepEqual(
        await page.evaluate(() => window.blockedCanvasCalls),
        {
          exports: 0,
          reads: 0,
        },
        "display performs no canvas extraction",
      );
      const canvas = page.locator("canvas");
      const displayedBeforePermission = await canvas.screenshot();
      await writeFile(
        new URL(`${browserName}-readback-blocked-displayed.png`, out),
        displayedBeforePermission,
      );
      const sameCanvas = await canvas.elementHandle();
      const timeOrigin = await page.evaluate(() => performance.timeOrigin);
      await button(page, "Download QR").click();
      await expect(page.getByRole("alert")).toHaveText(
        "Could not download the QR code. You can still copy the link.",
      );
      await expect(button(page, "Copy link")).toBeEnabled();
      assert.deepEqual(await page.evaluate(() => window.blockedCanvasCalls), {
        exports: 1,
        reads: 0,
      });
      // Simulate granting extraction permission while this same dialog is open.
      await page.evaluate(() => window.restoreCanvas());
      assert.equal(
        await page.evaluate(() => performance.timeOrigin),
        timeOrigin,
      );
      assert(
        await canvas.evaluate(
          (node, original) => node === original,
          sameCanvas,
        ),
      );
      const rendered = await canvas.evaluate(pixels);
      assert.equal(rendered.opaque, 1024 * 1024);
      assert(rendered.colored > 1000);
      assert.deepEqual(
        await canvas.screenshot(),
        displayedBeforePermission,
        "permission changes do not need to redraw the visible QR",
      );
      const expectedPng = Buffer.from(
        (await canvasPng(page)).split(",")[1],
        "base64",
      );
      const pendingDownload = page.waitForEvent("download");
      await button(page, "Download QR").click();
      const download = await pendingDownload;
      assert.equal(download.suggestedFilename(), "p2party-room-invite.png");
      assert.deepEqual(await readFile(await download.path()), expectedPng);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      result.rendered = rendered;
      result.scope =
        "Canvas-extraction API restrictions simulated in the actual browser; no native Firefox permission prompt was automated.";
      result.noReload = true;
    },
  );
  await controlledCase(
    browser,
    browserName,
    "failed-logo-and-recovery",
    async (page, context, result) => {
      const rejectLogo = (route) => route.abort();
      await context.route("**/logo-cat.svg", rejectLogo);
      await openDialog(page);
      await expectRenderFailure(page);
      result.expectedFailure =
        "The fixture deliberately aborts the local logo image request.";
      await closeDialog(page);
      await context.unroute("**/logo-cat.svg", rejectLogo);
      await openDialog(page);
      await expectReady(page);
    },
  );
  await controlledCase(
    browser,
    browserName,
    "download-failure-and-retry",
    async (page) => {
      await openDialog(page);
      await expectReady(page);
      await page.evaluate(() => {
        const original = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = () => {
          throw new DOMException(
            "Controlled export restriction",
            "SecurityError",
          );
        };
        window.restoreCanvas = () => {
          HTMLCanvasElement.prototype.toDataURL = original;
        };
      });
      let downloads = 0;
      page.on("download", () => downloads++);
      await button(page, "Download QR").click();
      await expect(page.getByRole("alert")).toHaveText(
        "Could not download the QR code. You can still copy the link.",
      );
      await expect(button(page, "Copy link")).toBeEnabled();
      await expect(page.getByRole("dialog")).toBeVisible();
      assert.equal(downloads, 0);
      await page.evaluate(() => window.restoreCanvas());
      const downloadPromise = page.waitForEvent("download");
      await button(page, "Download QR").click();
      assert.equal(
        (await downloadPromise).suggestedFilename(),
        "p2party-room-invite.png",
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);
      assert.equal(downloads, 1);
    },
  );
  await controlledCase(
    browser,
    browserName,
    "loading-and-stale-invite",
    async (page, _context, result) => {
      await page.evaluate(() => {
        window.deferQr = true;
      });
      await openDialog(page);
      await page.waitForFunction(() => window.pendingQr.length === 1);
      await expect(page.getByRole("status")).toHaveText("Creating QR code…");
      await expect(button(page, "Download QR")).toBeDisabled();
      await expect(button(page, "Copy link")).toBeEnabled();
      const blank = await canvasPng(page);
      await page.evaluate(() =>
        window.changeFixtureInvite(
          "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        ),
      );
      await page.waitForFunction(() => window.pendingQr.length === 2);
      await page.evaluate(() =>
        window.changeFixtureInvite(
          "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
        ),
      );
      await page.waitForFunction(() => window.pendingQr.length === 3);
      // Finish the old real QR calculation after the new invite has started.
      await page.evaluate(() => window.pendingQr[0]());
      await settle(page);
      await expect(button(page, "Download QR")).toBeDisabled();
      assert.equal(
        await canvasPng(page),
        blank,
        "old result cannot draw into the new invitation",
      );
      await page.evaluate(() => window.pendingQr[2]());
      await expectReady(page);
      const latest = await canvasPng(page);
      await page.evaluate(() => window.pendingQr[1]());
      await settle(page);
      await expectReady(page);
      assert.equal(
        await canvasPng(page),
        latest,
        "late old result cannot replace the ready current invitation",
      );
      await closeDialog(page);
      await page.evaluate(() => {
        window.deferQr = false;
      });
      await openDialog(page);
      await expectReady(page);
      assert.equal(
        await canvasPng(page),
        latest,
        "latest invitation matches a fresh independent rendering",
      );
      result.latestPngSha256 = createHash("sha256")
        .update(latest)
        .digest("hex");
    },
  );
  for (const completion of ["success", "failure"]) {
    await controlledCase(
      browser,
      browserName,
      `stale-native-write-${completion}`,
      async (page, _context, result) => {
        await page.evaluate(() => {
          window.fixtureNative = true;
        });
        await openDialog(page);
        await expectReady(page);
        const png = await canvasPng(page);
        await button(page, "Download QR").click();
        await page.waitForFunction(() => window.nativeWrites.length === 1);
        const options = await page.evaluate(
          () => window.nativeWrites[0].options,
        );
        assert.equal(options.path, "p2party/room-invite.png");
        assert.equal(options.data, png.split(",")[1]);
        if (completion === "success") await closeDialog(page);
        await page.evaluate(() =>
          window.changeFixtureInvite(
            "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
          ),
        );
        if (completion === "success") await openDialog(page);
        await expectReady(page);
        await page.evaluate((outcome) => {
          if (outcome === "success")
            window.nativeWrites[0].resolve({
              uri: "file:///controlled-test.png",
            });
          else
            window.nativeWrites[0].reject(
              new Error("Controlled native write rejection"),
            );
        }, completion);
        await settle(page);
        await expect(page.getByRole("dialog")).toBeVisible();
        await expectReady(page);
        result.scope =
          "Mocked Capacitor filesystem boundary; no native device or disk write.";
      },
    );
  }
}
try {
  for (const [browserName, browserType] of [
    ["chromium", chromium],
    ["firefox", firefox],
    ["webkit", webkit],
  ]) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const initiallyOpen of [false, true]) {
        await controlledCase(
          browser,
          browserName,
          `first-and-reopen-initially-${initiallyOpen ? "open" : "closed"}`,
          async (page, _context, result) => {
            result.initiallyOpen = initiallyOpen;
            result.opens = [];
            if (!initiallyOpen) await openDialog(page);
            for (const attempt of ["first-open", "reopen"]) {
              const dialog = page.getByRole("dialog");
              await expect(dialog).toBeVisible();
              const canvas = dialog.locator("canvas");
              await expect(canvas).toBeVisible();
              let drawFailure;
              try {
                await expect
                  .poll(async () => (await canvas.evaluate(pixels)).colored, {
                    timeout: 3_000,
                  })
                  .toBeGreaterThan(1000);
              } catch (error) {
                drawFailure = error.message;
              }
              const canvasPixels = await canvas.evaluate(pixels);
              result.opens.push({
                attempt,
                canvasPixels,
                downloadEnabled: await dialog
                  .getByRole("button", { name: "Download QR", exact: true })
                  .isEnabled(),
                ...(drawFailure ? { failure: drawFailure } : {}),
              });
              if (drawFailure) {
                await dialog
                  .getByRole("button", { name: "Close", exact: true })
                  .click();
              } else {
                const expectedPng = Buffer.from(
                  (
                    await canvas.evaluate((node) => node.toDataURL("image/png"))
                  ).split(",")[1],
                  "base64",
                );
                if (!initiallyOpen && attempt === "first-open") {
                  await writeFile(
                    new URL(`${browserName}-invite-1024.png`, out),
                    expectedPng,
                  );
                  await canvas.screenshot({
                    path: fileURLToPath(
                      new URL(`${browserName}-invite-displayed.png`, out),
                    ),
                  });
                  await writeFile(
                    new URL(`${browserName}-invite.txt`, out),
                    `${origin}/r#v1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\n`,
                  );
                }
                const downloadPromise = page.waitForEvent("download");
                await dialog
                  .getByRole("button", { name: "Download QR", exact: true })
                  .click();
                const download = await downloadPromise;
                assert.equal(
                  download.suggestedFilename(),
                  "p2party-room-invite.png",
                );
                const png = await readFile(await download.path());
                assert.deepEqual(
                  png,
                  expectedPng,
                  "download preserves exact rendered PNG bytes",
                );
                assert.equal(
                  png.subarray(0, 8).toString("hex"),
                  "89504e470d0a1a0a",
                );
                assert.equal(png.readUInt32BE(16), 1024);
                assert.equal(png.readUInt32BE(20), 1024);
                result.opens.at(-1).download = {
                  format: "PNG",
                  bytes: png.length,
                  width: png.readUInt32BE(16),
                  height: png.readUInt32BE(20),
                  sha256: createHash("sha256").update(png).digest("hex"),
                };
                const downloadedPixels = await page.evaluate(async (base64) => {
                  const image = new Image();
                  image.src = `data:image/png;base64,${base64}`;
                  await image.decode();
                  const canvas = document.createElement("canvas");
                  canvas.width = image.naturalWidth;
                  canvas.height = image.naturalHeight;
                  const ctx = canvas.getContext("2d");
                  ctx.drawImage(image, 0, 0);
                  const data = ctx.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height,
                  ).data;
                  let opaque = 0;
                  let colored = 0;
                  for (let offset = 0; offset < data.length; offset += 4) {
                    if (data[offset + 3] > 0) opaque += 1;
                    if (
                      data[offset + 3] > 0 &&
                      (data[offset] < 245 ||
                        data[offset + 1] < 245 ||
                        data[offset + 2] < 245)
                    )
                      colored += 1;
                  }
                  return {
                    width: canvas.width,
                    height: canvas.height,
                    opaque,
                    colored,
                  };
                }, png.toString("base64"));
                assert.deepEqual(
                  downloadedPixels,
                  canvasPixels,
                  "download preserves rendered pixel content",
                );
                result.opens.at(-1).download.pixels = downloadedPixels;
              }
              await expect(dialog).toHaveCount(0);
              if (attempt === "first-open")
                await page
                  .getByRole("button", { name: "Open room QR", exact: true })
                  .click();
            }
            assert(
              result.opens.every((entry) => !entry.failure),
              "canvas did not draw on every open",
            );
          },
          `/?initial=${initiallyOpen ? "open" : "closed"}`,
        );
      }
      await exerciseFailures(browser, browserName);
    } finally {
      await browser.close();
    }
  }
  report.passed = report.cases.every((result) => result.passed);
  if (!report.passed) process.exitCode = 1;
} finally {
  await new Promise((resolve) => server.close(resolve));
  report.finished = new Date().toISOString();
  await mkdir(out, { recursive: true });
  await writeFile(
    new URL("result.json", out),
    JSON.stringify(report, null, 2) + "\n",
  );
}
