// Set WALKTHROUGH_ORIGIN to exercise a running preview or the public site.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.WALKTHROUGH_ORIGIN ?? "http://127.0.0.1:4173";
const browser = await chromium.launch();
const cases = [
  ["Encrypted rooms", "Verify and reassemble"],
  ["Testnet ledger", "Replace the input with its output"],
  ["Commitment tree", "Compare the native owner commitment"],
  ["Validator consensus", "Order, execute and certify"],
  ["Offline payments", "Recognize the payment locally"],
];
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({
      viewport: mobile
        ? { width: 360, height: 800 }
        : { width: 1280, height: 900 },
      colorScheme: mobile ? "dark" : "light",
      reducedMotion: mobile ? "reduce" : "no-preference",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (
        m.type() === "error" &&
        /hydrat|content security policy/i.test(m.text())
      )
        errors.push(m.text());
    });
    page.on("request", (r) => {
      if (r.url().includes("/rpc") || r.method() !== "GET")
        errors.push("Unexpected network request from public illustration");
    });
    await page.goto(origin + "/protocol/#walkthrough-commitments");
    const panel = page.locator("#walkthrough");
    await panel
      .getByRole("heading", { name: "Hash the first owner’s two leaves" })
      .waitFor();
    const graph = panel.locator("canvas");
    await graph.waitFor();
    await panel.getByRole("button", { name: "Next step" }).click();
    const bitmap = () => graph.evaluate((canvas) => canvas.toDataURL());
    const first = await bitmap();
    if (mobile) {
      await page.waitForTimeout(180);
      assert.equal(
        await bitmap(),
        first,
        "Reduced motion holds the arrows still",
      );
    } else {
      await page.waitForFunction(
        (initial) =>
          document.querySelector("#walkthrough canvas").toDataURL() !== initial,
        first,
        { timeout: 1700 },
      );
      await panel.getByRole("button", { name: "Play", exact: true }).click();
      await panel
        .getByText("Step 3 of 4", { exact: true })
        .waitFor({ timeout: 10000 });
      await panel.getByRole("button", { name: "Pause", exact: true }).click();
    }
    for (const [label, finalTitle] of cases) {
      await panel.getByRole("link", { name: label, exact: true }).click();
      await panel.getByText("Step 1 of 4", { exact: true }).waitFor();
      assert(
        await panel.getByRole("button", { name: "Previous step" }).isDisabled(),
      );
      for (let step = 1; step <= 3; step++)
        await panel.getByRole("button", { name: "Next step" }).click();
      await panel
        .getByRole("heading", { name: finalTitle, exact: true })
        .waitFor();
      assert(
        await panel.getByRole("button", { name: "Next step" }).isDisabled(),
      );
    }
    await panel.getByRole("button", { name: "Replay", exact: true }).click();
    await panel.getByRole("button", { name: "Pause", exact: true }).click();
    await panel.getByText("Step 1 of 4", { exact: true }).waitFor();
    await panel
      .getByRole("link", { name: "Commitment tree", exact: true })
      .click();
    await panel.getByRole("button", { name: "Next step" }).click();
    await panel.getByRole("button", { name: "Next step" }).click();
    if (process.env.WALKTHROUGH_SCREENSHOTS) {
      await panel.screenshot({
        path:
          process.env.WALKTHROUGH_SCREENSHOTS +
          (mobile ? "-mobile.png" : "-desktop.png"),
      });
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  const noJs = await browser.newPage({ javaScriptEnabled: false });
  await noJs.goto(origin + "/protocol/");
  await noJs
    .getByRole("heading", { name: "Walkthrough transcripts" })
    .waitFor();
  assert.equal(await noJs.locator("#walkthrough noscript li").count(), 20);
  console.log(
    "Five illustrated paths passed at desktop and mobile sizes, including direct links, playback, reduced motion and script-free transcripts.",
  );
} finally {
  await browser.close();
}
