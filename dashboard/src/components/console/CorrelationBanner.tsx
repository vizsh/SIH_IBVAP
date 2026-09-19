import { Zap } from 'lucide-react'
import { toast } from 'sonner'

interface CorrelationMatch {
  plateText: string | null
  detail: string | null
}

/**
 * Cross-BOP pattern correlation (reference doc Section 16.1 / Feature 4):
 * no new hardware, just a shared event DB keyed by plate text + timestamp
 * across BOP edge nodes, flagged when a travel-time window is plausible.
 * This banner is the UI moment for that match — a full-width flash, not a
 * corner toast, since it's meant to interrupt the operator's attention.
 *
 * Takes the real correlation_match event's own fields (plate_text, detail)
 * rather than a bespoke shape, so there's no string-parsing between what
 * the backend actually computed and what gets rendered.
 */
export function fireCorrelationAlert(match: CorrelationMatch) {
  toast.custom(
    () => (
      <div className="flex w-[520px] max-w-[90vw] items-center gap-3 rounded-xl border border-amber-500/50 bg-black/95 px-5 py-4 shadow-[0_0_30px_rgba(245,158,11,0.25)] backdrop-blur-md">
        <Zap size={22} className="shrink-0 animate-pulse text-amber-400" />
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Correlated pattern match
          </div>
          <div className="mt-0.5 truncate text-sm text-zinc-200">
            {match.plateText && (
              <span className="mr-1 font-mono font-semibold text-cyan-300">{match.plateText}</span>
            )}
            {match.detail}
          </div>
        </div>
      </div>
    ),
    { duration: 6000, position: 'top-center' },
  )
}

const DEMO_MATCH: CorrelationMatch = {
  plateText: 'HR26AB1234',
  detail: 'spotted at BOP-Bravo (Raxaul), 14 min after BOP-Alpha (Panitanki) — demo trigger, not a real match',
}

export function CorrelationDemoTrigger() {
  return (
    <button
      onClick={() => fireCorrelationAlert(DEMO_MATCH)}
      className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
    >
      <Zap size={13} /> Simulate correlation match (demo)
    </button>
  )
}
