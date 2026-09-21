import { useEffect, useMemo, useRef, useState } from 'react'
import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import { LineLayer, PolygonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { Map as MapLibreMap, NavigationControl } from 'maplibre-gl'
import type { Map as MapLibreMapType, MapMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { LayoutGrid, MapPinPlus, Satellite, Trash2, X } from 'lucide-react'
import { createPOI, deletePOI, fetchPOIs, type PointOfInterest } from '@/lib/api'
import { API_BASE } from '@/lib/api'
import { CAMERA_SITES, destinationPoint, fovConeLngLat, siteFor } from '@/lib/cameraSites'
import type { IbvapEvent } from '@/types'

// Free, keyless MapLibre-compatible vector style (OpenFreeMap) — CARTO's
// dark-tile endpoint started gating behind an API key mid-session, so this
// map never depends on a third-party key at all. Its own base colors are
// overridden below to a dark tactical palette via setPaintProperty, not a
// CSS filter hack, since MapLibre's vector layers support that natively.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
// Esri World Imagery — real satellite/aerial photography, freely served
// without an API key. Used for the checkpoint "digital twin" close-up view
// since OpenStreetMap's vector tags turned out to be very sparse at these
// specific real BOP coordinates (verified via Overpass: near-zero tagged
// infrastructure within 2km) — real pixels beat empty vectors.
const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const LIVE_THRESHOLD_SECONDS = 6
const ALERT_WINDOW_SECONDS = 25
const CONE_RANGE_M = 22000
const CONE_HEIGHT_M = 3500
const RETICLE_RANGE_M = 4000
const GRID_BOUNDS = { minLat: 24.5, maxLat: 28.5, minLng: 83.5, maxLng: 89.5, step: 0.5 }

type CameraStatus = 'live' | 'armed' | 'unmonitored'

const POI_CATEGORY_LABELS: Record<PointOfInterest['category'], string> = {
  suspected_staging_point: 'Suspected staging point',
  historical_seizure: 'Historical seizure site',
  unmonitored_crossing: 'Unmonitored crossing',
  unverified_tip: 'Unverified tip',
  other: 'Other',
}
const POI_SOURCE_LABELS: Record<PointOfInterest['source'], string> = {
  humint: 'HUMINT',
  pattern_of_life: 'Pattern-of-life analysis',
  historical_record: 'Historical record',
  unverified: 'Unverified',
}

/** Four corner brackets of a target-lock reticle, camera-viewfinder style —
 * each corner is two short line segments meeting at a right angle, rotated
 * by `rotationDeg` for the "locking on" spin. Real haversine-projected
 * positions (destinationPoint), not a fixed pixel-space overlay, so it
 * stays correctly sized/placed regardless of zoom. */
function reticleBracketSegments(lat: number, lng: number, rangeM: number, rotationDeg: number): [number, number][][] {
  const corners = [45, 135, 225, 315].map((bearing) => destinationPoint(lat, lng, bearing + rotationDeg, rangeM))
  const tickLen = rangeM * 0.35
  const segments: [number, number][][] = []
  corners.forEach((corner, i) => {
    const inwardBearing1 = (45 + i * 90 + rotationDeg + 180) % 360
    const inwardBearing2 = (135 + i * 90 + rotationDeg + 180) % 360
    const [clat, clng] = corner
    const tick1 = destinationPoint(clat, clng, inwardBearing1, tickLen)
    const tick2 = destinationPoint(clat, clng, inwardBearing2, tickLen)
    segments.push([
      [clng, clat],
      [tick1[1], tick1[0]],
    ])
    segments.push([
      [clng, clat],
      [tick2[1], tick2[0]],
    ])
  })
  return segments
}

/** A simple lat/lng graticule — the "topographic wireframe grid" toggle.
 * Honestly just a tactical reference grid, not real elevation-derived
 * terrain: no DEM tile source is wired up (those require their own API
 * key), so this doesn't pretend to be more than a military-map-style grid
 * overlay. */
function tacticalGridLines(): { from: [number, number]; to: [number, number] }[] {
  const lines: { from: [number, number]; to: [number, number] }[] = []
  for (let lat = GRID_BOUNDS.minLat; lat <= GRID_BOUNDS.maxLat; lat += GRID_BOUNDS.step) {
    lines.push({ from: [GRID_BOUNDS.minLng, lat], to: [GRID_BOUNDS.maxLng, lat] })
  }
  for (let lng = GRID_BOUNDS.minLng; lng <= GRID_BOUNDS.maxLng; lng += GRID_BOUNDS.step) {
    lines.push({ from: [lng, GRID_BOUNDS.minLat], to: [lng, GRID_BOUNDS.maxLat] })
  }
  return lines
}

function darkenStyle(map: MapLibreMapType) {
  const style = map.getStyle()
  if (!style?.layers) return
  for (const layer of style.layers) {
    try {
      if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#05070c')
      else if (layer.type === 'fill' && /water/i.test(layer.id)) map.setPaintProperty(layer.id, 'fill-color', '#061826')
      else if (layer.type === 'fill' && /(land|landuse|landcover|park)/i.test(layer.id)) map.setPaintProperty(layer.id, 'fill-color', '#0a0e14')
      else if (layer.type === 'fill') map.setPaintProperty(layer.id, 'fill-color', '#0c1118')
      else if (layer.type === 'line' && /(road|highway|street)/i.test(layer.id)) map.setPaintProperty(layer.id, 'line-color', '#1b2838')
      else if (layer.type === 'line' && /(boundar|border)/i.test(layer.id)) map.setPaintProperty(layer.id, 'line-color', '#f59e0b')
      else if (layer.type === 'line') map.setPaintProperty(layer.id, 'line-color', '#16202c')
      else if (layer.type === 'symbol') {
        map.setPaintProperty(layer.id, 'text-color', '#5b6b7c')
        map.setPaintProperty(layer.id, 'text-halo-color', '#05070c')
        map.setPaintProperty(layer.id, 'text-halo-width', 1.2)
      }
    } catch {
      // some style layers don't support every paint property (e.g. raster
      // sublayers) — skip those rather than let one failure kill the pass
    }
  }
}

export function CoverageMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMapType | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const lastFlownId = useRef<number | null>(null)
  const markingModeRef = useRef(false)

  const [ready, setReady] = useState(false)
  const [telemetry, setTelemetry] = useState<Record<string, { received_at: number }>>({})
  const [events, setEvents] = useState<IbvapEvent[]>([])
  const [pois, setPois] = useState<PointOfInterest[]>([])
  const [pulsePhase, setPulsePhase] = useState(0)
  const [showGrid, setShowGrid] = useState(false)
  const [showSatellite, setShowSatellite] = useState(false)
  const [markingMode, setMarkingMode] = useState(false)
  const [pendingPoint, setPendingPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [selected, setSelected] = useState<{ camera_id: string; label: string; status: CameraStatus; alerting: boolean } | null>(null)
  const [selectedPOI, setSelectedPOI] = useState<PointOfInterest | null>(null)

  useEffect(() => {
    markingModeRef.current = markingMode
  }, [markingMode])

  useEffect(() => {
    if (!containerRef.current) return
    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: [86.5, 26.8],
      zoom: 6.6,
      pitch: 55,
      bearing: -17,
      attributionControl: { compact: true },
    })
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-left')
    map.on('load', () => {
      darkenStyle(map)

      const style = map.getStyle()
      const firstSymbolId = style?.layers?.find((l) => l.type === 'symbol')?.id
      map.addSource('esri-satellite', {
        type: 'raster',
        tiles: [SATELLITE_TILES],
        tileSize: 256,
        attribution: 'Esri, Maxar, Earthstar Geographics',
      })
      map.addLayer({ id: 'esri-satellite-layer', type: 'raster', source: 'esri-satellite', layout: { visibility: 'none' } }, firstSymbolId)

      const overlay = new MapboxOverlay({ layers: [] })
      map.addControl(overlay)
      overlayRef.current = overlay
      setReady(true)
    })
    map.on('click', (e: MapMouseEvent) => {
      if (!markingModeRef.current) return
      setPendingPoint({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      overlayRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !map.getLayer('esri-satellite-layer')) return
    map.setLayoutProperty('esri-satellite-layer', 'visibility', showSatellite ? 'visible' : 'none')
  }, [showSatellite, ready])

  useEffect(() => {
    function refresh() {
      fetch(`${API_BASE}/telemetry`)
        .then((r) => r.json())
        .then(setTelemetry)
        .catch(() => {})
      fetch(`${API_BASE}/events?limit=500`)
        .then((r) => r.json())
        .then(setEvents)
        .catch(() => {})
      fetchPOIs().then(setPois).catch(() => {})
    }
    refresh()
    const interval = setInterval(refresh, 4000)
    window.addEventListener('ibvap:events-refresh', refresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener('ibvap:events-refresh', refresh)
    }
  }, [])

  // Pulse clock for alert cones / rings — deck.gl layers are cheap to
  // rebuild from small arrays, so a plain interval-driven phase is enough
  // for a convincing "breathing" animation without a custom shader.
  useEffect(() => {
    const id = setInterval(() => setPulsePhase((p) => (p + 1) % 100), 80)
    return () => clearInterval(id)
  }, [])

  const cameras = useMemo(() => {
    const seen = new Set<string>([...Object.keys(CAMERA_SITES), ...events.map((e) => e.camera_id)])
    const now = Date.now() / 1000
    const nowMs = Date.now()
    return Array.from(seen).map((camera_id) => {
      const t = telemetry[camera_id]
      const hasHistory = events.some((e) => e.camera_id === camera_id)
      let status: CameraStatus = 'unmonitored'
      if (t && now - t.received_at < LIVE_THRESHOLD_SECONDS) status = 'live'
      else if (hasHistory) status = 'armed'

      const alerting = events.some(
        (e) =>
          e.camera_id === camera_id &&
          e.confidence_tier === 'high' &&
          nowMs - new Date(e.created_at + 'Z').getTime() < ALERT_WINDOW_SECONDS * 1000,
      )

      return { camera_id, status, alerting, site: siteFor(camera_id), eventCount: events.filter((e) => e.camera_id === camera_id).length }
    })
  }, [events, telemetry])

  // Fly to the newest high-tier alert's camera the moment it arrives.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const latestHigh = events.find((e) => e.confidence_tier === 'high')
    if (!latestHigh || latestHigh.id === lastFlownId.current) return
    lastFlownId.current = latestHigh.id
    const site = siteFor(latestHigh.camera_id)
    map.flyTo({ center: [site.lng, site.lat], zoom: Math.max(map.getZoom(), 10.5), pitch: 60, duration: 1600 })
  }, [events, ready])

  async function submitPOI(form: { name: string; category: PointOfInterest['category']; source: PointOfInterest['source']; notes: string }) {
    if (!pendingPoint) return
    try {
      const created = await createPOI({ ...form, lat: pendingPoint.lat, lng: pendingPoint.lng, notes: form.notes || null })
      setPois((prev) => [created, ...prev])
    } catch {
      // best-effort; the next poll will reconcile if this silently failed
    } finally {
      setPendingPoint(null)
      setMarkingMode(false)
    }
  }

  async function removePOI(id: number) {
    setPois((prev) => prev.filter((p) => p.id !== id))
    setSelectedPOI(null)
    try {
      await deletePOI(id)
    } catch {
      // best-effort; next poll reconciles
    }
  }

  useEffect(() => {
    if (!overlayRef.current) return

    const pulse = Math.sin((pulsePhase / 100) * Math.PI * 2)
    const pulseFast = Math.sin((pulsePhase / 100) * Math.PI * 6)

    const heatPoints = events.map((e) => {
      const site = siteFor(e.camera_id)
      const angle = (e.id * 137.5) % 360
      const jitterM = 400 + (e.id % 9) * 500
      const rad = (angle * Math.PI) / 180
      const dLat = (jitterM * Math.cos(rad)) / 111320
      const dLng = (jitterM * Math.sin(rad)) / (111320 * Math.cos((site.lat * Math.PI) / 180))
      const weight = e.confidence_tier === 'high' ? 1 : e.confidence_tier === 'medium' ? 0.55 : 0.25
      return { position: [site.lng + dLng, site.lat + dLat], weight }
    })

    const coneLayer = new PolygonLayer({
      id: 'fov-cones',
      data: cameras.filter((c) => c.status !== 'unmonitored'),
      getPolygon: (d) => fovConeLngLat(d.site, CONE_RANGE_M).map(([lng, lat]) => [lng, lat, d.alerting ? CONE_HEIGHT_M * (0.7 + 0.3 * pulse) : CONE_HEIGHT_M * 0.4]),
      extruded: true,
      wireframe: true,
      getFillColor: (d) => (d.alerting ? [239, 68, 68, 60 + pulseFast * 30] : d.site.isThermal ? [251, 146, 60, 55] : d.status === 'live' ? [6, 182, 212, 45] : [245, 158, 11, 30]),
      getLineColor: (d) => (d.alerting ? [248, 113, 113, 220] : d.site.isThermal ? [251, 146, 60, 200] : d.status === 'live' ? [34, 211, 238, 160] : [245, 158, 11, 130]),
      lineWidthMinPixels: 1.5,
      pickable: false,
      updateTriggers: { getFillColor: [pulsePhase], getPolygon: [pulsePhase] },
      transitions: { getFillColor: 150 },
    })

    const heatLayer = new HeatmapLayer({
      id: 'event-heatmap',
      data: heatPoints,
      getPosition: (d) => d.position,
      getWeight: (d) => d.weight,
      radiusPixels: 45,
      intensity: 1,
      threshold: 0.03,
      colorRange: [
        [10, 20, 40, 0],
        [11, 61, 145, 140],
        [56, 189, 248, 170],
        [245, 158, 11, 200],
        [239, 68, 68, 230],
      ],
    })

    const markerLayer = new ScatterplotLayer({
      id: 'camera-markers',
      data: cameras,
      getPosition: (d) => [d.site.lng, d.site.lat],
      getRadius: (d) => (d.alerting ? 900 + pulse * 300 : 550),
      getFillColor: (d) =>
        d.alerting
          ? [239, 68, 68, 230]
          : d.site.isThermal
            ? [251, 146, 60, 230]
            : d.status === 'live'
              ? [16, 185, 129, 230]
              : d.status === 'armed'
                ? [245, 158, 11, 220]
                : [82, 82, 91, 200],
      getLineColor: [5, 7, 12, 255],
      lineWidthMinPixels: 2,
      stroked: true,
      pickable: true,
      radiusMinPixels: 5,
      updateTriggers: { getRadius: [pulsePhase], getFillColor: [pulsePhase] },
      onClick: (info) => {
        const d = info.object as (typeof cameras)[number] | undefined
        if (d) setSelected({ camera_id: d.camera_id, label: d.site.label, status: d.status, alerting: d.alerting })
      },
    })

    // Extra pulsing ring only on live/alerting cameras, radar-style.
    const ringLayer = new ScatterplotLayer({
      id: 'camera-rings',
      data: cameras.filter((c) => c.status === 'live' || c.alerting),
      getPosition: (d) => [d.site.lng, d.site.lat],
      getRadius: (d) => (d.alerting ? 900 : 500) + ((pulsePhase % 100) / 100) * 2200,
      getFillColor: [0, 0, 0, 0],
      getLineColor: (d) => {
        const fade = 1 - (pulsePhase % 100) / 100
        return d.alerting ? [239, 68, 68, Math.round(180 * fade)] : [16, 185, 129, Math.round(140 * fade)]
      },
      stroked: true,
      filled: false,
      lineWidthMinPixels: 2,
      updateTriggers: { getRadius: [pulsePhase], getLineColor: [pulsePhase] },
    })

    const alertingCam = cameras.find((c) => c.alerting)
    const reticleLayer = new LineLayer({
      id: 'target-reticle',
      data: alertingCam ? reticleBracketSegments(alertingCam.site.lat, alertingCam.site.lng, RETICLE_RANGE_M, (pulsePhase / 100) * 360) : [],
      getSourcePosition: (d: [number, number][]) => d[0],
      getTargetPosition: (d: [number, number][]) => d[1],
      getColor: [255, 255, 255, 230],
      getWidth: 2.5,
    })

    const gridLayer = new LineLayer({
      id: 'tactical-grid',
      data: showGrid ? tacticalGridLines() : [],
      getSourcePosition: (d) => d.from,
      getTargetPosition: (d) => d.to,
      getColor: [34, 211, 238, 35],
      getWidth: 1,
    })

    // NAIs — analyst-curated intelligence markers, deliberately amber/muted
    // and visually distinct from live camera markers so nobody mistakes
    // "a person flagged this" for "a sensor detected this".
    const poiLayer = new ScatterplotLayer({
      id: 'poi-markers',
      data: pois,
      getPosition: (d) => [d.lng, d.lat],
      getRadius: 500,
      getFillColor: [245, 158, 11, 200],
      getLineColor: [120, 53, 15, 255],
      lineWidthMinPixels: 2,
      stroked: true,
      pickable: true,
      radiusMinPixels: 6,
      onClick: (info) => {
        const d = info.object as PointOfInterest | undefined
        if (d) setSelectedPOI(d)
      },
    })

    const poiLabelLayer = new TextLayer({
      id: 'poi-labels',
      data: pois,
      getPosition: (d) => [d.lng, d.lat],
      getText: (d) => d.name,
      getSize: 11,
      getColor: [252, 211, 77, 230],
      getPixelOffset: [0, -16],
      fontFamily: 'monospace',
      fontSettings: { sdf: true },
      outlineWidth: 2,
      outlineColor: [10, 10, 10, 255],
    })

    overlayRef.current.setProps({ layers: [gridLayer, heatLayer, coneLayer, ringLayer, markerLayer, poiLayer, poiLabelLayer, reticleLayer] })
  }, [cameras, events, pois, pulsePhase, showGrid])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-800 bg-[#05070c]">
      <div ref={containerRef} className={`h-full w-full ${markingMode ? 'cursor-crosshair' : ''}`} />

      <div className="absolute left-4 top-16 z-10 flex flex-col gap-1.5">
        <button
          onClick={() => setShowGrid((v) => !v)}
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm ${
            showGrid ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300' : 'border-zinc-700 bg-zinc-950/80 text-zinc-400'
          }`}
        >
          <LayoutGrid size={12} /> Tactical grid
        </button>
        <button
          onClick={() => setShowSatellite((v) => !v)}
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm ${
            showSatellite ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300' : 'border-zinc-700 bg-zinc-950/80 text-zinc-400'
          }`}
        >
          <Satellite size={12} /> Satellite
        </button>
        <button
          onClick={() => {
            setMarkingMode((v) => !v)
            setPendingPoint(null)
          }}
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm ${
            markingMode ? 'border-amber-500/60 bg-amber-500/15 text-amber-300' : 'border-zinc-700 bg-zinc-950/80 text-zinc-400'
          }`}
        >
          <MapPinPlus size={12} /> {markingMode ? 'Click map to mark…' : 'Mark intel point (NAI)'}
        </button>
      </div>

      {pendingPoint && <POIForm point={pendingPoint} onCancel={() => setPendingPoint(null)} onSubmit={submitPOI} />}

      {selected && (
        <div className="absolute right-4 top-4 z-10 w-64 rounded-lg border border-zinc-700 bg-zinc-950/90 p-3 text-xs shadow-lg backdrop-blur-sm">
          <button className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300" onClick={() => setSelected(null)}>
            ×
          </button>
          <div className="font-semibold text-zinc-100">{selected.camera_id}</div>
          <div className="text-zinc-500">{selected.label}</div>
          <div
            className={`mt-1.5 uppercase tracking-wider ${
              selected.alerting ? 'text-red-400' : selected.status === 'live' ? 'text-emerald-400' : selected.status === 'armed' ? 'text-amber-400' : 'text-zinc-500'
            }`}
          >
            {selected.alerting ? 'ALERT — high-confidence event active' : selected.status === 'live' ? 'LIVE — streaming now' : selected.status === 'armed' ? 'ARMED — dormant, has history' : 'NOT YET MONITORED'}
          </div>
        </div>
      )}

      {selectedPOI && (
        <div className="absolute right-4 top-4 z-10 w-72 rounded-lg border border-amber-800/60 bg-zinc-950/90 p-3 text-xs shadow-lg backdrop-blur-sm">
          <button className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300" onClick={() => setSelectedPOI(null)}>
            <X size={13} />
          </button>
          <div className="font-semibold text-amber-300">{selectedPOI.name}</div>
          <div className="mt-1 text-zinc-400">{POI_CATEGORY_LABELS[selectedPOI.category]}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-600">Source: {POI_SOURCE_LABELS[selectedPOI.source]}</div>
          {selectedPOI.notes && <div className="mt-2 rounded bg-zinc-900/60 p-2 text-zinc-400">{selectedPOI.notes}</div>}
          <div className="mt-2 text-[10px] text-zinc-600">
            Analyst-marked {new Date(selectedPOI.created_at + 'Z').toLocaleString()} — not a sensor detection
          </div>
          <button
            onClick={() => removePOI(selectedPOI.id)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-red-800/50 bg-red-500/10 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-400 hover:bg-red-500/20"
          >
            <Trash2 size={11} /> Remove marking
          </button>
        </div>
      )}

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-600">Initializing tactical map…</div>
      )}
    </div>
  )
}

function POIForm({
  point,
  onCancel,
  onSubmit,
}: {
  point: { lat: number; lng: number }
  onCancel: () => void
  onSubmit: (form: { name: string; category: PointOfInterest['category']; source: PointOfInterest['source']; notes: string }) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<PointOfInterest['category']>('suspected_staging_point')
  const [source, setSource] = useState<PointOfInterest['source']>('unverified')
  const [notes, setNotes] = useState('')

  return (
    <div className="absolute left-1/2 top-1/2 z-20 w-80 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-amber-700/60 bg-zinc-950/95 p-4 text-xs shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold uppercase tracking-wider text-amber-300">Mark intelligence point</span>
        <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300">
          <X size={14} />
        </button>
      </div>
      <div className="mb-3 font-mono text-[10px] text-zinc-500">
        {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
      </div>

      <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Riverside staging point"
        className="mb-2 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200 focus:border-amber-600 focus:outline-none"
      />

      <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Category</label>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as PointOfInterest['category'])}
        className="mb-2 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200 focus:outline-none"
      >
        {Object.entries(POI_CATEGORY_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Source</label>
      <select
        value={source}
        onChange={(e) => setSource(e.target.value as PointOfInterest['source'])}
        className="mb-2 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200 focus:outline-none"
      >
        {Object.entries(POI_SOURCE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Notes (optional)</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="mb-3 w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200 focus:border-amber-600 focus:outline-none"
      />

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-400 hover:bg-zinc-800">
          Cancel
        </button>
        <button
          onClick={() => name.trim() && onSubmit({ name: name.trim(), category, source, notes })}
          disabled={!name.trim()}
          className="flex-1 rounded-md border border-amber-600/60 bg-amber-500/15 px-2 py-1.5 font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-40"
        >
          Save marking
        </button>
      </div>
    </div>
  )
}
