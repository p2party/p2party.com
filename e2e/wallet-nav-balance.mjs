// Both HTTPS origins are fulfilled directly by Playwright. This fixture never
// contacts either public site or loads wallet keys. The production receiver and
// browser popup, WindowProxy and origin checks run unmodified against dist.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { chromium } from "playwright";
const web = "https://p2party.com";
const signer = "https://p2party.github.io";
const href = web + "/wallet/#show-balance";
const storage = "p2party.testnet1.shared-balance.v1";
const root = resolve("dist");
const browser = await chromium.launch();
const mime = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".json": "application/json",
};
const sender = `<button id="open">Share</button><script>
  let viewer,challenge;const replies=[];
  document.querySelector("#open").onclick=()=>{viewer=window.open(${JSON.stringify(href)},'_blank');};
  onmessage=e=>{
    if(e.origin!==${JSON.stringify(web)}||e.source!==viewer) return;
    if(e.data.type==='p2party.balance.request.v1') challenge=e.data.nonce;
    else if(e.data.nonce===challenge) replies.push(e.data.type);
  };
  window.sendOffer=extra=>viewer.postMessage({type:'p2party.balance.offer.v1',nonce:challenge,amount:'2',height:'3',...extra},${JSON.stringify(web)});
  window.getChallenge=()=>challenge;window.getReplies=()=>replies;
</script>`;
try {
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    serviceWorkers: "block",
  });
  const unexpected = [],
    errors = [];
  context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.origin === signer && u.pathname === "/p2party-server/restore/")
      return route.fulfill({ contentType: "text/html", body: sender });
    if (u.origin !== web || route.request().method() !== "GET") {
      unexpected.push(u.origin + u.pathname);
      return route.abort();
    }
    let p = u.pathname;
    if (!extname(p)) p = p.replace(/\/?$/, "/index.html");
    const file = resolve(root, "." + p);
    assert(file.startsWith(root + sep));
    try {
      return await route.fulfill({
        contentType: mime[extname(file)] ?? "application/octet-stream",
        body: await readFile(file),
      });
    } catch {
      return route.fulfill({ status: 404 });
    }
  });
  await context.routeWebSocket("**/*", (socket) => socket.close());
  const signerPage = await context.newPage();
  await signerPage.goto(signer + "/p2party-server/restore/");
  const start = async () => {
    await signerPage.evaluate(() => {
      window.oldChallenge = window.getChallenge();
    });
    const popup = signerPage.waitForEvent("popup");
    await signerPage
      .getByRole("button", { name: "Share", exact: true })
      .click();
    const page = await popup;
    await signerPage.waitForFunction(
      () =>
        /^[0-9a-f]{64}$/.test(getChallenge()) &&
        getChallenge() !== window.oldChallenge,
    );
    await page
      .getByText("Waiting for the wallet that opened this tab…")
      .waitFor();
    return page;
  };
  const page = await start();
  const challenge = await signerPage.evaluate(() => getChallenge());
  assert.equal(
    await page.getByText("Balance hidden", { exact: true }).count(),
    1,
  );
  const invalid = [
    { nonce: "f".repeat(63) },
    { nonce: "0".repeat(64) },
    { amount: "129" },
    { amount: "01" },
    { amount: -1 },
    { height: "-1" },
    { height: "18446744073709551616" },
    { height: 3 },
    { handle: "extra" },
  ];
  for (const offer of invalid)
    await signerPage.evaluate((data) => window.sendOffer(data), offer);
  // Origin and source are checked independently of a valid body and nonce.
  await page.evaluate(
    ({ challenge, signer }) => {
      const data = {
        type: "p2party.balance.offer.v1",
        nonce: challenge,
        amount: "2",
        height: "3",
      };
      for (const [origin, source] of [
        ["https://example.invalid", window.opener],
        [signer, window],
      ])
        window.dispatchEvent(
          new MessageEvent("message", { origin, source, data }),
        );
    },
    { challenge, signer },
  );
  assert.equal(
    await page.getByRole("button", { name: "Show in navbar" }).count(),
    0,
  );
  await signerPage.evaluate(() => window.sendOffer({}));
  await page.getByRole("button", { name: "Show in navbar" }).waitFor();
  assert.equal(
    await page.evaluate((k) => sessionStorage.getItem(k), storage),
    null,
  );
  await signerPage.evaluate(() => window.sendOffer({ amount: "128" }));
  await page.getByRole("button", { name: "Show in navbar" }).click();
  await signerPage.waitForFunction(() =>
    getReplies().includes("p2party.balance.accepted.v1"),
  );
  await page.waitForURL(web + "/wallet/");
  assert.equal(await page.evaluate(() => window.opener), null);
  const expected = { amount: "2", height: "3" };
  assert.deepEqual(
    await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)), storage),
    expected,
  );
  assert(!page.url().includes("amount") && !page.url().includes("height"));
  const nav = page.getByRole("navigation", { name: "Site navigation" });
  await nav.getByText("2 P2PARTY", { exact: true }).waitFor();
  await nav.getByRole("link", { name: "Roadmap", exact: true }).click();
  await page.reload();
  await nav.getByText("At height 3", { exact: true }).waitFor();
  await nav.getByLabel("Balance details").click();
  await nav.getByRole("button", { name: "Hide and forget balance" }).click();
  await nav.getByText("Balance hidden", { exact: true }).waitFor();
  assert.equal(
    await page.evaluate((k) => sessionStorage.getItem(k), storage),
    null,
  );

  const decline = await start();
  await signerPage.evaluate(() =>
    window.sendOffer({ amount: "0", height: "0" }),
  );
  await decline.getByRole("button", { name: "Cancel", exact: true }).click();
  await signerPage.waitForFunction(() =>
    getReplies().includes("p2party.balance.declined.v1"),
  );
  assert.equal(
    await decline.evaluate((k) => sessionStorage.getItem(k), storage),
    null,
  );

  const edge = await start();
  await signerPage.evaluate(() =>
    window.sendOffer({ amount: "0", height: "18446744073709551615" }),
  );
  await edge.getByRole("button", { name: "Show in navbar" }).click();
  await edge.getByText("0 P2PARTY", { exact: true }).waitFor();
  assert(
    await edge.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await edge.setViewportSize({ width: 320, height: 640 });
  await edge.getByLabel("Balance details").click();
  assert(
    await edge.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const menu = await edge.locator(".site-balance-menu").boundingBox();
  assert(menu && menu.x >= 0 && menu.x + menu.width <= 320);
  const late = await start();
  await late.clock.install();
  await signerPage.evaluate(() => window.sendOffer({}));
  await late.getByRole("button", { name: "Show in navbar" }).waitFor();
  // Simulate waking a suspended browser after the original wall-clock deadline.
  await late.clock.setSystemTime(new Date(Date.now() + 120_000));
  await late.getByRole("button", { name: "Show in navbar" }).click();
  await late.getByText(/This request expired/).waitFor();
  assert.equal(
    await late.evaluate((k) => sessionStorage.getItem(k), storage),
    null,
  );
  // Room surfaces use separate responsive chrome. Opening the guide must
  // preserve the room tab and its connection; all requests stay intercepted.
  await edge.goto(web + "/rooms/");
  const roomWallet = edge.getByRole("link", {
    name: "Open wallet in a new tab",
  });
  await roomWallet.first().waitFor();
  const linkToGuide = edge.waitForEvent("popup");
  await roomWallet.first().click();
  const guide = await linkToGuide;
  await guide
    .getByRole("heading", { name: "P2PARTY wallet", exact: true })
    .waitFor();
  assert.equal(new URL(edge.url()).pathname, "/rooms/");
  assert.equal(await guide.evaluate(() => window.opener), null);
  await edge.setViewportSize({ width: 1280, height: 800 });
  await edge
    .getByRole("link", { name: "Open wallet in a new tab" })
    .first()
    .waitFor();
  assert.equal(
    await edge
      .locator("a[aria-label='Open wallet in a new tab']:visible small")
      .first()
      .textContent(),
    "0 P2PARTY · height 18446744073709551615",
  );
  const ids = await edge
    .locator("a[aria-label='Open wallet in a new tab']")
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("aria-describedby")),
    );
  assert.equal(new Set(ids).size, ids.length);
  const roomPath = "/r/#v1." + randomBytes(32).toString("base64url");
  await edge.setViewportSize({ width: 375, height: 667 });
  await edge.goto(web + roomPath);
  await edge.getByRole("button", { name: "Cancel", exact: true }).click();
  await edge.getByRole("button", { name: "Open navigation" }).click();
  const drawer = edge.getByRole("dialog");
  const roomGuide = edge.waitForEvent("popup");
  await drawer.getByRole("link", { name: "Open wallet in a new tab" }).click();
  await (
    await roomGuide
  )
    .getByRole("heading", { name: "P2PARTY wallet", exact: true })
    .waitFor();
  assert.equal(edge.url(), web + roomPath);
  await drawer.getByRole("button", { name: "Hide and forget balance" }).click();
  assert.equal(
    await edge.evaluate((k) => sessionStorage.getItem(k), storage),
    null,
  );
  const other = await context.newPage();
  await other.goto(href);
  await other.getByText(/did not receive a connection/).waitFor();
  await other.getByText("Balance hidden", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  console.log(
    "PASS cross-origin popup, nonce and window binding, invalid offers, consent, decimal bounds, explicit zero, tab isolation, navigation, reload, forget and no-opener handling. No RPC requests.",
  );
} finally {
  await browser.close();
}
