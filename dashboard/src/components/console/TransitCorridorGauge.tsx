import { Clock, Route } from 'lucide-react'
import type { IbvapEvent } from '@/types'

function formatMinutes(min: number): string {
  if (min < 1) return `${Math.round(min * 60)}s`
  if (min < 90) return `${min.toFixed(0)}m`
  return `${(min / 60).toFixed(1)}h`
}

/**
 * Predictive Travel Window Gauge (Feature 3): real haversine distance
 * between the two actual sites, converted to a min/max transit time via a
 * plausible speed range (backend/app/camera_sites.py) — not a cosmetic
 * "12-18 min" placeholder. Our three demo sites are genuinely 100-300km
 * apart, so the real window is hours; a demo run replays both sightings
 * within seconds. Rather than fake a small window to make the numbers
 * "feel right", this shows the real math and states the compression
 * honestly — the platform's honesty pattern applied to its own demo.
 */
export function TransitCorridorGauge({ event }: { event: IbvapEvent }) {
  if (event.distance_km == null || event.travel_min_minutes == null || event.travel_max_minutes == null || event.elapsed_minutes == null) {
    return null
  }

  const withinWindow = event.elapsed_minutes >= event.travel_min_minutes && event.elapsed_minutes <= event.travel_max_minutes
  const tooFast = event.elapsed_minutes < event.travel_min_minutes * 0.5
  const statusLabel = withinWindow ? 'Within expected window' : tooFast ? 'Demo-compressed timing' : 'Later than expected route time'
  const statusColor = withinWindow ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : tooFast ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'

  return (
    <div className="mt-2 space-y-1.5 rounded-md border border-zinc-800/60 bg-black/30 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
        <Route size={11} className="text-cyan-500" />
        Real distance: <span className="font-mono text-zinc-300">{event.distance_km.toFixed(0)} km</span>
        <span className="text-zinc-700">·</span>
        Predicted transit (30–70 km/h):{' '}
        <span className="font-mono text-zinc-300">
          {formatMinutes(event.travel_min_minutes)}–{formatMinutes(event.travel_max_minutes)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
        <Clock size={11} className="text-cyan-500" />
        Actual elapsed: <span className="font-mono text-zinc-300">{formatMinutes(event.elapsed_minutes)}</span>
        <span className={`ml-auto rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
      {tooFast && (
        <div className="text-[9px] text-zinc-600">
          This demo replays both sightings within seconds; the distance and window above are the real numbers for these two sites, not scaled for demo pacing.
        </div>
      )}
    </div>
  )
}
