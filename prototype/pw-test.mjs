// Automated smoke test for the webcam + MoveNet prototype.
// Launches Chromium with a FAKE camera (synthetic video) so the whole
// pipeline (getUserMedia -> TFJS WebGL -> MoveNet -> render loop) runs
// without any human clicking "Allow". Reports FPS, detection count, and errors.

import { chromium } from "playwright";

const URL = process.env.TEST_URL || "http://127.0.0.1:8777/";

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",      // auto-accept camera permission
    "--use-fake-device-for-media-stream",  // feed a synthetic camera stream
    "--enable-unsafe-swiftshader",         // allow software WebGL in headless
    "--ignore-gpu-blocklist",
  ],
});

const context = await browser.newContext({
  permissions: ["camera"],
  viewport: { width: 1000, height: 800 },
});

const page = await context.newPage();

page.on("console", (msg) => {
  const t = `[${msg.type()}] ${msg.text()}`;
  if (msg.type() === "error") consoleErrors.push(t);
});
page.on("pageerror", (err) => pageErrors.push(String(err)));

console.log("→ navigating to", URL);
await page.goto(URL, { waitUntil: "load", timeout: 30000 });

console.log("→ clicking start…");
await page.click("#start");

// Give it time: CDN model download + WebGL warmup + several detection frames
console.log("→ waiting ~14s for model load + warmup…");
await page.waitForTimeout(14000);

const statusText = await page.textContent("#status").catch(() => "(no status)");
const fps = await page.evaluate(() => window.__lastFps ?? null);
const count = await page.evaluate(() => window.__lastDancerCount ?? null);
const hasDetector = await page.evaluate(() => !!window.__lastFps); // loop ran at least 1s

console.log("\n===== RESULT =====");
console.log("status badge :", JSON.stringify(statusText));
console.log("measured FPS :", fps);
console.log("dancers (fake cam):", count);
console.log("render loop ran:", hasDetector);
console.log("console errors:", consoleErrors.length ? consoleErrors : "none");
console.log("page errors   :", pageErrors.length ? pageErrors : "none");
console.log("==================\n");

await page.screenshot({ path: "pw-screenshot.png" });
console.log("→ saved screenshot to prototype/pw-screenshot.png");

await browser.close();

// Exit non-zero if the pipeline clearly failed
if (fps === null || pageErrors.length > 0) {
  console.log("VERDICT: pipeline did NOT come up cleanly.");
  process.exit(1);
} else {
  console.log("VERDICT: pipeline came up — render loop running at", fps, "FPS.");
  process.exit(0);
}
