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
const receiveUrl = signer + "/p2party-server/restore/#receive";
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
  const visitor = await context.newPage();
  for (const route of ["/", "/wallet/"]) {
    await visitor.goto(web + route, { waitUntil: "networkidle" });
    const account = visitor.getByRole("button", {
      name: "Account",
      exact: true,
    });
    assert.equal(
      await visitor.getByRole("link", { name: "Rooms", exact: true }).count(),
      1,
    );
    const box = await account.boundingBox();
    assert(box && box.y >= 0 && box.y + box.height < 150);
    assert.equal(
      await visitor.getByText(/Balance hidden|0 P2PARTY/).count(),
      0,
    );
    await account.focus();
    await visitor.keyboard.press("Enter");
    const panel = visitor.getByLabel("Account options");
    const action = panel.getByRole("link", {
      name: "Receive P2PARTY",
      exact: true,
    });
    assert.equal(await action.getAttribute("href"), receiveUrl);
    assert.equal(await action.getAttribute("referrerpolicy"), "no-referrer");
    await action.focus();
    await visitor.keyboard.press("Escape");
    assert(await account.evaluate((el) => el === document.activeElement));
    await account.click();
    await action.click();
    await visitor.waitForURL(receiveUrl);
  }
  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [1360, 900],
  ]) {
    await visitor.setViewportSize({ width, height });
    await visitor.goto(web + "/wallet/", { waitUntil: "networkidle" });
    for (const [label, intent] of [
      ["Create a wallet", "create"],
      ["Restore a wallet", "restore"],
    ]) {
      const link = visitor.getByRole("link", { name: label, exact: true });
      assert.equal(
        await link.getAttribute("href"),
        signer + "/p2party-server/restore/#" + intent,
      );
      const box = await link.boundingBox();
      assert(
        box && box.y + box.height <= height,
        "Wallet choice is outside the first screen at " + width + "px",
      );
    }
    assert(
      await visitor.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await visitor.getByRole("button", { name: "Account", exact: true }).click();
  await visitor.getByRole("link", { name: "Restore chat identity" }).click();
  await visitor
    .getByRole("heading", { name: "Restore identity", exact: true })
    .waitFor();
  await visitor.keyboard.press("Escape");
  await visitor.waitForURL(web + "/rooms/");
  await visitor.close();
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
    0,
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
    await page.getByRole("button", { name: "Show in Account" }).count(),
    0,
  );
  await signerPage.evaluate(() => window.sendOffer({}));
  await page.getByRole("button", { name: "Show in Account" }).waitFor();
  assert.equal(
    await page.evaluate((k) => sessionStorage.getItem(k), storage),
    null,
  );
  await signerPage.evaluate(() => window.sendOffer({ amount: "128" }));
  await page.getByRole("button", { name: "Show in Account" }).click();
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
  await nav.getByRole("button", { name: "Account", exact: true }).click();
  await page
    .getByLabel("Account options")
    .getByText("2 P2PARTY", { exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await nav.getByRole("link", { name: "Roadmap", exact: true }).click();
  await page.reload();
  await nav.getByRole("button", { name: "Account", exact: true }).click();
  await page
    .getByText("At ledger height 3 · This tab only", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Hide and forget balance" }).click();
  await nav.getByRole("button", { name: "Account", exact: true }).click();
  assert.equal(await page.getByText("2 P2PARTY", { exact: true }).count(), 0);
  await page.keyboard.press("Escape");
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
  await edge.getByRole("button", { name: "Show in Account" }).click();
  await edge.getByRole("button", { name: "Account", exact: true }).click();
  await edge.getByText("0 P2PARTY", { exact: true }).waitFor();
  assert(
    await edge.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await edge.setViewportSize({ width: 320, height: 640 });
  await edge
    .getByText("At ledger height 18446744073709551615 · This tab only", {
      exact: true,
    })
    .waitFor();
  // Floating UI repositions an already-open panel on the first animation frame after the viewport changes.
  await edge.waitForFunction(
    () =>
      document.documentElement.scrollWidth <= innerWidth &&
      document.querySelector(".account-panel")?.getBoundingClientRect().right <=
        innerWidth,
  );
  const menu = await edge.getByLabel("Account options").boundingBox();
  assert(menu && menu.x >= 0 && menu.x + menu.width <= 320);
  const late = await start();
  await late.clock.install();
  await signerPage.evaluate(() => window.sendOffer({}));
  await late.getByRole("button", { name: "Show in Account" }).waitFor();
  // Simulate waking a suspended browser after the original wall-clock deadline.
  await late.clock.setSystemTime(new Date(Date.now() + 120_000));
  await late.getByRole("button", { name: "Show in Account" }).click();
  await late.getByText(/This request expired/).waitFor();
  assert.equal(
    await late.evaluate((k) => sessionStorage.getItem(k), storage),
    null,
  );
  // Room surfaces use separate responsive chrome. Opening the guide must
  // preserve the room tab and its connection; all requests stay intercepted.
  await edge.goto(web + "/rooms/");
  const accountInRoom = edge
    .getByRole("button", { name: "Account", exact: true })
    .first();
  await accountInRoom.click();
  const roomLink = edge.getByRole("link", { name: "Open wallet in a new tab" });
  const guidePopup = edge.waitForEvent("popup");
  await roomLink.click();
  const guide = await guidePopup;
  await guide
    .getByRole("heading", { name: "P2PARTY wallet", exact: true })
    .waitFor();
  assert.equal(new URL(edge.url()).pathname, "/rooms/");
  assert.equal(await guide.evaluate(() => window.opener), null);
  await edge.setViewportSize({ width: 1280, height: 800 });
  await accountInRoom.click();
  await edge.getByText("0 P2PARTY", { exact: true }).waitFor();
  await edge
    .getByText("At ledger height 18446744073709551615 · This tab only", {
      exact: true,
    })
    .waitFor();
  await edge.keyboard.press("Escape");
  const roomPath = "/r/#v1." + randomBytes(32).toString("base64url");
  await edge.setViewportSize({ width: 375, height: 667 });
  await edge.goto(web + roomPath);
  await edge.getByRole("button", { name: "Cancel", exact: true }).click();
  await edge.getByRole("button", { name: "Open navigation" }).click();
  const drawer = edge.getByRole("dialog");
  await drawer.getByRole("button", { name: "Account", exact: true }).click();
  const receiveFromRoom = edge.getByLabel("Account options").getByRole("link", {
    name: "Receive P2PARTY in a new tab",
  });
  assert.equal(await receiveFromRoom.getAttribute("href"), receiveUrl);
  assert.equal(
    await receiveFromRoom.getAttribute("rel"),
    "noopener noreferrer",
  );
  const roomGuide = edge.waitForEvent("popup");
  await edge
    .getByLabel("Account options")
    .getByRole("link", { name: "Open wallet in a new tab" })
    .click();
  await (
    await roomGuide
  )
    .getByRole("heading", { name: "P2PARTY wallet", exact: true })
    .waitFor();
  assert.equal(edge.url(), web + roomPath);
  await drawer.getByRole("button", { name: "Account", exact: true }).click();
  await edge.getByRole("button", { name: "Hide and forget balance" }).click();
  assert.equal(
    await edge.evaluate((k) => sessionStorage.getItem(k), storage),
    null,
  );
  const other = await context.newPage();
  await other.goto(href);
  await other.getByText(/did not receive a connection/).waitFor();
  await other.getByRole("button", { name: "Account", exact: true }).click();
  assert.equal(await other.getByText("0 P2PARTY", { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  console.log(
    "PASS cross-origin popup, nonce and window binding, invalid offers, consent, decimal bounds, explicit zero, tab isolation, navigation, reload, forget and no-opener handling. No RPC requests.",
  );
} finally {
  await browser.close();
}
