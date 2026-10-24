# Attend website

Static English GitHub Pages site at `/attend/`. The former `/attend/zh/` URL redirects to the English homepage.

```sh
npm ci --ignore-scripts
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
- Ultrawide showcase: 3440 × 1440, six native session columns (four in the Midnight screenshot) and 60 synthetic sessions. The embedded demo offers Fit screen / Ultrawide width controls; the actual Settings column selector and panel divider remain available.
- Product screenshots: `docs/assets/attend-*.jpg`, captured from current source with synthetic data.
- `demo.ts`: invokes the native `renderConsole` and `buildWorkStats`, producing Dark, Light and Midnight demo routes plus native palette CSS.
- `demo-runtime.js`: in-memory fixture backend; no CLI/model execution or external network.
- `showcase.mjs`: session anatomy, handoff states, relationships, statistics and screenshot gallery.
- `SCENARIOS.md`: rationale, code evidence and behavior boundaries.

## Ko-fi

The creator does not have a Ko-fi page yet. No broken or guessed donation URL is published. When the account is ready, set `kofi` in `config.mjs` to its real `https://ko-fi.com/...` URL and push. The closing support button appears automatically. No embedded payment script, key, or backend is needed.

## Checks

`check.mjs` verifies the English page and the legacy redirect, unique IDs, local links and anchors, images/styles/scripts, metadata, and absence of unconfigured donation URLs. Browser verification also covers the actual tag any/all filtering, native label editing, search and reset, workflow tabs and keyboard navigation, copy commands, and desktop/mobile overflow. The demo uses the actual console renderer and styles, backed by synthetic fixtures. It never discovers real sessions, reads user settings, calls providers, or executes a CLI. Unknown endpoints fail explicitly. Search in this static sample is limited to fixture metadata; the installed app has the real transcript index.
