// Dev-only visual check: screenshot the feed (and one brief detail) into .shots/.
// Usage: node scripts/shot.mjs [baseUrl] [briefName]
//   node scripts/shot.mjs http://127.0.0.1:5050 attend
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:5050";
const briefName = process.argv[3];
const out = path.resolve(fileURLToPath(new URL("../.shots/", import.meta.url)));
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 950 } });

await page.goto(base, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(out, "feed.png"), fullPage: true });

const sel = briefName ? `a.brief:has(.name:text-is("${briefName}"))` : "a[href^='/brief']";
const href = await page.getAttribute(sel, "href").catch(() => null);
if (href) {
  await page.goto(base + href, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(out, "detail.png"), fullPage: true });
}

await browser.close();
console.log(`shots → ${out}${href ? `  (detail: ${href})` : ""}`);
