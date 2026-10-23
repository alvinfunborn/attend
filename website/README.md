# Attend website

Dependency-free English GitHub Pages site at `/attend/`. The former `/attend/zh/` URL redirects to the English homepage.

```sh
node website/build.mjs
node website/check.mjs
node website/preview.mjs
```

Preview uses `http://127.0.0.1:5187/attend/`, including the repository subpath so asset paths match production. Build output is `_site/` (ignored). `.github/workflows/pages.yml` builds, checks links/assets/anchors, and deploys that directory on website changes to `main`. In repository Settings → Pages, choose GitHub Actions as the source.

## Editing

- `content.mjs`: English website copy.
- `build.mjs`: static HTML, metadata, sitemap and asset assembly.
- `styles.css`, `site.js`: presentation and the sample interaction.
- `config.mjs`: production URL, repository link, optional verified Ko-fi URL.
- Product screenshot: existing `docs/assets/attend-console-demo.jpg`; synthetic data only.
- `SCENARIOS.md`: rationale, code evidence and behavior boundaries.

## Ko-fi

The creator does not have a Ko-fi page yet. No broken or guessed donation URL is published. When the account is ready, set `kofi` in `config.mjs` to its real `https://ko-fi.com/...` URL and push. The closing support button appears automatically. No embedded payment script, key, or backend is needed.

## Checks

`check.mjs` verifies the English page and the legacy redirect, unique IDs, local links and anchors, images/styles/scripts, metadata, and absence of unconfigured donation URLs. Browser verification also covers the actual tag any/all filtering, sample label editing, search and reset, workflow tabs and keyboard navigation, copy commands, and desktop/mobile overflow. The sample demo is intentionally illustrative; it is not the live Attend console and never reads real sessions.
