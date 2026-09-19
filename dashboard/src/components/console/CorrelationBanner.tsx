import { Zap } from 'lucide-react'
import { toast } from 'sonner'

interface CorrelationMatch {
  plate: string
  fromCamera: string
  toCamera: string
  minutesApart: number
}

/**
 * Cross-BOP pattern correlation (reference doc Section 16.1 / Feature 4):
 * no new hardware, just a shared event DB keyed by plate hash + timestamp
 * across BOP edge nodes, flagged when a travel-time window is plausible.
 * This banner is the UI moment for that match — a full-width flash, not a
 * corner toast, since it's meant to interrupt the operator's attention.
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
            Vehicle <span className="font-mono font-semibold text-cyan-300">{match.plate}</span> spotted at{' '}
            <span className="text-zinc-100">{match.toCamera}</span>, {match.minutesApart} min after{' '}
            <span className="text-zinc-100">{match.fromCamera}</span>
          </div>
        </div>
      </div>
    ),
    { duration: 6000, position: 'top-center' },
  )
}

const DEMO_MATCH: CorrelationMatch = {
  plate: 'HR26AB1234',
  fromCamera: 'BOP-Alpha (Panitanki)',
  toCamera: 'BOP-Bravo (Raxaul)',
  minutesApart: 14,
}

export function CorrelationDemoTrigger() {
  return (
    <button
      onClick={() => fireCorrelationAlert(DEMO_MATCH)}
      className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
    >
      <Zap size={13} /> Simulate correlation match
    </button>
  )
}
