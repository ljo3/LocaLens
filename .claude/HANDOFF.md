# Handoff — 2026-05-31 21:30:50 CEST

## What was built this session

### LocaLens app (`src/`)
- **Géorisques flood/risk integration** — two-step lookup: `geo.api.gouv.fr` → INSEE code → `georisques.gouv.fr` risk report. Shows 18 risk types (flood, earthquake, radon, etc.) with coloured severity badges. France only.
- **Locate Me button** — GPS button inline with Search, in both Address and Coords tabs.
- **Desktop map grey area fix** — `height: 100vh; overflow: hidden` on `.app`, `min-height: 0` on `.main`. Map no longer collapses when "Show more info" expands.
- **Mobile layout fix (partial)** — `grid-template-rows: minmax(0, 55svh) minmax(150px, 1fr)` caps panel height so map always gets space. `MapResizeObserver` calls `invalidateSize()` on every container resize. Footer hidden on mobile.
- **Tile picker repositioned on mobile** — moved to `top: 5px` so it opens downward into the map area instead of bleeding upward into the panel.

### Daily weather email (`.github/workflows/daily-weather.yml`)
- Runs at `0 5 * * *` UTC = **7 AM Paris summer time (CEST)**
- Fetches Open-Meteo forecast for Poissy (lat 48.9295, lon 2.0448)
- Sends HTML email from `lawrencejohny@gmail.com` → `lawrence.mk.johny@gmail.com`
- HTML table layout: 200px label column, 580px container, alternating row shading
- Umbrella tip shown when UV > 4
- Appends a row to `weather-log.md` and commits as `ljo3` — counts as daily GitHub contribution
- Requires one GitHub secret: `GMAIL_APP_PASSWORD` (App Password from lawrencejohny@gmail.com account)

### Reveal.js slide deck (`slides.html`)
- Self-contained presentation using the project design system (light/dark mode, CSS tokens, all components)
- 7 slides: Title → Architecture → What is LocaLens? → Feature Set → Lookup Pipeline → Tech Stack → Deployment
- Architecture slide has inline SVG big-picture diagram (User → App panels → APIs → Cloudflare Pages)
- Slide counter shown at bottom-centre as `current/total` (e.g. `1/7`)
- `make-slides` skill converted from flat `.md` to proper `SKILL.md` format; template updated with centered slide numbers

### Project tooling
- `CLAUDE.md` added to repo (was previously untracked)

## Current state
- App is live at [localens.pages.dev](https://localens.pages.dev) (Cloudflare Pages, auto-deploys on push)
- Daily email workflow is active and tested — first successful run was 2026-05-31
- `weather-log.md` exists in repo with first entries

## Known issues / next up
See [TODO.md](TODO.md)
