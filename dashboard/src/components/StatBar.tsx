import { GlowingEffect } from '@/components/glowing-effect'
import type { IbvapEvent } from '../types'

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="relative flex-1 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <GlowingEffect disabled={false} glow proximity={80} spread={24} borderWidth={2} />
      <div className="relative z-10 text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`relative z-10 mt-1 text-2xl font-semibold ${accent ?? 'text-zinc-100'}`}>{value}</div>
    </div>
  )
}

export function StatBar({ events }: { events: IbvapEvent[] }) {
  const total = events.length
  const high = events.filter((e) => e.confidence_tier === 'high').length
  const pending = events.filter((e) => e.status === 'pending').length
  const cameras = new Set(events.map((e) => e.camera_id)).size

  return (
    <div className="flex gap-3">
      <StatCard label="Total events" value={total} />
      <StatCard label="High-confidence" value={high} accent="text-red-400" />
      <StatCard label="Pending review" value={pending} accent="text-amber-400" />
      <StatCard label="Active cameras" value={cameras} accent="text-emerald-400" />
    </div>
  )
}
