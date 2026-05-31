# TODO

## 2026-05-31 20:57:40 CEST

- [ ] **Android layout still needs work** — the panel/map layout has been improved (capped panel at 55svh, map min 150px, ResizeObserver for Leaflet) but user confirmed it still doesn't look good on Android. **Try diagnosing and fixing with Gemini CLI** — get a second opinion on the mobile CSS approach.
  - Screenshots are in `android/` folder (not committed)
  - Key files: `src/App.css` (mobile media query ~line 757), `src/App.jsx` (`MapResizeObserver` component)
  - Known remaining issues: panel/map proportions on various Android screen sizes, tile picker z-index bleeding into panel
