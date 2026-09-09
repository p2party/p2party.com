import { createServer } from "node:http";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";

// Exercise the production component's real React events with controlled SDK
// promises. No server, credentials, browser identity or package mutation needed.
const fixture = `
import React from "react";
import { createRoot } from "react-dom/client";
import PendingTransfers from "./src/components/custom/PendingTransfers";
const root = createRoot(document.getElementById("root"));
window.showRoom = roomId => root.render(<PendingTransfers key={roomId} roomId={roomId} channelLabel="chat" liveTransferIds={[]} />);
window.showRoom("room-a");
`;
const bundled = await build({
  stdin: { contents: fixture, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "controlled-sdk",
      setup(plugin) {
        plugin.onResolve({ filter: /protocol\/sdk$/ }, () => ({
          path: "sdk",
          namespace: "fixture",
        }));
        plugin.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: "export default window.pendingSdk;",
          loader: "js",
        }));
      },
    },
  ],
});
const setup = `
const make = (roomId, filename) => ({ roomId, filename, transferId: roomId, channelLabel: "chat", totalSize: 8,
  totalChunks: 2, createdAt: Date.now(), updatedAt: Date.now(), expiresAt: Date.now()+86400000,
  phase: "pending", retryable: true, retryAfter: 0, remainingRecipients: [{peerId:"peer",publicKey:"key"}] });
window.pendingRows = { "room-a": [make("room-a", "alpha.bin")], "room-b": [make("room-b", "beta.bin")] };
window.retryResolvers = {};
window.cancelCalls = [];
window.failReads = false;
window.pendingSdk = {
  listPendingMessages: async room => { if (window.failReads) throw new Error("temporary storage failure"); return structuredClone(window.pendingRows[room]); },
  resumePendingMessages: room => {
    window.pendingRows[room].forEach(row => { row.phase = "sending"; row.retryAfter = Date.now()+30000; });
    return new Promise(resolve => { window.retryResolvers[room] = result => {
      window.pendingRows[room].forEach(row => { row.phase = "pending"; row.retryAfter = 0; });
      resolve(result);
    }; });
  },
  cancelPendingMessage: async (room, id) => { window.cancelCalls.push({room,id}); window.pendingRows[room] = []; },
};
`;
const html = `<!doctype html><html><body><div id="root"></div><script>${setup}</script><script>${bundled.outputFiles[0].text}</script></body></html>`;
const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html" });
  response.end(html);
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await expect(page.getByText("alpha.bin", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Retry pending transfers", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cancel pending alpha.bin", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => window.showRoom("room-b"));
  await expect(page.getByText("beta.bin", { exact: true })).toBeVisible();
  await page.evaluate(() => window.retryResolvers["room-a"]([]));
  await expect(
    page.getByRole("button", { name: "Retry pending transfers", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => window.showRoom("room-a"));
  await expect(page.getByText("alpha.bin", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry pending transfers", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Retry pending transfers", exact: true })
    .click();
  await page.evaluate(() => window.showRoom("room-b"));
  await expect(page.getByText("beta.bin", { exact: true })).toBeVisible();
  await page.evaluate(() => window.showRoom("room-a"));
  await expect(page.getByText("alpha.bin", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retrying…", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel pending alpha.bin", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Cancel pending alpha.bin", exact: true })
    .click();
  await expect(page.getByText("alpha.bin", { exact: true })).toHaveCount(0);
  assert.deepEqual(await page.evaluate(() => window.cancelCalls), [
    { room: "room-a", id: "room-a" },
  ]);
  await page.evaluate(() => window.retryResolvers["room-a"]([]));

  await page.evaluate(() => {
    window.failReads = true;
  });
  await expect(page.getByRole("alert")).toHaveText("temporary storage failure");
  await page.evaluate(() => {
    window.failReads = false;
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.evaluate(() => {
    window.pendingRows["room-a"] = [
      {
        ...window.pendingRows["room-b"][0],
        roomId: "room-a",
        filename: "interrupted.bin",
        phase: "staging",
        retryable: false,
        retryAfter: 0,
      },
    ];
  });
  await expect(
    page.getByText(
      "Preparation was interrupted. Choose the file again or cancel this transfer.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry pending transfers", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Cancel pending interrupted.bin",
      exact: true,
    }),
  ).toBeEnabled();
  assert.deepEqual(errors, []);
  process.stdout.write(
    JSON.stringify({
      pass: true,
      checks: [
        "cancel during retry",
        "room navigation operation cleanup",
        "active retry survives keyed room remount",
        "read error recovery",
        "interrupted staging",
      ],
      pageErrors: errors,
    }) + "\n",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
