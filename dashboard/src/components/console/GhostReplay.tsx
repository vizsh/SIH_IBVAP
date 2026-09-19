import { useMemo, useState } from 'react'
import { Rewind, X } from 'lucide-react'
import type { IbvapEvent } from '@/types'

/**
 * "Shadow Ghost Replay" — scrub backward through a track's own recorded
 * frame-space positions leading up to the alert that fired. Deliberately
 * drawn on the camera view itself, not a geo map: these are real pixel
 * coordinates from the edge pipeline's own centroid history, and no camera
 * here is calibrated to convert that into a real-world geo path, so this
 * stays honest about what it actually is — a real recorded trail, in the
 * only coordinate space that's actually real.
 */
export function GhostReplay({ event, onClose }: { event: IbvapEvent; onClose: () => void }) {
  const trail = event.trail ?? []
  const duration = trail.length > 1 ? trail[trail.length - 1].t - trail[0].t : 0
  const [scrubSeconds, setScrubSeconds] = useState(0)

  const { visiblePoints, ghostPoint } = useMemo(() => {
    if (trail.length === 0) return { visiblePoints: [], ghostPoint: null }
    const latestT = trail[trail.length - 1].t
    const targetT = latestT - scrubSeconds
    let closest = trail[0]
    const visible: typeof trail = []
    for (const p of trail) {
      if (p.t <= targetT) {
        visible.push(p)
        closest = p
      }
    }
    return { visiblePoints: visible, ghostPoint: closest }
  }, [trail, scrubSeconds])

  if (trail.length < 2) return null

  const pathD = visiblePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x * 100},${p.y * 100}`).join(' ')

  return (
    <div className="absolute inset-0 z-30">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={pathD} fill="none" stroke="#a78bfa" strokeWidth="0.5" strokeDasharray="1.5,1" opacity={0.8} />
        {ghostPoint && (
          <g>
            <circle cx={ghostPoint.x * 100} cy={ghostPoint.y * 100} r="2.2" fill="none" stroke="#a78bfa" strokeWidth="0.5" opacity={0.5} />
            <circle cx={ghostPoint.x * 100} cy={ghostPoint.y * 100} r="1" fill="#c4b5fd" />
          </g>
        )}
      </svg>

      <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-violet-700/50 bg-zinc-950/90 p-2.5 backdrop-blur-sm">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-violet-300">
          <span className="flex items-center gap-1.5">
            <Rewind size={12} /> Shadow ghost replay — track #{event.track_id ?? '—'}
          </span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={13} />
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(duration))}
          value={scrubSeconds}
          onChange={(e) => setScrubSeconds(Number(e.target.value))}
          className="w-full accent-violet-400"
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-zinc-500">
          <span>REWIND: -{Math.floor(scrubSeconds / 60)}:{String(Math.round(scrubSeconds % 60)).padStart(2, '0')}</span>
          <span>{trail.length} recorded positions, {duration.toFixed(0)}s window</span>
        </div>
      </div>
    </div>
  )
}
