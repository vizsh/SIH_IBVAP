import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { API_BASE } from '@/lib/api'
import { CAMERA_SITES, siteFor } from '@/lib/cameraSites'
import type { IbvapEvent } from '@/types'

// CARTO's dark-tile endpoint now gates behind an API key (shows a watermark
// without one) — plain OpenStreetMap tiles need no key at all and never
// will, so we use those and fake the dark theme with a CSS filter instead.
const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const LIVE_THRESHOLD_SECONDS = 6 // telemetry pushes every ~1s from a running pipeline

type CameraStatus = 'live' | 'armed' | 'unmonitored'

function radarIcon(color: string, pulsing: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="radar-marker" style="--radar-color:${color}">
      ${pulsing ? '<div class="radar-marker__ring"></div>' : ''}
      <div class="radar-marker__dot"></div>
    </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
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
      return { camera_id, status, site: siteFor(camera_id), eventCount: events.filter((e) => e.camera_id === camera_id).length }
    })
  }, [telemetry, events])

  const center: [number, number] = [26.8, 86.5]

  return (
    <MapContainer center={center} zoom={7} className="tactical-map h-full w-full" style={{ background: '#0a0c10' }}>
      <TileLayer url={OSM_TILES} attribution="&copy; OpenStreetMap contributors" />
      {cameras.map((cam) => {
        const color = cam.status === 'live' ? '#10b981' : cam.status === 'armed' ? '#f59e0b' : '#52525b'
        return (
          <div key={cam.camera_id}>
            {cam.status !== 'unmonitored' && (
              <Circle
                center={[cam.site.lat, cam.site.lng]}
                radius={18000}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.06, weight: 1, dashArray: '4 6' }}
              />
            )}
            <Marker position={[cam.site.lat, cam.site.lng]} icon={radarIcon(color, cam.status === 'live')}>
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold">{cam.camera_id}</div>
                  <div>{cam.site.label}</div>
                  <div className="mt-1 uppercase tracking-wider" style={{ color }}>
                    {cam.status === 'live' ? 'LIVE — streaming now' : cam.status === 'armed' ? 'ARMED — dormant, has history' : 'NOT YET MONITORED'}
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
