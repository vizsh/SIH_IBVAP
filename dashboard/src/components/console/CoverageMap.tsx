import { useEffect, useMemo, useRef, useState } from 'react'
import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import { LineLayer, PolygonLayer, ScatterplotLayer } from '@deck.gl/layers'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { Map as MapLibreMap, NavigationControl } from 'maplibre-gl'
import type { Map as MapLibreMapType } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { LayoutGrid } from 'lucide-react'
import { API_BASE } from '@/lib/api'
import { CAMERA_SITES, destinationPoint, fovConeLngLat, siteFor } from '@/lib/cameraSites'
import type { IbvapEvent } from '@/types'

// Free, keyless MapLibre-compatible vector style (OpenFreeMap) — CARTO's
// dark-tile endpoint started gating behind an API key mid-session, so this
// map never depends on a third-party key at all. Its own base colors are
// overridden below to a dark tactical palette via setPaintProperty, not a
// CSS filter hack, since MapLibre's vector layers support that natively.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const LIVE_THRESHOLD_SECONDS = 6
const ALERT_WINDOW_SECONDS = 25
const CONE_RANGE_M = 22000
const CONE_HEIGHT_M = 3500
const RETICLE_RANGE_M = 4000
const GRID_BOUNDS = { minLat: 24.5, maxLat: 28.5, minLng: 83.5, maxLng: 89.5, step: 0.5 }

type CameraStatus = 'live' | 'armed' | 'unmonitored'

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

  const [ready, setReady] = useState(false)
  const [telemetry, setTelemetry] = useState<Record<string, { received_at: number }>>({})
  const [events, setEvents] = useState<IbvapEvent[]>([])
  const [pulsePhase, setPulsePhase] = useState(0)
  const [showGrid, setShowGrid] = useState(false)
  const [selected, setSelected] = useState<{ camera_id: string; label: string; status: CameraStatus; alerting: boolean } | null>(null)

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
      const overlay = new MapboxOverlay({ layers: [] })
      map.addControl(overlay)
      overlayRef.current = overlay
      setReady(true)
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      overlayRef.current = null
    }
  }, [])

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
    }
    refresh()
    const interval = setInterval(refresh, 4000)
    return () => clearInterval(interval)
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
      getFillColor: (d) => (d.alerting ? [239, 68, 68, 60 + pulseFast * 30] : d.status === 'live' ? [6, 182, 212, 45] : [245, 158, 11, 30]),
      getLineColor: (d) => (d.alerting ? [248, 113, 113, 220] : d.status === 'live' ? [34, 211, 238, 160] : [245, 158, 11, 130]),
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
      getFillColor: (d) => (d.alerting ? [239, 68, 68, 230] : d.status === 'live' ? [16, 185, 129, 230] : d.status === 'armed' ? [245, 158, 11, 220] : [82, 82, 91, 200]),
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

    overlayRef.current.setProps({ layers: [gridLayer, heatLayer, coneLayer, ringLayer, markerLayer, reticleLayer] })
  }, [cameras, events, pulsePhase, showGrid])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-800 bg-[#05070c]">
      <div ref={containerRef} className="h-full w-full" />

      <button
        onClick={() => setShowGrid((v) => !v)}
        className={`absolute left-4 top-16 z-10 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm ${
          showGrid ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300' : 'border-zinc-700 bg-zinc-950/80 text-zinc-400'
        }`}
      >
        <LayoutGrid size={12} /> Tactical grid
      </button>

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

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-600">Initializing tactical map…</div>
      )}
    </div>
  )
}
