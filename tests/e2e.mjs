// e2e.mjs — headless Playwright smoke test of the ASSEMBLED app.
//
// Boots index.html with a fake camera, then drives each game through the real
// shell (main.js → engine → game), injecting synthetic dancers so game logic
// actually runs. Asserts: app boots, each game becomes active, a heart-pop
// scores, and NO uncaught JS errors occur anywhere.
//
// Requires the static server running on 127.0.0.1:8777 (see run note at bottom).

import { chromium } from "playwright";

const BASE = process.env.TEST_URL || "http://127.0.0.1:8777/";
const pageErrors = [];
const consoleErrors = [];
let failures = 0;

function check(name, cond) {
  if (cond) { console.log(`  ✔ ${name}`); }
  else { console.log(`  ✖ ${name}`); failures++; }
}

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const ctx = await browser.newContext({ permissions: ["camera"], viewport: { width: 1000, height: 800 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

console.log("→ loading app", BASE);
await page.goto(BASE, { waitUntil: "load", timeout: 30000 });

// Title screen should show the personalized name.
const startVisible = await page.locator(".start-btn").isVisible();
check("start screen renders", startVisible);
const titleText = await page.locator(".title").first().textContent();
check("title is personalized for Melina", /Melina/.test(titleText || ""));

// Click Start → boot engine (fake camera + model). Wait for the menu to appear.
await page.click(".start-btn");
console.log("→ booting engine (model load)…");
await page.waitForSelector(".tile-grid", { timeout: 30000 }).catch(() => {});
const menuVisible = await page.locator(".tile-grid").isVisible().catch(() => false);
check("menu appears after boot", menuVisible);

const backend = await page.evaluate(() => window.__app?.engine?.backend);
console.log("  (TFJS backend in this env:", backend, ")");

// Helper: inject synthetic dancers into the engine.
async function inject(dancers) {
  await page.evaluate((d) => window.__app.engine.__setSyntheticDancers(d), dancers);
}
function dancer(id, overrides = {}) {
  const names = ["nose","leftEye","rightEye","leftEar","rightEar","leftShoulder",
    "rightShoulder","leftElbow","rightElbow","leftWrist","rightWrist","leftHip",
    "rightHip","leftKnee","rightKnee","leftAnkle","rightAnkle"];
  const kp = {};
  for (const n of names) kp[n] = { x: 100, y: 100, score: 1 };
  Object.assign(kp, overrides);
  return { id, color: "#ff3ec8", colorIndex: 0, keypoints: kp, box: null };
}

// --- Drive each game ---
const games = ["freeze-dance", "photo-booth", "copy-pose", "pop-hearts"];
for (const id of games) {
  console.log(`→ entering game: ${id}`);
  await inject([dancer(0), dancer(1)]);
  await page.evaluate((gid) => window.__app.startGame(gid), id);
  await page.waitForTimeout(1500); // let several frames run
  const active = await page.evaluate(() => window.__app.engine.activeGame?.id);
  check(`${id} is the active game`, active === id);
  // back to menu between games
  await page.evaluate(() => window.__app.goToMenu());
  await page.waitForTimeout(300);
}

// --- Specifically verify Pop-the-Hearts scoring with a wrist on a heart ---
console.log("→ verifying heart-pop scoring");
await page.evaluate(() => window.__app.startGame("pop-hearts"));
await page.waitForTimeout(200);
// Force a known heart, then place a wrist exactly on it across a frame.
const scored = await page.evaluate(async () => {
  const g = window.__app.engine.activeGame;
  g.hearts = [{ x: 500, y: 400, vx: 0, vy: 0, r: 46, emoji: "💖" }];
  const before = g.score;
  // inject a dancer whose wrist is on the heart
  const names = ["nose","leftEye","rightEye","leftEar","rightEar","leftShoulder",
    "rightShoulder","leftElbow","rightElbow","leftWrist","rightWrist","leftHip",
    "rightHip","leftKnee","rightKnee","leftAnkle","rightAnkle"];
  const kp = {}; for (const n of names) kp[n] = { x: 0, y: 0, score: 1 };
  kp.leftWrist = { x: 500, y: 400, score: 1 };
  window.__app.engine.__setSyntheticDancers([{ id: 0, color: "#ff3ec8", keypoints: kp, box: null }]);
  // wait ~3 frames
  await new Promise((r) => setTimeout(r, 200));
  return { before, after: g.score };
});
check("heart pop increments the score", scored.after > scored.before);
await page.evaluate(() => window.__app.goToMenu());

// --- Verify a crashing game drops back to menu (resilience) ---
console.log("→ verifying a game crash is contained");
const recovered = await page.evaluate(async () => {
  // Install a fake game that throws in update, then ensure engine clears it.
  const bad = { id: "boom", title: "Boom", emoji: "💥",
    start() {}, update() { throw new Error("intentional"); }, stop() {} };
  window.__app.engine.setGame(bad);
  await new Promise((r) => setTimeout(r, 200));
  return window.__app.engine.activeGame === null;
});
check("crashing game is cleared (app survives)", recovered);

await page.screenshot({ path: "tests/e2e-screenshot.png" });

// --- Final error assertions ---
check("no uncaught page errors", pageErrors.length === 0);
if (pageErrors.length) console.log("    pageErrors:", pageErrors);
// console errors from CDN (e.g. font) are non-fatal; report but don't fail on them
if (consoleErrors.length) console.log("    (console errors, informational):", consoleErrors.slice(0, 5));

await browser.close();

console.log(`\n${failures === 0 ? "✅ ALL E2E CHECKS PASSED" : "❌ " + failures + " E2E CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
