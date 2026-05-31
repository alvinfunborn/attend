// Screenshot the console; optional live chat. Usage:
//   node scripts/shot-console.mjs <baseUrl> [send]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:5099";
const doSend = process.argv[3] === "send";
const out = path.resolve(fileURLToPath(new URL("../.shots/", import.meta.url)));
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 880 } });
await page.goto(base, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(out, "console.png") });

// open the first session → its history loads
await page.click(".item");
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(out, "console-open.png") });

if (doSend) {
  const dir = process.argv[4];
  // start a brand-new session in a temp dir (safe; doesn't touch real sessions)
  await page.click("#newToggle");
  await page.fill("#ndfree", dir);
  await page.fill("#np", "Reply with exactly the word: PONG");
  await page.click("#nbtn");
  // wait until an assistant bubble appears with text
  await page
    .waitForFunction(
      () => {
        const b = document.querySelector(".msg.assistant .bubble");
        return b && b.textContent && b.textContent.length > 0;
      },
      { timeout: 90000 },
    )
    .catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, "console-chat.png") });
}

await browser.close();
console.log("console shots done", doSend ? "(with live send)" : "");
