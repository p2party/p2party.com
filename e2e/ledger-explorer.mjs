// Run against the built local preview. The RPC fixture only exposes an empty testnet.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = new URL(process.env.APP_URL ?? "http://127.0.0.1:5840");
assert(["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname));
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 360, height: 780 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  const methods = [];
  let unavailable = false;
  await context.route("https://signaling.p2party.com/rpc", async (route) => {
    if (unavailable) return route.fulfill({ status: 503, body: "Unavailable" });
    const calls = route.request().postDataJSON();
    const result = calls.map(({ id, method }) => {
      methods.push(method);
      assert(
        ["eth_chainId", "demos_getHead", "demos_getTransferByHeight"].includes(
          method,
        ),
      );
      return {
        jsonrpc: "2.0",
        id,
        result:
          method === "eth_chainId"
            ? "0x50325054"
            : method === "demos_getHead"
              ? {
                  chainId:
                    "0x09a0ffa8e6af6aeb11d26671c6c76648965d60509cc3b7a1a4b454b6ec73c760",
                  height: "0x0",
                }
              : null,
      };
    });
    await route.fulfill({ json: result });
  });
  await page.goto(origin.origin + "/explorer");
  await page.getByRole("heading", { name: "Ledger explorer" }).waitFor();
  await page
    .getByRole("navigation", { name: "Explorer networks" })
    .getByRole("link", { name: "Mainnet" })
    .click();
  await page.getByRole("heading", { name: "Network status" }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(methods.length, 0);
  await page.getByRole("link", { name: "Explore Testnet 1" }).click();
  await page
    .getByText("No transfers have been recorded in this range.")
    .waitFor();
  await page.getByLabel("Find a receipt").fill("1");
  await page.getByRole("button", { name: "Look up" }).click();
  await page.getByRole("heading", { name: "Receipt not found" }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("receipt"), "1");
  assert.equal(new URL(page.url()).pathname, "/explorer/testnet/");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(new URL(page.url()).searchParams.get("receipt"), "1");
  await page.goto(origin.origin + "/explorer/testnet/?receipt=0");
  await page.getByRole("heading", { name: "Genesis · height 0" }).waitFor();
  await page.getByRole("link", { name: "All transfers" }).click();
  await page
    .getByText("No transfers have been recorded in this range.")
    .waitFor();
  unavailable = true;
  await page.getByRole("button", { name: "Refresh" }).click();
  await page.getByRole("button", { name: "Try again" }).waitFor();
  unavailable = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await page
    .getByText("No transfers have been recorded in this range.")
    .waitFor();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS explorer navigation, mainnet isolation, genesis, missing receipt, retry and mobile width",
  );
} finally {
  await browser.close();
}
