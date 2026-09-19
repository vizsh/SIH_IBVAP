import { motion } from 'framer-motion'
import { EyeOff, Radio, Users } from 'lucide-react'
import { GlowingEffect } from '@/components/glowing-effect'
import type { IbvapEvent } from '@/types'

/**
 * Confidence-Gated Escalation Matrix (Feature 4): the routing pipeline made
 * visible, with real counts, not just a static diagram. Every number here
 * is a live filter over the same events array the alert queue renders.
 */
export function EscalationPipeline({ events }: { events: IbvapEvent[] }) {
  const high = events.filter((e) => e.confidence_tier === 'high')
  const medium = events.filter((e) => e.confidence_tier === 'medium')
  const low = events.filter((e) => e.confidence_tier === 'low')
  const pendingMedium = medium.filter((e) => e.status === 'pending').length

  const lanes = [
    {
      key: 'high',
      icon: Radio,
      label: 'TIER 1 — HIGH (>85%)',
      color: '#ef4444',
      count: high.length,
      description: 'Auto-alerts dispatched to duty officer',
    },
    {
      key: 'medium',
      icon: Users,
      label: 'TIER 2 — MEDIUM (55–85%)',
      color: '#f59e0b',
      count: medium.length,
      description: `Human review queue — ${pendingMedium} pending confirmation`,
    },
    {
      key: 'low',
      icon: EyeOff,
      label: 'TIER 3 — LOW (<55%)',
      color: '#10b981',
      count: low.length,
      description: 'Silent log — saved to tamper-evident storage',
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {lanes.map((lane) => (
        <div key={lane.key} className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <GlowingEffect disabled={false} glow proximity={60} spread={22} borderWidth={1.5} />
          <div className="relative z-10 flex items-center gap-2">
            <lane.icon size={14} style={{ color: lane.color }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{lane.label}</span>
          </div>
          <motion.div
            key={lane.count}
            initial={{ scale: 1.3, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative z-10 mt-1 font-mono text-2xl font-bold"
            style={{ color: lane.color }}
          >
            {lane.count}
          </motion.div>
          <div className="relative z-10 mt-0.5 text-[10px] text-zinc-500">{lane.description}</div>
        </div>
      ))}
    </div>
  )
}
