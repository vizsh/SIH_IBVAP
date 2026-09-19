import type { ConfidenceTier } from '@/types'

/**
 * Segmented confidence gauge (Feature 4): a horizontal bar showing exactly
 * where a reading falls relative to the platform's real tier thresholds
 * (backend/app/confidence.py: 0.55, 0.85) — not a decorative progress bar,
 * the actual routing decision boundary made visible.
 */
export function ConfidenceGauge({ confidence, tier }: { confidence: number; tier: ConfidenceTier }) {
  const pct = Math.round(confidence * 100)
  const color = tier === 'high' ? '#ef4444' : tier === 'medium' ? '#f59e0b' : '#10b981'

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
        <span>
          Confidence: <span style={{ color }} className="font-mono font-semibold">{pct}%</span> ({tier})
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        {/* threshold ticks at the real 55% / 85% routing boundaries */}
        <div className="absolute inset-y-0 left-[55%] w-px bg-zinc-600" />
        <div className="absolute inset-y-0 left-[85%] w-px bg-zinc-600" />
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
    </div>
  )
}
