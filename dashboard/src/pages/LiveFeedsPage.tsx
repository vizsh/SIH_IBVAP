import { useEffect, useState } from 'react'
import { Camera } from 'lucide-react'
import { EvidenceThumbnail } from '@/components/console/EvidenceThumbnail'
import { VideoPane } from '@/components/VideoPane'
import { GlowingEffect } from '@/components/glowing-effect'
import { API_BASE } from '@/lib/api'
import type { IbvapEvent } from '@/types'

const EVENT_LABELS: Record<string, string> = {
  virtual_fence_intrusion: 'Virtual-fence intrusion',
  loitering: 'Loitering',
  vehicle_detected: 'Vehicle detected',
  person_detected: 'Person detected',
  anpr_read: 'ANPR read',
  correlation_match: 'Cross-BOP correlation',
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso + 'Z').getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

export default function LiveFeedsPage() {
  const [cameras, setCameras] = useState<string[]>(['BOP-01'])
  const [evidence, setEvidence] = useState<IbvapEvent[]>([])

  useEffect(() => {
    fetch(`${API_BASE}/events?limit=200`)
      .then((r) => r.json())
      .then((events: IbvapEvent[]) => {
        setCameras((prev) => Array.from(new Set([...prev, ...events.map((e) => e.camera_id)])))
        setEvidence(events.filter((e) => e.evidence_url).slice(0, 16))
      })
      .catch(() => {})
  }, [])

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-zinc-100">Live Feeds &amp; Tactical HUD</h1>
        <p className="mt-1 text-xs text-zinc-500">Primary live camera plus every real evidence snapshot captured this session — actual pipeline output, not staged.</p>
      </header>

      <div className="mb-6 h-[420px]">
        <VideoPane cameraId="BOP-01" />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Camera size={14} className="text-cyan-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Known cameras this session</span>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {cameras.map((c) => (
          <span key={c} className="rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400">
            {c}
          </span>
        ))}
      </div>

      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Recent evidence</div>
      {evidence.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 p-8 text-center text-sm text-zinc-500">
          No evidence snapshots yet — they're captured automatically the moment a real alert fires.
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {evidence.map((e) => (
            <div key={e.id} className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60">
              <GlowingEffect disabled={false} glow proximity={60} spread={22} borderWidth={1.5} />
              <EvidenceThumbnail url={e.evidence_url} className="h-28 w-full" />
              <div className="relative z-10 p-2">
                <div className="truncate text-xs font-medium text-zinc-200">{EVENT_LABELS[e.event_type] ?? e.event_type}</div>
                <div className="text-[10px] text-zinc-500">
                  {e.camera_id} · {timeAgo(e.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
