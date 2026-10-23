import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "./config.mjs";
import { content } from "./content.mjs";
import { renderShowcase } from "./showcase.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.join(root, "_site");
const favicon = await fs.readFile(path.join(root, "website/favicon.svg"));
const faviconName = `favicon-${createHash("sha256").update(favicon).digest("hex").slice(0, 12)}.svg`;
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const link = (href, text, cls = "") => `<a class="${cls}" href="${escape(href)}">${text}</a>`;
const mark =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#4f46e5"/><path d="M8 24 16 7l8 17M11 18h10" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const arrow = '<span aria-hidden="true">↗</span>';

function render(c) {
  const base = "./";
  const canonical = config.url;
  const demo = JSON.stringify({
    titles: c.taskTitles,
    labels: c.labels,
    projects: c.project,
    count: c.count,
    empty: c.empty,
    copied: c.copied,
    copyFail: c.copyFail,
  }).replace(/</g, "\\u003c");
  const groups = c.features
    .map(
      ([title, body], i) =>
        `<details><summary><span class="detail-no">0${i + 1}</span>${escape(title)}<span class="plus" aria-hidden="true">+</span></summary><p>${escape(body)}</p></details>`,
    )
    .join("");
  const providers = [
    "Claude Code",
    "Codex CLI",
    "Cursor CLI",
    "Antigravity CLI",
    "GitHub Copilot CLI",
    "OpenCode",
  ];
  const rows = providers
    .map(
      (name, i) =>
        `<tr><th scope="row">${name}</th><td>${i < 2 ? c.native : c.seeded}</td><td>${[0, 1, 5].includes(i) ? c.native : c.unsupported}</td><td>${[0, 1, 5].includes(i) ? c.native : c.nextTurn}</td><td>${i < 2 ? c.native : c.unsupported}</td></tr>`,
    )
    .join("");
  return `<!doctype html>
<html lang="${c.lang}" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#07101f"><title>${escape(c.title)}</title><meta name="description" content="${escape(c.description)}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(c.title)}"><meta property="og:description" content="${escape(c.description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${config.url}assets/console.jpg"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="${base}${faviconName}" type="image/svg+xml" sizes="any"><link rel="stylesheet" href="${base}styles.css"><link rel="stylesheet" href="${base}product-theme.css"><script src="${base}site.js" defer></script></head>
<body><a class="skip" href="#main">Skip to content</a>
<header class="header wrap"><a class="brand" href="${base}" aria-label="Attend home">${mark}<span>Attend</span></a><nav aria-label="Main navigation">${c.nav.map((n, i) => link(["#organize", "#analysis", "#metrics", "#install"][i], escape(n))).join("")}</nav><div class="nav-end"><button id="website-theme" type="button" aria-label="Switch website to light theme" title="Switch theme">☼</button>${link(config.repository, "GitHub " + arrow, "nav-github")}</div></header>
<main id="main">
<section class="hero wrap"><div class="hero-copy"><p class="eyebrow"><span class="live-dot"></span>LOCAL COMMAND CENTER FOR AI CODING</p><h1>Many sessions.<br><span class="accent-text">One place</span> to<br>understand the work.</h1><p class="intro">${c.intro}</p><div class="actions">${link("#organize", "Explore actual console ↓", "button primary")}${link("#install", c.start + " ↗", "button secondary")}</div><p class="meta">${c.meta}</p></div><a class="hero-product" href="#organize"><span class="hero-product-bar"><span class="live-dot"></span>ATTEND / ACTUAL CONSOLE <span>↗</span></span><img src="${base}assets/console.jpg" width="1280" height="800" alt="${c.screenAlt}"><span class="hero-product-caption">${c.heroNote}</span></a></section>
<div class="providers wrap"><p class="eyebrow">${c.tools}</p><div>${providers.map((p, i) => `<span><b aria-hidden="true">${["✳", "◈", "↗", "△", "⌘", "◇"][i]}</b>${p}</span>`).join("")}</div></div>
${renderShowcase(c, base)}
<section class="section workflow-section wrap" id="workflows"><div class="section-head"><p class="eyebrow">${c.workflowEyebrow}</p><h2>${c.workflowTitle}</h2></div><div class="workflow-layout"><div class="workflow-tabs" role="tablist" aria-label="Daily workflows" aria-orientation="vertical">${c.workflows.map((w, i) => `<button id="workflow-tab-${i}" role="tab" aria-selected="${i === 0}" aria-controls="workflow-panel-${i}" tabindex="${i === 0 ? 0 : -1}" data-workflow="${i}"><span class="mono">0${i + 1}</span>${w[0]}<span aria-hidden="true">↗</span></button>`).join("")}</div><div class="workflow-panels">${c.workflows.map((w, i) => `<div id="workflow-panel-${i}" role="tabpanel" aria-labelledby="workflow-tab-${i}" tabindex="0" ${i ? "hidden" : ""}><span class="workflow-number" aria-hidden="true">0${i + 1}</span><h3>${w[1]}</h3><p>${w[2]}</p><div class="workflow-path">${w[3].map((s, k) => `<span>${s}</span>${k < 3 ? '<i aria-hidden="true">→</i>' : ""}`).join("")}</div></div>`).join("")}</div></div></section>
<section class="section reference-section wrap"><div class="reference-heading"><h2>${c.referenceTitle}</h2><p>${c.referenceBody}</p></div><div class="reference-list">${groups}</div></section>
<section class="section compatibility-section wrap" id="compatibility"><div class="section-head"><p class="eyebrow">${c.compatibilityEyebrow}</p><h2>${c.compatibilityTitle}</h2><p>${c.compatibilityBody}</p></div><div class="table-scroll" tabindex="0" role="region" aria-label="Provider compatibility"><table><thead><tr>${c.columns.map((x) => `<th scope="col">${x}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div><p class="fine-print">${c.compatibilityNote}</p><div class="local-note"><span aria-hidden="true">⌂</span><div><h3>${c.localTitle}</h3>${c.localParagraphs.map((p) => `<p>${p}</p>`).join("")}</div></div></section>
<section class="install-section" id="install"><div class="wrap install-layout"><div><p class="eyebrow">${c.installEyebrow}</p><h2>${c.installTitle}</h2><p>${c.installBody}</p><div class="install-links">${link(config.repository + "#quick-start", c.docs + " " + arrow)}${link(config.repository + "/blob/main/CHANGELOG.md", c.changelog + " " + arrow)}</div></div><div class="install-card"><div class="command-head"><span>${c.scoped}</span><button class="copy-button" data-copy="npx --package=@sinphife/attend attend &quot;$PWD&quot;">${c.copy}</button></div><pre><code>npx --package=@sinphife/attend attend "$PWD"</code></pre><div class="command-head"><span>${c.global}</span><button class="copy-button" data-copy="npm install --global @sinphife/attend&#10;attend">${c.copy}</button></div><pre><code>npm install --global @sinphife/attend<br>attend</code></pre><p class="terminal-result"><span aria-hidden="true">↳</span> http://localhost:5050</p><p id="copy-status" role="status" aria-live="polite"></p></div></div><ul class="wrap install-notes">${c.installNotes.map((n) => `<li>${n}</li>`).join("")}</ul></section>
<section class="section faq-section wrap"><h2>Before you begin</h2><div>${c.faq.map(([q, a]) => `<details><summary>${q}<span class="plus" aria-hidden="true">+</span></summary><p>${a}</p></details>`).join("")}</div></section>
<section class="closing wrap"><p class="eyebrow">ATTEND / LOCAL-FIRST / OPEN SOURCE</p><h2>${c.closing}</h2><p>${c.closingBody}</p><div class="actions">${link("#install", c.start + " ↓", "button primary")}${config.kofi ? link(config.kofi, c.support + " " + arrow, "button secondary") : link(config.repository, c.github + " " + arrow, "button secondary")}</div></section>
</main><footer class="footer wrap"><a class="brand" href="${base}">${mark}<span>Attend</span></a><div><p>${c.footer}</p><p>${c.privacy}</p></div><div>${link(config.repository, "GitHub ↗")}${link(config.repository + "/blob/main/LICENSE", "MIT ↗")}</div></footer>
<script type="application/json" id="demo-data">${demo}</script></body></html>`;
}

await fs.mkdir(path.join(out, "zh"), { recursive: true });
await fs.mkdir(path.join(out, "assets"), { recursive: true });
execFileSync(process.execPath, ["--import", "tsx", "website/demo.ts"], {
  cwd: root,
  stdio: "inherit",
});
await fs.writeFile(path.join(out, faviconName), favicon);
await fs.writeFile(path.join(out, "index.html"), render(content.en));
// Preserve existing bookmarks while keeping one English canonical site.
await fs.writeFile(
  path.join(out, "zh/index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Attend</title><link rel="icon" href="../${faviconName}" type="image/svg+xml" sizes="any"><meta http-equiv="refresh" content="0; url=../"><link rel="canonical" href="${config.url}"><meta name="robots" content="noindex"></head><body><p><a href="../">Continue to Attend</a></p></body></html>`,
);
for (const file of ["styles.css", "site.js", "favicon.svg"])
  await fs.copyFile(path.join(root, "website", file), path.join(out, file));
await fs.copyFile(
  path.join(root, "docs/assets/attend-console-demo.jpg"),
  path.join(out, "assets/console.jpg"),
);
for (const file of await fs.readdir(path.join(root, "docs/assets"))) {
  if (file.startsWith("attend-") && file.endsWith(".jpg"))
    await fs.copyFile(path.join(root, "docs/assets", file), path.join(out, "assets", file));
}
await fs.writeFile(path.join(out, ".nojekyll"), "");
await fs.writeFile(
  path.join(out, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${config.url}sitemap.xml\n`,
);
await fs.writeFile(
  path.join(out, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${config.url}</loc></url></urlset>`,
);
console.log(`Built English GitHub Pages site: ${out}`);
