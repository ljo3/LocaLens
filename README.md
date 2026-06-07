# 🔍 LocaLens

> Address ↔ Coordinates · Elevation · Weather · and more — all in one map.

![LocaLens](https://img.shields.io/badge/built%20with-React%20%2B%20Vite-61dafb?style=flat-square&logo=react)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
[![Deploy](https://img.shields.io/badge/deploy-Cloudflare%20Pages-orange?style=flat-square&logo=cloudflare)](https://localens.pages.dev)

**Live:** [localens.pages.dev](https://localens.pages.dev) · **Slides:** [rawcdn.githack.com](https://rawcdn.githack.com/ljo3/LocaLens/main/slides.html)

LocaLens is a static, zero-backend web app for exploring any location on Earth. Search by address or coordinates, drop a pin anywhere on the map, and instantly get elevation, live weather, sunrise/sunset, timezone, DMS coordinates, and more.

---

## Features

| Feature | Details |
|---|---|
| **Address → Coordinates** | Type any address or place name, get lat/lon |
| **Coordinates → Address** | Enter lat/lon, get a clean human-readable address |
| **Map click** | Click anywhere on the map to reverse geocode that point |
| **Locate Me** | One-click GPS button to jump to your current location |
| **Elevation** | Meters above sea level via Open-Meteo |
| **Live Weather** | Condition, temperature, humidity, wind, precipitation, cloud cover, UV index |
| **Sun & Time** | Sunrise, sunset, timezone name, UTC offset |
| **Coordinate formats** | Decimal degrees and DMS (Degrees°Minutes'Seconds") |
| **Geohash** | Compact 8-character location hash |
| **6 Map styles** | Street, Dark, Light, Satellite, Terrain, Topo |
| **Dark / Light mode** | Follows system preference, toggle in header |
| **Copy to clipboard** | Copy coordinates or full address with one click |
| **Fully static** | No server, no database — deploys anywhere |

---

## Tech Stack

- **[React 18](https://react.dev/)** + **[Vite](https://vitejs.dev/)** — UI and build
- **[React-Leaflet](https://react-leaflet.js.org/)** — interactive map
- **[Nominatim / OpenStreetMap](https://nominatim.openstreetmap.org/)** — geocoding & reverse geocoding (free, no key)
- **[Open-Meteo](https://open-meteo.com/)** — elevation, weather, UV, sunrise/sunset (free, no key)
- **[Esri World Imagery](https://www.esri.com/)** — satellite tiles
- **[CartoDB](https://carto.com/)** — dark & light tiles
- **[Stadia Maps / Stamen](https://stadiamaps.com/)** — terrain tiles
- **[OpenTopoMap](https://opentopomap.org/)** — topographic tiles

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

The app runs at `http://localhost:5173` by default.

---

## Deployment

LocaLens is a fully static site — the `dist/` folder after `npm run build` is all you need.

### Cloudflare Pages (recommended)

**Option A — Git integration:**
1. Push to GitHub or GitLab
2. Go to Cloudflare Dashboard → Pages → Create project → Connect Git
3. Set:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. Deploy — auto-deploys on every push

**Option B — Direct upload:**
```bash
npm run build
npx wrangler pages deploy dist --project-name localens
```

Or drag-and-drop the `dist/` folder in the Cloudflare Pages dashboard.

### Other hosts

Any static host works: Netlify, Vercel, GitHub Pages, S3, etc. Just point it at the `dist/` folder.

---

## API Usage & Limits

All APIs used are **free with no API key required**.

| API | Usage policy |
|---|---|
| Nominatim | Max 1 req/sec, requires valid Referer in production. Fine for personal use. |
| Open-Meteo | Free for non-commercial use, no rate limit for reasonable traffic. |
| Esri, CartoDB, Stadia, OpenTopoMap | Free tile servers for reasonable public use. |

For high-traffic production use, consider self-hosting Nominatim or switching to a commercial geocoder.

---

## Project Structure

```
src/
├── App.jsx       # Main component — all UI, state, and API calls
├── App.css       # Styles with CSS custom properties for theming
├── index.css     # Base reset
└── main.jsx      # React entry point
index.html        # HTML shell
vite.config.js    # Vite config
```

---

Made with ❤️ by **Lawrence**
