import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { CameraStatusGrid } from '@/components/console/CameraStatusGrid'
import { ThreatLevelGauge } from '@/components/console/ThreatLevelGauge'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { API_BASE } from '@/lib/api'
import type { IbvapEvent } from '@/types'

const EVENT_LABELS: Record<string, string> = {
  virtual_fence_intrusion: 'Virtual fence',
  loitering: 'Loitering',
  vehicle_detected: 'Vehicle',
  person_detected: 'Person',
  anpr_read: 'ANPR',
  correlation_match: 'Correlation',
}

const typeChartConfig: ChartConfig = {
  count: { label: 'Events', color: '#22d3ee' },
}

export default function AnalyticsPage() {
  const [events, setEvents] = useState<IbvapEvent[]>([])

  useEffect(() => {
    fetch(`${API_BASE}/events?limit=500`)
      .then((r) => r.json())
      .then(setEvents)
      .catch(() => {})
  }, [])

  const byType = Object.entries(
    events.reduce<Record<string, number>>((acc, e) => {
      acc[e.event_type] = (acc[e.event_type] ?? 0) + 1
      return acc
    }, {}),
  ).map(([type, count]) => ({ type: EVENT_LABELS[type] ?? type, count }))

  const highCount = events.filter((e) => e.confidence_tier === 'high').length

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-zinc-100">Analytics &amp; System Health</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Live aggregation over {events.length} logged events — false-positive rate tracked as a first-class metric, not an afterthought.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">System threat level</div>
          <ThreatLevelGauge high={highCount} total={events.length} />
        </div>

        <div className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Events by type</div>
          <ChartContainer config={typeChartConfig} className="aspect-auto h-[260px] w-full">
            <BarChart data={byType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="type" tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Per-camera status</div>
        <CameraStatusGrid events={events} />
      </div>

      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/80">
        Night-time detection and behavioural-recognition accuracy panels are Phase 2 (require field data / IR hardware) —
        shown here only once real calibration data exists, per the platform's own confidence-gating principle.
      </div>
    </div>
  )
}
