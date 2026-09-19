import CountUp from '@/components/CountUp'
import { cn } from '@/lib/utils'

const RADIUS = 16
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const THRESHOLD_SECONDS = 90 // reference doc Section 4: loitering alert fires past 90s dwell

/**
 * Loitering dwell-time display: T(id) = t_now - t_first_seen_in_zone,
 * visualized as a ring filling toward the 90s alert threshold. No third-party
 * radial-progress component fit (ReactBits doesn't have one; 21st.dev's are
 * marketplace-gated) so this ring is hand-built SVG, paired with the
 * already-installed ReactBits CountUp for the animated number.
 */
export function DwellTimer({ seconds }: { seconds: number }) {
  const progress = Math.min(1, seconds / THRESHOLD_SECONDS)
  const offset = CIRCUMFERENCE * (1 - progress)
  const color = progress >= 1 ? '#ef4444' : progress >= 0.6 ? '#f59e0b' : '#10b981'

  return (
    <div className="flex items-center gap-2">
      <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0 -rotate-90">
        <circle cx="20" cy="20" r={RADIUS} fill="none" stroke="#27272a" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease-out, stroke 0.6s' }}
        />
      </svg>
      <div className="font-mono text-xs">
        <span className={cn('font-semibold', progress >= 1 ? 'text-red-400' : 'text-zinc-300')}>
          <CountUp to={Math.round(seconds)} duration={1} />s
        </span>
        <div className="text-[10px] text-zinc-600">dwell · {THRESHOLD_SECONDS}s threshold</div>
      </div>
    </div>
  )
}
