import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const MAP_STYLES = [
  {
    id: 'street',
    label: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 19,
  },
  {
    id: 'dark',
    label: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxNativeZoom: 19,
  },
  {
    id: 'light',
    label: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxNativeZoom: 19,
  },
  {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxNativeZoom: 19,
  },
  {
    id: 'terrain',
    label: 'Terrain',
    url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png',
    attribution: 'Map tiles by <a href="https://stamen.com">Stamen Design</a>, hosted by <a href="https://stadiamaps.com/">Stadia Maps</a>. Data by <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxNativeZoom: 18,
  },
  {
    id: 'topo',
    label: 'Topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxNativeZoom: 17,
  },
]

// Fix default Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Only flies when navTarget.id changes — ignores user-initiated zoom/pan
function MapUpdater({ navTarget }) {
  const map = useMap()
  useEffect(() => {
    if (navTarget) {
      map.flyTo(navTarget.center, navTarget.zoom, { duration: 1.2 })
    }
  }, [navTarget?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function MapResizeObserver() {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}

function MapClickHandler({ onMapClick, zoomRef }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
    zoomend(e) {
      zoomRef.current = e.target.getZoom()
    },
  })
  return null
}

async function fetchElevation(lat, lon) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`
  )
  if (!res.ok) throw new Error('Elevation fetch failed')
  const data = await res.json()
  return data.elevation?.[0] ?? null
}

async function geocodeAddress(address) {
  const encoded = encodeURIComponent(address)
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
    { headers: { 'Accept-Language': 'en' } }
  )
  if (!res.ok) throw new Error('Geocoding request failed')
  const data = await res.json()
  if (!data.length) throw new Error('No results found for this address')
  const { lat, lon, display_name } = data[0]
  return { lat: parseFloat(lat), lon: parseFloat(lon), displayName: display_name }
}

// Build a clean human-readable address from Nominatim addressdetails
function formatAddress(data) {
  const a = data.address ?? {}
  const parts = []

  // Most specific first: building name, then number + road
  if (a.tourism || a.amenity || a.building) parts.push(a.tourism ?? a.amenity ?? a.building)
  if (a.house_number && a.road) parts.push(`${a.house_number} ${a.road}`)
  else if (a.road) parts.push(a.road)

  // Locality / neighbourhood
  const locality = a.suburb ?? a.neighbourhood ?? a.hamlet ?? a.village ?? a.town
  if (locality && locality !== (a.city ?? a.municipality)) parts.push(locality)

  // City / municipality
  const city = a.city ?? a.municipality ?? a.county
  if (city) parts.push(city)

  // Postcode + country
  if (a.postcode) parts.push(a.postcode)
  if (a.country) parts.push(a.country)

  // Fall back to Nominatim's own display_name if we couldn't build anything meaningful
  return parts.length >= 2 ? parts.join(', ') : data.display_name
}

async function reverseGeocode(lat, lon) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18&addressdetails=1`,
    { headers: { 'Accept-Language': 'en' } }
  )
  if (!res.ok) throw new Error('Reverse geocoding request failed')
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return formatAddress(data)
}

// ── Extra metrics helpers ─────────────────────────────────

function toDMS(deg, isLat) {
  const abs = Math.abs(deg)
  const d = Math.floor(abs)
  const mFull = (abs - d) * 60
  const m = Math.floor(mFull)
  const s = ((mFull - m) * 60).toFixed(1)
  const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W')
  return `${d}°${m}'${s}" ${dir}`
}

const GH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
function toGeohash(lat, lon, precision = 8) {
  let idx = 0, bit = 0, evenBit = true, geohash = ''
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180
  while (geohash.length < precision) {
    if (evenBit) {
      const mid = (lonMin + lonMax) / 2
      if (lon >= mid) { idx = idx * 2 + 1; lonMin = mid } else { idx = idx * 2; lonMax = mid }
    } else {
      const mid = (latMin + latMax) / 2
      if (lat >= mid) { idx = idx * 2 + 1; latMin = mid } else { idx = idx * 2; latMax = mid }
    }
    evenBit = !evenBit
    if (++bit === 5) { geohash += GH_BASE32[idx]; bit = 0; idx = 0 }
  }
  return geohash
}

const GEORISQUES_RISKS = {
  inondation:                       { emoji: '🌊', label: 'Flood' },
  remonteeNappe:                    { emoji: '💧', label: 'Groundwater rise' },
  seisme:                           { emoji: '🫨', label: 'Earthquake' },
  mouvementTerrain:                 { emoji: '⛰️', label: 'Ground movement' },
  retraitGonflementArgile:          { emoji: '🏗️', label: 'Clay shrinkage' },
  reculTraitCote:                   { emoji: '🌊', label: 'Coastal erosion' },
  risqueCotier:                     { emoji: '🌊', label: 'Coastal risk' },
  avalanche:                        { emoji: '🏔️', label: 'Avalanche' },
  feuForet:                         { emoji: '🔥', label: 'Forest fire' },
  eruptionVolcanique:               { emoji: '🌋', label: 'Volcanic eruption' },
  cyclone:                          { emoji: '🌪️', label: 'Strong winds' },
  radon:                            { emoji: '☢️', label: 'Radon' },
  icpe:                             { emoji: '🏭', label: 'Industrial sites' },
  nucleaire:                        { emoji: '☢️', label: 'Nuclear' },
  canalisationsMatieresDangereuses: { emoji: '⚗️', label: 'Hazardous pipelines' },
  pollutionSols:                    { emoji: '🧪', label: 'Soil pollution' },
  ruptureBarrage:                   { emoji: '💦', label: 'Dam breach' },
  risqueMinier:                     { emoji: '⛏️', label: 'Mining risk' },
}

function riskSeverity(libelle) {
  if (!libelle) return 'medium'
  const l = libelle.toLowerCase()
  if (l.includes('important') || l.includes('élevé') || l.includes('fort')) return 'high'
  if (l.includes('faible')) return 'low'
  return 'medium'
}

function activeRisks(riskObj) {
  return Object.entries(riskObj ?? {})
    .filter(([, v]) => v?.present)
    .map(([key, v]) => ({
      key,
      emoji: GEORISQUES_RISKS[key]?.emoji ?? '⚠️',
      label: GEORISQUES_RISKS[key]?.label ?? key,
      severity: riskSeverity(v.libelleStatutCommune),
    }))
}

async function fetchGeorisques(lat, lon) {
  const r1 = await fetch(`https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lon}&fields=code,nom`)
  if (!r1.ok) return null
  const communes = await r1.json()
  if (!communes.length) return null
  const { code, nom } = communes[0]
  const r2 = await fetch(
    `https://georisques.gouv.fr/api/v1/resultats_rapport_risque?code_insee=${code}`,
    { headers: { Accept: 'application/json' } }
  )
  if (!r2.ok) return null
  const data = await r2.json()
  return {
    commune: nom,
    codeInsee: code,
    natural: activeRisks(data.risquesNaturels),
    tech: activeRisks(data.risquesTechnologiques),
  }
}

const WMO = {
  0: ['☀️', 'Clear sky'], 1: ['🌤️', 'Mainly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'],
  45: ['🌫️', 'Fog'], 48: ['🌫️', 'Icy fog'],
  51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌦️', 'Heavy drizzle'],
  61: ['🌧️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
  71: ['🌨️', 'Light snow'], 73: ['🌨️', 'Snow'], 75: ['❄️', 'Heavy snow'], 77: ['❄️', 'Snow grains'],
  80: ['🌦️', 'Light showers'], 81: ['🌧️', 'Showers'], 82: ['⛈️', 'Heavy showers'],
  85: ['🌨️', 'Snow showers'], 86: ['❄️', 'Heavy snow showers'],
  95: ['⛈️', 'Thunderstorm'], 96: ['⛈️', 'Thunderstorm + hail'], 99: ['⛈️', 'Thunderstorm + heavy hail'],
}

function formatTime(isoStr) {
  return isoStr?.split('T')[1]?.slice(0, 5) ?? '—'
}

function formatOffset(seconds) {
  const h = Math.floor(Math.abs(seconds) / 3600)
  const m = Math.floor((Math.abs(seconds) % 3600) / 60)
  const sign = seconds >= 0 ? '+' : '-'
  return `UTC${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

async function fetchMoreInfo(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weathercode,cloud_cover` +
    `&daily=sunrise,sunset,uv_index_max&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Weather fetch failed')
  const d = await res.json()
  const c = d.current
  const day = d.daily
  const [wEmoji, wLabel] = WMO[c.weathercode] ?? ['🌡️', `Code ${c.weathercode}`]
  return {
    weatherEmoji: wEmoji,
    weatherLabel: wLabel,
    temp: `${c.temperature_2m}${d.current_units.temperature_2m}`,
    humidity: `${c.relative_humidity_2m}%`,
    wind: `${c.wind_speed_10m} ${d.current_units.wind_speed_10m}`,
    precipitation: `${c.precipitation} ${d.current_units.precipitation}`,
    cloudCover: `${c.cloud_cover}%`,
    uvIndex: day.uv_index_max[0]?.toFixed(1) ?? '—',
    sunrise: formatTime(day.sunrise[0]),
    sunset: formatTime(day.sunset[0]),
    timezone: d.timezone.replace('_', ' '),
    utcOffset: formatOffset(d.utc_offset_seconds),
    dmsLat: toDMS(lat, true),
    dmsLon: toDMS(lon, false),
    geohash: toGeohash(lat, lon),
  }
}

// ── Icons ─────────────────────────────────────────────────
const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const MoonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const PinIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
)

const CoordIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)

const MountainIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 20 9 4 15 14 18 10 21 20"/>
  </svg>
)

const LocateIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
    <circle cx="12" cy="12" r="8" strokeDasharray="2 2"/>
  </svg>
)

export default function App() {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [mode, setMode] = useState('address') // 'address' | 'coords'
  const [mapStyleId, setMapStyleId] = useState('street')

  // Address mode state
  const [address, setAddress] = useState('')

  // Coords mode state
  const [latInput, setLatInput] = useState('')
  const [lonInput, setLonInput] = useState('')

  // Result state
  const [result, setResult] = useState(null)
  const [moreInfo, setMoreInfo] = useState(null)
  const [moreExpanded, setMoreExpanded] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Map state
  const [navTarget, setNavTarget] = useState(null) // { center, zoom, id }
  const zoomRef = useRef(2) // tracks live map zoom without triggering re-renders
  const [markerPos, setMarkerPos] = useState(null)

  // Locating state
  const [locating, setLocating] = useState(false)

  // Map expand state (mobile)
  const [mapExpanded, setMapExpanded] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  const loadMoreInfo = useCallback(async (lat, lon) => {
    setMoreInfo(null)
    setMoreExpanded(false)
    setMoreLoading(true)
    try {
      const [info, georisques] = await Promise.all([
        fetchMoreInfo(lat, lon),
        fetchGeorisques(lat, lon).catch(() => null),
      ])
      setMoreInfo({ ...info, georisques })
    } catch {
      // silently fail — extra metrics are non-critical
    } finally {
      setMoreLoading(false)
    }
  }, [])

  // Shared reverse-geocode flow used by manual input, map click, and locate me
  // keepZoom=true → don't change zoom (map click); false → zoom to 13 minimum (locate/search)
  const lookupCoords = useCallback(async (lat, lon, keepZoom = false) => {
    setLoading(true)
    setError('')
    setResult(null)
    setLatInput(String(lat))
    setLonInput(String(lon))
    setMode('coords')
    try {
      const [addr, elevation] = await Promise.all([
        reverseGeocode(lat, lon),
        fetchElevation(lat, lon),
      ])
      setResult({ lat, lon, address: addr, elevation })
      const zoom = keepZoom ? zoomRef.current : Math.max(zoomRef.current, 13)
      setNavTarget({ center: [lat, lon], zoom, id: Date.now() })
      setMarkerPos([lat, lon])
      loadMoreInfo(lat, lon)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [loadMoreInfo])

  const handleAddressLookup = useCallback(async () => {
    if (!address.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const { lat, lon, displayName } = await geocodeAddress(address.trim())
      const elevation = await fetchElevation(lat, lon)
      setResult({ lat, lon, address: displayName, elevation })
      setNavTarget({ center: [lat, lon], zoom: Math.max(zoomRef.current, 13), id: Date.now() })
      setMarkerPos([lat, lon])
      loadMoreInfo(lat, lon)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [address, loadMoreInfo])

  const handleCoordsLookup = useCallback(async () => {
    const lat = parseFloat(latInput)
    const lon = parseFloat(lonInput)
    if (isNaN(lat) || isNaN(lon)) { setError('Please enter valid numeric coordinates.'); return }
    if (lat < -90 || lat > 90) { setError('Latitude must be between -90 and 90.'); return }
    if (lon < -180 || lon > 180) { setError('Longitude must be between -180 and 180.'); return }
    await lookupCoords(lat, lon)
  }, [latInput, lonInput, lookupCoords])

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) { setError('Geolocation is not supported by your browser.'); return }
    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        lookupCoords(pos.coords.latitude, pos.coords.longitude)
      },
      (err) => {
        setLocating(false)
        setError(`Location error: ${err.message}`)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [lookupCoords])

  const handleMapClick = useCallback((lat, lon) => {
    lookupCoords(lat, lon, true) // keepZoom=true: stay at current zoom
  }, [lookupCoords])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      mode === 'address' ? handleAddressLookup() : handleCoordsLookup()
    }
  }

  const switchMode = (m) => {
    setMode(m)
    setError('')
    setResult(null)
  }

  const handleReset = () => {
    setAddress('')
    setLatInput('')
    setLonInput('')
    setResult(null)
    setMoreInfo(null)
    setMoreExpanded(false)
    setError('')
    setMarkerPos(null)
    setNavTarget({ center: [20, 0], zoom: 2, id: Date.now() })
    zoomRef.current = 2
  }

  return (
    <div className={`app ${dark ? 'dark' : 'light'}`}>
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <PinIcon />
            <span>LocaLens</span>
          </div>
          <p className="tagline">Address ↔ Coordinates · Elevation</p>
        </div>
        <div className="header-actions">
          <button className="reset-btn" onClick={handleReset} title="Reset">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Reset
          </button>
          <button className="theme-toggle" onClick={() => setDark(d => !d)} aria-label="Toggle theme">
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      <main className={`main ${mapExpanded ? 'map-fullscreen' : ''}`}>
        <div className="panel">
          <div className="mode-tabs">
            <button
              className={`tab ${mode === 'address' ? 'active' : ''}`}
              onClick={() => switchMode('address')}
            >
              <PinIcon /> Address → Coords
            </button>
            <button
              className={`tab ${mode === 'coords' ? 'active' : ''}`}
              onClick={() => switchMode('coords')}
            >
              <CoordIcon /> Coords → Address
            </button>
          </div>

          {mode === 'address' ? (
            <div className="input-group">
              <label className="input-label">Enter any address or place name</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Eiffel Tower, Paris"
                value={address}
                onChange={e => setAddress(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="btn-row">
                <button className="btn" onClick={handleAddressLookup} disabled={loading || locating}>
                  {loading ? <span className="spinner" /> : 'Search'}
                </button>
                <button
                  className={`btn-locate ${locating ? 'locating' : ''}`}
                  onClick={handleLocateMe}
                  disabled={loading || locating}
                  title="Use my location"
                >
                  <LocateIcon />
                </button>
              </div>
            </div>
          ) : (
            <div className="input-group">
              <label className="input-label">Enter latitude & longitude</label>
              <div className="coords-inputs">
                <input
                  className="input"
                  type="number"
                  placeholder="Latitude (-90 to 90)"
                  value={latInput}
                  onChange={e => setLatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  step="any"
                  min="-90"
                  max="90"
                />
                <input
                  className="input"
                  type="number"
                  placeholder="Longitude (-180 to 180)"
                  value={lonInput}
                  onChange={e => setLonInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  step="any"
                  min="-180"
                  max="180"
                />
              </div>
              <div className="btn-row">
                <button className="btn" onClick={handleCoordsLookup} disabled={loading || locating}>
                  {loading ? <span className="spinner" /> : 'Search'}
                </button>
                <button
                  className={`btn-locate ${locating ? 'locating' : ''}`}
                  onClick={handleLocateMe}
                  disabled={loading || locating}
                  title="Use my location"
                >
                  <LocateIcon />
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="error-card">
              <span>⚠ {error}</span>
            </div>
          )}

          {result && (
            <div className="result-card">
              <div className="result-row">
                <div className="result-item">
                  <span className="result-icon"><PinIcon /></span>
                  <div>
                    <div className="result-label">Address</div>
                    <div className="result-value address-value">{result.address}</div>
                  </div>
                </div>
              </div>
              <div className="result-chips">
                <div className="chip">
                  <span className="chip-icon"><CoordIcon /></span>
                  <div className="chip-body">
                    <div className="chip-label">Latitude</div>
                    <div className="chip-val">{result.lat.toFixed(6)}°</div>
                  </div>
                </div>
                <div className="chip">
                  <span className="chip-icon"><CoordIcon /></span>
                  <div className="chip-body">
                    <div className="chip-label">Longitude</div>
                    <div className="chip-val">{result.lon.toFixed(6)}°</div>
                  </div>
                </div>
                <div className="chip">
                  <span className="chip-icon"><MountainIcon /></span>
                  <div className="chip-body">
                    <div className="chip-label">Elevation</div>
                    <div className="chip-val">
                      {result.elevation !== null ? `${result.elevation.toFixed(1)} m` : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="copy-row">
                <button
                  className="copy-btn"
                  onClick={() => navigator.clipboard.writeText(`${result.lat}, ${result.lon}`)}
                >
                  Copy Coordinates
                </button>
                <button
                  className="copy-btn"
                  onClick={() => navigator.clipboard.writeText(result.address)}
                >
                  Copy Address
                </button>
              </div>

              {/* More Info expandable */}
              <button
                className="more-toggle"
                onClick={() => setMoreExpanded(x => !x)}
                disabled={moreLoading && !moreInfo}
              >
                {moreLoading && !moreInfo
                  ? <><span className="spinner spinner-sm" /> Loading extra info…</>
                  : <>{moreExpanded ? '▲' : '▼'} {moreExpanded ? 'Hide' : 'Show'} more info</>
                }
              </button>

              {moreExpanded && moreInfo && (
                <div className="more-grid">
                  <div className="more-section">
                    <div className="more-section-title">🌤 Weather</div>
                    <div className="more-row"><span>{moreInfo.weatherEmoji} {moreInfo.weatherLabel}</span></div>
                    <div className="more-row"><span className="more-label">Temperature</span><span className="more-val">{moreInfo.temp}</span></div>
                    <div className="more-row"><span className="more-label">Humidity</span><span className="more-val">{moreInfo.humidity}</span></div>
                    <div className="more-row"><span className="more-label">Wind</span><span className="more-val">{moreInfo.wind}</span></div>
                    <div className="more-row"><span className="more-label">Precipitation</span><span className="more-val">{moreInfo.precipitation}</span></div>
                    <div className="more-row"><span className="more-label">Cloud cover</span><span className="more-val">{moreInfo.cloudCover}</span></div>
                    <div className="more-row"><span className="more-label">UV Index (max)</span><span className="more-val">{moreInfo.uvIndex}</span></div>
                  </div>
                  <div className="more-section">
                    <div className="more-section-title">🕐 Time &amp; Sun</div>
                    <div className="more-row"><span className="more-label">Timezone</span><span className="more-val">{moreInfo.timezone}</span></div>
                    <div className="more-row"><span className="more-label">UTC Offset</span><span className="more-val">{moreInfo.utcOffset}</span></div>
                    <div className="more-row"><span className="more-label">Sunrise</span><span className="more-val">🌅 {moreInfo.sunrise}</span></div>
                    <div className="more-row"><span className="more-label">Sunset</span><span className="more-val">🌇 {moreInfo.sunset}</span></div>
                  </div>
                  <div className="more-section">
                    <div className="more-section-title">📐 Coordinates</div>
                    <div className="more-row"><span className="more-label">Lat (DMS)</span><span className="more-val">{moreInfo.dmsLat}</span></div>
                    <div className="more-row"><span className="more-label">Lon (DMS)</span><span className="more-val">{moreInfo.dmsLon}</span></div>
                    <div className="more-row"><span className="more-label">Geohash</span><span className="more-val mono">{moreInfo.geohash}</span></div>
                  </div>
                  {moreInfo.georisques && (() => {
                    const risks = [...moreInfo.georisques.natural, ...moreInfo.georisques.tech]
                    if (!risks.length) return null
                    return (
                      <div className="more-section">
                        <div className="more-section-title">🏛️ Risks · {moreInfo.georisques.commune}</div>
                        {risks.map(r => (
                          <div key={r.key} className="risk-row">
                            <span className="risk-name">{r.emoji} {r.label}</span>
                            <span className={`risk-badge risk-badge--${r.severity}`}>
                              {r.severity === 'high' ? 'High' : r.severity === 'low' ? 'Low' : 'Present'}
                            </span>
                          </div>
                        ))}
                        <div className="risk-source-note">Géorisques · commune level</div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          <div className="map-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            Click anywhere on the map to reverse geocode
          </div>
        </div>

        <div className="map-container">
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            {(() => {
              const style = MAP_STYLES.find(s => s.id === mapStyleId) ?? MAP_STYLES[0]
              return (
                <TileLayer
                  key={style.id}
                  attribution={style.attribution}
                  url={style.url}
                  maxNativeZoom={style.maxNativeZoom}
                  maxZoom={22}
                />
              )
            })()}
            <MapResizeObserver />
            <MapUpdater navTarget={navTarget} />
            <MapClickHandler onMapClick={handleMapClick} zoomRef={zoomRef} />
            {markerPos && (
              <Marker position={markerPos}>
                <Popup>
                  {result?.address && <strong>{result.address}</strong>}
                  <br />
                  {result?.lat?.toFixed(6)}°, {result?.lon?.toFixed(6)}°
                  {result?.elevation != null && (
                    <><br />Elevation: {result.elevation.toFixed(1)} m</>
                  )}
                </Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Locate Me button */}
          <button
            className={`locate-btn ${locating ? 'locating' : ''}`}
            onClick={handleLocateMe}
            disabled={locating || loading}
            title="Use my location"
          >
            <LocateIcon />
          </button>

          {/* Map expand/collapse — mobile only */}
          <button
            className="map-expand-btn"
            onClick={() => setMapExpanded(x => !x)}
            title={mapExpanded ? 'Collapse map' : 'Expand map'}
          >
            {mapExpanded
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            }
          </button>

          <div className="map-style-picker">
            {MAP_STYLES.map(s => (
              <button
                key={s.id}
                className={`map-style-btn ${mapStyleId === s.id ? 'active' : ''}`}
                onClick={() => setMapStyleId(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </main>

      <footer className="footer">
        Geocoding by <a href="https://nominatim.openstreetmap.org" target="_blank" rel="noreferrer">Nominatim / OpenStreetMap</a>
        &nbsp;·&nbsp;
        Elevation by <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a>
        &nbsp;·&nbsp;
        Made with <svg width="12" height="12" viewBox="0 0 24 24" fill="#C1513A" style={{display:'inline',verticalAlign:'middle',marginBottom:'1px'}}><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> by <span style={{ color: '#E2704A' }}>Lawrence</span>
      </footer>
    </div>
  )
}
