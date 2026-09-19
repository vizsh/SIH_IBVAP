import { GlowingEffect } from '@/components/glowing-effect'
import { EvidenceThumbnail } from '@/components/console/EvidenceThumbnail'
import type { IbvapEvent } from '@/types'

const TIER_RANK = { high: 3, medium: 2, low: 1 } as const
const TIER_COLOR = { high: 'text-red-400 border-red-500/30', medium: 'text-amber-400 border-amber-500/30', low: 'text-emerald-400 border-emerald-500/30' }

export function CameraStatusGrid({ events }: { events: IbvapEvent[] }) {
  const byCamera = new Map<string, IbvapEvent[]>()
  for (const e of events) {
    if (!byCamera.has(e.camera_id)) byCamera.set(e.camera_id, [])
    byCamera.get(e.camera_id)!.push(e)
  }

  const cameras = Array.from(byCamera.entries()).map(([camera_id, evs]) => {
    const highestTier = evs.reduce<'low' | 'medium' | 'high'>(
      (acc, e) => (TIER_RANK[e.confidence_tier] > TIER_RANK[acc] ? e.confidence_tier : acc),
      'low',
    )
    const latestWithEvidence = evs.find((e) => e.evidence_url) ?? evs[0]
    return { camera_id, count: evs.length, highestTier, latest: latestWithEvidence }
  })

  if (cameras.length === 0) {
    return <div className="p-4 text-sm text-zinc-500">No camera activity logged yet.</div>
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cameras.map((cam) => (
        <div key={cam.camera_id} className={`relative overflow-hidden rounded-lg border bg-zinc-950/60 ${TIER_COLOR[cam.highestTier]}`}>
          <GlowingEffect disabled={false} glow proximity={60} spread={22} borderWidth={1.5} />
          <EvidenceThumbnail url={cam.latest.evidence_url} className="h-20 w-full" />
          <div className="relative z-10 p-2.5">
            <div className="text-sm font-semibold text-zinc-100">{cam.camera_id}</div>
            <div className="text-xs text-zinc-500">
              {cam.count} event{cam.count === 1 ? '' : 's'} · highest:{' '}
              <span className={TIER_COLOR[cam.highestTier].split(' ')[0]}>{cam.highestTier}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
