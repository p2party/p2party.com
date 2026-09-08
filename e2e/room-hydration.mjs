// A saved custom signaling/STUN configuration must survive hydration and reload
// without React discarding the prerendered room tree. No signaling is started.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const app = process.env.APP_URL ?? "http://127.0.0.1:5840";
const signaling = "ws://127.0.0.1:65430/ws";
const stun = "stun:127.0.0.1:65431";
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ signaling, stun }) => {
      if (location.protocol !== "http:" && location.protocol !== "https:")
        return;
      localStorage.setItem("signalingServerUrl", JSON.stringify(signaling));
      localStorage.setItem("stunServerUrls", JSON.stringify([stun]));
    },
    { signaling, stun },
  );
  const page = await context.newPage();
  const errors = [];
  const signalingAttempts = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => signalingAttempts.push(socket.url()));
  for (const route of [
    "/r#v1." + "q6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6s",
    "/rooms",
  ]) {
    await page.goto(app + route, { waitUntil: "networkidle" });
    await page.getByText(signaling, { exact: true }).first().waitFor();
    await page.getByText(stun, { exact: true }).first().waitFor();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText(signaling, { exact: true }).first().waitFor();
    await page.getByText(stun, { exact: true }).first().waitFor();
  }
  assert.deepEqual(
    signalingAttempts,
    [],
    "hydration must not silently join a signaling server",
  );
  assert.deepEqual(
    errors,
    [],
    "room hydration must not discard the server markup",
  );
  console.log(
    "PASS custom signaling/STUN preferences hydrate and reload on /r and /rooms without errors or a signaling connection",
  );
} finally {
  await browser.close();
}
