// Quick visual capture of the title menu (the kids' main screen).
import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8777/";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
    "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({ permissions: ["camera"], viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "load" });
await page.click(".start-btn");
await page.waitForSelector(".tile-grid", { timeout: 30000 });
await page.waitForTimeout(800);
await page.screenshot({ path: "tests/shot-menu.png" });
await browser.close();
console.log("saved tests/shot-menu.png");
