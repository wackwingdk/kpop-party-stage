// Diagnostic runner: loads diag.html under the SAME launch flags as the smoke
// test and prints which TFJS backends actually initialize in this environment.
import { chromium } from "playwright";

const URL = (process.env.TEST_URL || "http://127.0.0.1:8777/") + "diag.html";

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text()); });
page.on("pageerror", (e) => console.log("[pageerror]", String(e)));

await page.goto(URL, { waitUntil: "load", timeout: 30000 });
await page.waitForFunction(() => window.__diag && window.__diag.done, { timeout: 30000 }).catch(() => {});

const diag = await page.evaluate(() => window.__diag);
const text = await page.textContent("#out");
console.log("----- on-page log -----");
console.log(text);
console.log("----- parsed diag -----");
console.log(JSON.stringify(diag, null, 2));

await browser.close();
