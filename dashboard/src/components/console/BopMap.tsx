import { useMemo } from 'react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { siteFor } from '@/lib/cameraSites'
import type { IbvapEvent } from '@/types'

const TIER_RANK = { high: 3, medium: 2, low: 1 } as const
const TIER_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' } as const

// Plain OpenStreetMap tiles — never require an API key. CARTO's dark-tile
// endpoint does now (shows an "API KEY REQUIRED" watermark without one),
// so the dark theme is faked with a CSS filter on the tile layer instead.
const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

/**
 * Real spatial view: every camera that has actually logged an event this
 * session gets plotted at its real-world site coordinates (reference doc
 * Section 17.1's documented locations), colored by the highest-tier alert
 * it has produced. Correlation matches draw an actual line between the two
 * cameras involved — the geography the correlation banner's text describes.
 */
export function BopMap({ events }: { events: IbvapEvent[] }) {
  const cameras = useMemo(() => {
    const byCamera = new Map<string, IbvapEvent[]>()
    for (const e of events) {
      if (!byCamera.has(e.camera_id)) byCamera.set(e.camera_id, [])
      byCamera.get(e.camera_id)!.push(e)
    }
    return Array.from(byCamera.entries()).map(([camera_id, evs]) => {
      const highestTier = evs.reduce<'low' | 'medium' | 'high'>(
        (acc, e) => (TIER_RANK[e.confidence_tier] > TIER_RANK[acc] ? e.confidence_tier : acc),
        'low',
      )
      return { camera_id, count: evs.length, highestTier, site: siteFor(camera_id) }
    })
  }, [events])

  const correlationLines = useMemo(() => {
    const matches = events.filter((e) => e.event_type === 'correlation_match' && e.detail)
    return matches
      .map((m) => {
        const fromMatch = m.detail?.match(/after ([\w-]+)/)
        if (!fromMatch) return null
        const from = siteFor(fromMatch[1])
        const to = siteFor(m.camera_id)
        return { id: m.id, from, to }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [events])

  if (cameras.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-500">No camera activity logged yet.</div>
  }

  const center: [number, number] = [cameras[0].site.lat, cameras[0].site.lng]

  return (
    <MapContainer center={center} zoom={7} className="tactical-map h-full w-full" style={{ background: '#0a0c10' }}>
      <TileLayer url={OSM_TILES} attribution="&copy; OpenStreetMap contributors" />
      {correlationLines.map((line) => (
        <Polyline
          key={line.id}
          positions={[
            [line.from.lat, line.from.lng],
            [line.to.lat, line.to.lng],
          ]}
          pathOptions={{ color: '#f59e0b', weight: 2, dashArray: '6 6' }}
        />
      ))}
      {cameras.map((cam) => (
        <CircleMarker
          key={cam.camera_id}
          center={[cam.site.lat, cam.site.lng]}
          radius={10}
          pathOptions={{ color: TIER_COLOR[cam.highestTier], fillColor: TIER_COLOR[cam.highestTier], fillOpacity: 0.6, weight: 2 }}
        >
          <Popup>
            <div className="text-xs">
              <div className="font-semibold">{cam.camera_id}</div>
              <div>{cam.site.label}</div>
              <div>
                {cam.count} event{cam.count === 1 ? '' : 's'} · highest tier: {cam.highestTier}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
