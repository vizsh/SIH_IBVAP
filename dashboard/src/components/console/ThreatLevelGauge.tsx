import CountUp from '@/components/CountUp'

const RADIUS = 70
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Replaces a generic confidence-tier pie chart with a single, bold signal:
 * what fraction of everything logged this session was high-confidence
 * (auto-escalated). A ring + big number reads instantly at a glance —
 * a donut chart legend does not.
 */
export function ThreatLevelGauge({ high, total }: { high: number; total: number }) {
  const pct = total > 0 ? (high / total) * 100 : 0
  const offset = CIRCUMFERENCE * (1 - pct / 100)
  const color = pct >= 50 ? '#ef4444' : pct >= 20 ? '#f59e0b' : '#10b981'

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative">
        <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
          <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="#27272a" strokeWidth="10" />
          <circle
            cx="90"
            cy="90"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.8s', filter: `drop-shadow(0 0 6px ${color}aa)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-3xl font-bold text-zinc-100">
            <CountUp to={Math.round(pct)} duration={1.2} />%
          </div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">high-tier share</div>
        </div>
      </div>
      <div className="mt-3 text-xs text-zinc-500">
        <span className="font-semibold text-zinc-300">{high}</span> auto-escalated of{' '}
        <span className="font-semibold text-zinc-300">{total}</span> total events
      </div>
    </div>
  )
}
