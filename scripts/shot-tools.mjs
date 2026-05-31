import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:5099";
const out = path.resolve(fileURLToPath(new URL("../.shots/", import.meta.url)));
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
await page.goto(base, { waitUntil: "networkidle" });
await page.click(".item"); // open most-recent session (has tool history)
await page.waitForTimeout(1500);
// expand the first couple of tool blocks
const tools = await page.$$(".toolc > summary");
for (const t of tools.slice(0, 2)) await t.click().catch(() => {});
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, "tools.png") });
await browser.close();
console.log("tool count:", tools.length);
