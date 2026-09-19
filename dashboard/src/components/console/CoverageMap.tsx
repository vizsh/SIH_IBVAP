import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet.heat'
import { MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { API_BASE } from '@/lib/api'
import { CAMERA_SITES, fovConePoints, siteFor } from '@/lib/cameraSites'
import type { IbvapEvent } from '@/types'

// CARTO's dark-tile endpoint now gates behind an API key (shows a watermark
// without one) — plain OpenStreetMap tiles need no key at all and never
// will, so we use those and fake the dark theme with a CSS filter instead.
const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const LIVE_THRESHOLD_SECONDS = 6 // telemetry pushes every ~1s from a running pipeline
const ALERT_WINDOW_SECONDS = 25 // how long a camera's cone stays red after a high-tier event
const CONE_RANGE_M = 22000

type CameraStatus = 'live' | 'armed' | 'unmonitored'

function radarIcon(color: string, pulsing: boolean, alerting: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="radar-marker ${alerting ? 'radar-marker--alert' : ''}" style="--radar-color:${color}">
      ${pulsing ? '<div class="radar-marker__ring"></div>' : ''}
      <div class="radar-marker__dot"></div>
    </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

/** Real event-density heatmap: each event contributes a point jittered
 * around its camera's real coordinates (events carry a camera_id, not a
 * per-event GPS fix), weighted by confidence tier so high-tier clusters
 * actually read hotter than low-tier background noise. */
function HeatmapLayer({ events }: { events: IbvapEvent[] }) {
  const map = useMap()
  const layerRef = useRef<L.Layer | null>(null)

  useEffect(() => {
    const points: Array<[number, number, number]> = events.map((e) => {
      const site = siteFor(e.camera_id)
      // deterministic jitter from event id, not Math.random(), so the
      // layer doesn't visually reshuffle itself on every re-render
      const angle = (e.id * 137.5) % 360
      const jitterM = 400 + (e.id % 9) * 500
      const rad = (angle * Math.PI) / 180
      const dLat = (jitterM * Math.cos(rad)) / 111320
      const dLng = (jitterM * Math.sin(rad)) / (111320 * Math.cos((site.lat * Math.PI) / 180))
      const weight = e.confidence_tier === 'high' ? 1 : e.confidence_tier === 'medium' ? 0.55 : 0.25
      return [site.lat + dLat, site.lng + dLng, weight]
    })

    const layer = L.heatLayer(points, { radius: 28, blur: 22, maxZoom: 10, minOpacity: 0.25 })
    layer.addTo(map)
    layerRef.current = layer
    return () => {
      layer.remove()
    }
  }, [map, events])

  return null
}

/** Flies the map to the most recent high-tier alert's camera the moment it
 * arrives, so a fresh escalation actually pulls the operator's eye instead
 * of sitting silently in a list. */
function AlertFlyTo({ events }: { events: IbvapEvent[] }) {
  const map = useMap()
  const lastHandledId = useRef<number | null>(null)

  useEffect(() => {
    const latestHigh = events.find((e) => e.confidence_tier === 'high')
    if (!latestHigh || latestHigh.id === lastHandledId.current) return
    lastHandledId.current = latestHigh.id
    const site = siteFor(latestHigh.camera_id)
    map.flyTo([site.lat, site.lng], Math.max(map.getZoom(), 9), { duration: 1.4 })
  }, [events, map])

  return null
}

export function CoverageMap() {
  const [telemetry, setTelemetry] = useState<Record<string, { received_at: number }>>({})
  const [events, setEvents] = useState<IbvapEvent[]>([])

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

  const cameras = useMemo(() => {
    const seen = new Set<string>([...Object.keys(CAMERA_SITES), ...events.map((e) => e.camera_id)])
    const now = Date.now() / 1000
    return Array.from(seen).map((camera_id) => {
      const t = telemetry[camera_id]
      const hasHistory = events.some((e) => e.camera_id === camera_id)
      let status: CameraStatus = 'unmonitored'
      if (t && now - t.received_at < LIVE_THRESHOLD_SECONDS) status = 'live'
      else if (hasHistory) status = 'armed'

      const nowMs = Date.now()
      const alerting = events.some(
        (e) =>
          e.camera_id === camera_id &&
          e.confidence_tier === 'high' &&
          nowMs - new Date(e.created_at + 'Z').getTime() < ALERT_WINDOW_SECONDS * 1000,
      )

      return { camera_id, status, alerting, site: siteFor(camera_id), eventCount: events.filter((e) => e.camera_id === camera_id).length }
    })
  }, [events, telemetry])

  const center: [number, number] = [26.8, 86.5]

  return (
    <MapContainer center={center} zoom={7} className="tactical-map h-full w-full" style={{ background: '#0a0c10' }}>
      <TileLayer url={OSM_TILES} attribution="&copy; OpenStreetMap contributors" />
      <HeatmapLayer events={events} />
      <AlertFlyTo events={events} />
      {cameras.map((cam) => {
        const color = cam.alerting ? '#ef4444' : cam.status === 'live' ? '#10b981' : cam.status === 'armed' ? '#f59e0b' : '#52525b'
        return (
          <div key={cam.camera_id}>
            {cam.status !== 'unmonitored' && (
              <Polygon
                positions={fovConePoints(cam.site, CONE_RANGE_M)}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: cam.alerting ? 0.22 : 0.08,
                  weight: cam.alerting ? 2 : 1,
                  dashArray: cam.alerting ? undefined : '4 6',
                }}
              />
            )}
            <Marker position={[cam.site.lat, cam.site.lng]} icon={radarIcon(color, cam.status === 'live' || cam.alerting, cam.alerting)}>
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold">{cam.camera_id}</div>
                  <div>{cam.site.label}</div>
                  <div className="mt-1 uppercase tracking-wider" style={{ color }}>
                    {cam.alerting
                      ? 'ALERT — high-confidence event active'
                      : cam.status === 'live'
                        ? 'LIVE — streaming now'
                        : cam.status === 'armed'
                          ? 'ARMED — dormant, has history'
                          : 'NOT YET MONITORED'}
                  </div>
                  {cam.eventCount > 0 && <div>{cam.eventCount} events logged</div>}
                </div>
              </Popup>
            </Marker>
          </div>
        )
      })}
    </MapContainer>
  )
}
