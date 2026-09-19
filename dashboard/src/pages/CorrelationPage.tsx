import { useEffect, useState } from 'react'
import { Radar, Zap } from 'lucide-react'
import { VideoPane } from '@/components/VideoPane'
import { BopMap } from '@/components/console/BopMap'
import { CorrelationDemoTrigger } from '@/components/console/CorrelationBanner'
import { TransitCorridorGauge } from '@/components/console/TransitCorridorGauge'
import { GlowingEffect } from '@/components/glowing-effect'
import { API_BASE } from '@/lib/api'
import type { IbvapEvent } from '@/types'

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso + 'Z').getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

export default function CorrelationPage() {
  const [allEvents, setAllEvents] = useState<IbvapEvent[]>([])
  const matches = allEvents.filter((e) => e.event_type === 'correlation_match')

  useEffect(() => {
    fetch(`${API_BASE}/events?limit=500`)
      .then((r) => r.json())
      .then(setAllEvents)
      .catch(() => {})
  }, [])

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-zinc-100">Cross-BOP Pattern Correlation</h1>
        <p className="mt-1 text-xs text-zinc-500">
          No new hardware — a shared event database keyed by plate text and timestamp. When the same plate is
          read by two different cameras, it's flagged automatically with a real distance-based transit-time
          prediction (see <code className="rounded bg-zinc-800 px-1 py-0.5">backend/app/correlation.py</code>).
        </p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="h-[260px]">
          <VideoPane cameraId="BOP-Alpha" />
        </div>
        <div className="h-[260px]">
          <VideoPane cameraId="BOP-Bravo" />
        </div>
      </div>

      <div className="mb-4 h-[300px] overflow-hidden rounded-xl border border-zinc-800">
        <BopMap events={allEvents} />
      </div>

      <div className="mb-4 rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4 text-xs text-zinc-500">
        To generate a real match: run two edge pipeline processes with different{' '}
        <code className="rounded bg-zinc-800 px-1 py-0.5">--camera-id</code> / <code className="rounded bg-zinc-800 px-1 py-0.5">--stream-port</code> values
        (BOP-Alpha on 8092, BOP-Bravo on 8093) against footage containing the same vehicle, per the doc's own
        "virtual BOPs on one laptop" suggestion (Q23). Every real match below came from that exact mechanism —
        none are seeded.
      </div>

      <div className="space-y-2">
        {matches.map((m) => (
          <div key={m.id} className="relative rounded-lg border border-amber-500/30 bg-zinc-950/60 p-3">
            <GlowingEffect disabled={false} glow proximity={70} spread={28} borderWidth={2} />
            <div className="relative z-10 flex items-start gap-3">
              <Zap size={16} className="mt-0.5 shrink-0 text-amber-400" />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-sm font-semibold text-cyan-300">{m.plate_text}</div>
                <div className="text-xs text-zinc-400">{m.detail}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-600">{timeAgo(m.created_at)}</div>
                <TransitCorridorGauge event={m} />
              </div>
            </div>
          </div>
        ))}

        {matches.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 px-8 py-16 text-center">
            <Radar size={36} className="mb-4 text-cyan-500/60" strokeWidth={1.2} />
            <p className="max-w-md text-sm text-zinc-500">
              No real correlation matches yet — none have been seeded. Run two edge processes against footage
              of the same vehicle to see a genuine match land here and flash the banner.
            </p>
            <div className="mt-6">
              <CorrelationDemoTrigger />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
