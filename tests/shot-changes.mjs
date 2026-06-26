// Capture visual proof: (1) Princess filter on two dancers, (2) Copy-Pose
// preview no longer clipped (T-Pose, a wide pose).
import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8777/";

function dancer(id, overrides = {}, cx = 480) {
  const names = ["nose","leftEye","rightEye","leftEar","rightEar","leftShoulder",
    "rightShoulder","leftElbow","rightElbow","leftWrist","rightWrist","leftHip",
    "rightHip","leftKnee","rightKnee","leftAnkle","rightAnkle"];
  // a reasonable standing pose so the gown/crown have anchors
  const base = {
    nose: { x: cx, y: 160 },
    leftShoulder: { x: cx - 70, y: 250 }, rightShoulder: { x: cx + 70, y: 250 },
    leftElbow: { x: cx - 95, y: 340 }, rightElbow: { x: cx + 95, y: 340 },
    leftWrist: { x: cx - 100, y: 430 }, rightWrist: { x: cx + 100, y: 430 },
    leftHip: { x: cx - 45, y: 460 }, rightHip: { x: cx + 45, y: 460 },
    leftKnee: { x: cx - 50, y: 600 }, rightKnee: { x: cx + 50, y: 600 },
    leftAnkle: { x: cx - 52, y: 710 }, rightAnkle: { x: cx + 52, y: 710 },
  };
  const kp = {};
  for (const n of names) kp[n] = { x: 0, y: 0, score: 1 };
  Object.assign(kp, base, overrides);
  return { id, color: id === 0 ? "#ff3ec8" : "#3ee0ff", colorIndex: id, keypoints: kp, box: null };
}

const browser = await chromium.launch({
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
    "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({ permissions: ["camera"], viewport: { width: 960, height: 720 } });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "load", timeout: 30000 });
await page.click(".start-btn");
await page.waitForSelector(".tile-grid", { timeout: 30000 });

// (1) Princess filter, two dancers
await page.evaluate((d) => window.__app.engine.__setSyntheticDancers(d),
  [dancer(0, {}, 330), dancer(1, {}, 640)]);
await page.evaluate(() => window.__app.startGame("princess"));
await page.waitForTimeout(1200);
await page.screenshot({ path: "tests/shot-princess.png" });
console.log("saved tests/shot-princess.png");

// (2) Copy-Pose with a WIDE pose to prove the preview fits.
await page.evaluate(() => window.__app.goToMenu());
await page.evaluate((d) => window.__app.engine.__setSyntheticDancers(d), [dancer(0, {}, 480)]);
await page.evaluate(() => window.__app.startGame("copy-pose"));
// force the T-Pose (index 1) which is the widest, to test clipping
await page.evaluate(() => { const g = window.__app.engine.activeGame; if (g) g.index = 1; });
await page.waitForTimeout(1200);
await page.screenshot({ path: "tests/shot-copypose.png" });
console.log("saved tests/shot-copypose.png");

await browser.close();
