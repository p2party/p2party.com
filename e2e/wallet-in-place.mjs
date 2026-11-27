// Exercise the actual built signing document behind production's CSP.
// All wallet material is ephemeral. Only a fixture public checkpoint enters the worker.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { chromium, firefox, webkit, expect } from "@playwright/test";

const publicRoot = new URL("../public/", import.meta.url);
const { snapshot } = JSON.parse(
  await readFile(new URL("wallet/snapshot/checkpoint.json", publicRoot)),
);
const prefix = JSON.parse(
  await readFile(
    new URL("../wallet/browser/checkpoint-history.json", import.meta.url),
  ),
);
const workerScript = `
  let started = false;
  const nonce = 'a'.repeat(64);
  onmessage = ({data}) => {
    if (!started && data.type === 'sync' && Object.keys(data).length === 1) {
      started = true;
      postMessage({type:'p2party.wallet.catchup.start.v1', nonce, chainId:${JSON.stringify(snapshot.chainId)}, genesisHash:${JSON.stringify(snapshot.genesisHash)}, fromHeight:${JSON.stringify(snapshot.height)}, headHeight:${JSON.stringify(snapshot.height)}, headMoveId:${JSON.stringify(prefix.at(-1).id)}});
    } else if (started && data.type === 'p2party.wallet.catchup.ack.v1' && data.nonce === nonce && data.height === ${JSON.stringify(snapshot.height)} && Object.keys(data).length === 3) {
      postMessage({type:'p2party.wallet.catchup.done.v1', nonce, snapshot:${JSON.stringify(snapshot)}});
    } else postMessage({type:'error'});
  };`;
const types = {
  html: "text/html",
  js: "text/javascript",
  mjs: "text/javascript",
  css: "text/css",
  svg: "image/svg+xml",
};
const requests = [];
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    requests.push({ path, method: req.method });
    const file = path.slice(1) + (path.endsWith("/") ? "index.html" : "");
    res.setHeader("Content-Type", types[file.split(".").pop()] || "text/plain");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https: wss:; worker-src 'self' blob:; frame-ancestors 'none'",
    );
    if (
      process.env.WALLET_PUBLIC_HISTORY !== "1" &&
      path === "/wallet/snapshot/worker.mjs"
    )
      return res.end(workerScript);
    if (path === "/wallet/help/") return res.end("<title>Wallet help</title>");
    res.end(await readFile(new URL(file, publicRoot)));
  } catch {
    res.writeHead(404).end();
  }
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = "http://127.0.0.1:" + server.address().port;
const url = origin + "/wallet/";
const engines = { chromium, firefox, webkit };
let kit;
try {
  for (const name of (process.env.WALLET_BROWSERS || "chromium").split(",")) {
    const browser = await engines[name].launch();
    try {
      const ctx = await browser.newContext({
        viewport: { width: 320, height: 640 },
      });
      const page = await ctx.newPage();
      const urls = [];
      page.on("request", (req) => urls.push(req.url()));
      await page.goto(url);
      const create = page.getByRole("link", { name: /^Create a wallet/ });
      const restore = page.getByRole("link", { name: /^Restore a wallet/ });
      await expect(restore).toBeInViewport();
      await expect(create).toBeInViewport();
      const account = page.getByRole("button", {
        name: "Account",
        exact: true,
      });
      await account.click();
      await expect(page.locator("#shared-total")).toBeHidden();
      await page.keyboard.press("Escape");
      await expect(account).toBeFocused();
      await create.click();
      assert.equal(page.url(), url + "#create");
      await page.locator("#create-receive").click();
      await expect(page.locator("#receive-kit")).toBeVisible();
      await expect(page.locator("#request-public-data")).toBeHidden();
      const downloading = page.waitForEvent("download");
      await page.locator("#kit-download").click();
      const dl = await downloading;
      const file = {
        name: dl.suggestedFilename(),
        mimeType: "application/octet-stream",
        buffer: await readFile(await dl.path()),
      };
      await page.locator("#show-new-code").click();
      const code = await page.locator("#new-wallet-code").innerText();
      assert.ok(code.startsWith("P2W1-"));
      await page.locator("#kit-file").setInputFiles(file);
      await page.locator("#kit-code").fill(code);
      await page
        .getByRole("button", { name: "Check backup and open request" })
        .click();
      await expect(page.locator("#dashboard")).toBeVisible();
      const request = await page.locator("#receive-text").inputValue();
      assert.ok(request.includes('"commitment"'));
      assert.ok(!urls.some((v) => v.includes("/snapshot/")));
      kit ??= { file, code, request };
      await ctx.close();

      const restored = await browser.newContext();
      const tab = await restored.newPage();
      await tab.goto(url + "#restore");
      if (name === "firefox") {
        await tab.locator("#paste-panel summary").click();
        await tab
          .locator("#archive-text")
          .fill(kit.file.buffer.toString("utf8"));
      } else await tab.locator("#archive").setInputFiles(kit.file);
      await tab.locator("#code").fill(kit.code);
      await tab.locator("#open").click();
      await expect(tab.locator("#dashboard")).toBeVisible();
      assert.equal(
        await tab.locator("#receive-text").inputValue(),
        kit.request,
      );
      await expect(tab.locator("#summary-amount")).toHaveText("0 P2PARTY");
      await tab.locator("#summary-check").click();
      await expect(tab.locator("#summary-status")).toContainText(
        "Balance checked",
      );
      await tab.locator("#summary-details").click();
      await tab.locator("#balance-website summary").click();
      await tab.locator("#balance-present").click();
      await expect(tab.locator("#balance-status")).toContainText(
        "visible under Account",
      );
      await tab.locator("#balance-close").click();
      await tab.locator("#account-toggle").click();
      await expect(tab.locator("#shared-amount")).toHaveText("0 P2PARTY");
      await tab.locator("#forget-total").click();
      await expect(tab.locator("#shared-total")).toBeHidden();
      await tab.locator("#lock").click();
      await expect(tab.locator("#dashboard")).toBeHidden();
      await tab.goto(url + "#watch=0x" + "1".repeat(40));
      await expect(tab).toHaveURL(
        origin + "/wallet/help/#watch=0x" + "1".repeat(40),
      );
      await restored.close();
      const offlineContext = await browser.newContext({ offline: true });
      const offline = await offlineContext.newPage();
      const network = [];
      offline.on("request", (request) => {
        if (/^https?:/.test(request.url())) network.push(request.method());
      });
      await offline.goto(
        new URL("wallet/restore-wallet.html", publicRoot).href + "#restore",
      );
      await offline.locator("#archive").setInputFiles(kit.file);
      await offline.locator("#code").fill(kit.code);
      await offline.locator("#open").click();
      await expect(offline.locator("#dashboard")).toBeVisible();
      await expect(offline.locator("#receive-text")).toHaveValue(kit.request);
      await expect(offline.locator("#summary-check")).toHaveText(
        "Import a balance snapshot",
      );
      await expect(offline.locator("#summary-amount")).toHaveText("0 P2PARTY");
      assert.deepEqual(network, []);
      await offlineContext.close();
      assert.ok(
        urls.every(
          (u) =>
            u.startsWith(origin + "/") ||
            u.startsWith("blob:") ||
            u.startsWith("data:"),
        ),
      );
      assert.ok(requests.every((r) => r.method === "GET"));
      console.log(
        name +
          " passed in-place creation, file/paste restore, original receive request, public sync, explicit balance sharing, offline file restore and legacy watch link.",
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
