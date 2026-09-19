import clsx from 'clsx'
import type { ConfidenceTier } from '../types'

// Tier mapping follows the tactical console spec: high = crimson (auto-escalated),
// medium = amber (queued for BOP commander review), low = emerald (verified/logged clear).
const TIER_STYLES: Record<ConfidenceTier, string> = {
  high: 'bg-red-500/15 text-red-400 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.25)]',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]',
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
}

export function TierPill({ tier }: { tier: ConfidenceTier }) {
  return (
    <span className={clsx('rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider', TIER_STYLES[tier])}>
      {tier}
    </span>
  )
}
