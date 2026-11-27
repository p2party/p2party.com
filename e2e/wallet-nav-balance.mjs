// Run against the built website with a loopback HTTP server. Exercise real
// document navigation between the React app and the isolated signing page.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const app = new URL(process.env.APP_URL ?? "http://127.0.0.1:5840");
assert(["127.0.0.1", "localhost", "[::1]"].includes(app.hostname));
const storage = "p2party.testnet1.shared-balance.v1";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 320, height: 640 },
  });
  const unexpected = [];
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.origin === app.origin) return route.continue();
    unexpected.push(u.origin + u.pathname);
    await route.abort();
  });
  const page = await context.newPage();
  const account = page.getByRole("button", { name: "Account", exact: true });
  await page.goto(app.href);
  await account.click();
  assert.equal(await page.getByText(/last shared balance/i).count(), 0);
  await page.getByRole("link", { name: "Open wallet", exact: true }).click();
  await page.waitForURL(new URL("/wallet/", app).href);
  assert.equal(
    await page.locator("#root").count(),
    0,
    "standalone signing document",
  );
  await page.evaluate(() => {
    window.navigationMarker = "same document";
  });
  for (const [task, label] of [
    ["restore", "Restore a wallet"],
    ["create", "Create a wallet"],
  ]) {
    await page
      .getByText(label, { exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await page.waitForURL(new URL("/wallet/#" + task, app).href);
    assert.equal(
      await page.evaluate(() => window.navigationMarker),
      "same document",
    );
    assert.equal(context.pages().length, 1);
    await page.goBack();
  }
  // Validated totals are the only wallet data the room / public navigation reads.
  await page.evaluate(
    (k) =>
      sessionStorage.setItem(k, JSON.stringify({ amount: "0", height: "3" })),
    storage,
  );
  await page.goto(new URL("/wallet/help/", app).href);
  await account.click();
  await page.getByText("0 P2PARTY", { exact: true }).waitFor();
  await page.getByText(/At ledger height 3/).waitFor();
  await page.keyboard.press("Escape");
  assert(await account.evaluate((el) => document.activeElement === el));
  const other = await context.newPage();
  await other.goto(app.href);
  await other.getByRole("button", { name: "Account", exact: true }).click();
  assert.equal(await other.getByText("0 P2PARTY", { exact: true }).count(), 0);
  await other.close();
  await page.goto(new URL("/rooms/", app).href);
  await account.first().click();
  const openWallet = page.getByRole("link", {
    name: "Open wallet in a new tab",
  });
  const opening = page.waitForEvent("popup");
  await openWallet.click();
  const wallet = await opening;
  await wallet.waitForURL(new URL("/wallet/", app).href);
  assert.equal(await wallet.evaluate(() => window.opener === null), true);
  assert.equal(new URL(page.url()).pathname, "/rooms/");
  await wallet.close();
  await account.first().click();
  await page.getByRole("button", { name: "Hide and forget balance" }).click();
  assert.equal(
    await page.evaluate((k) => sessionStorage.getItem(k), storage),
    null,
  );
  assert.deepEqual(unexpected, []);
  console.log(
    "PASS first-party Create and Restore, same-document navigation, per-tab shared zero, forgetting, keyboard focus, and room-safe Open wallet.",
  );
} finally {
  await browser.close();
}
