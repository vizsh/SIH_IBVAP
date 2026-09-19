import clsx from 'clsx'
import type { ConnState } from '../hooks/useLiveEvents'

export function StatusBadge({ state }: { state: ConnState }) {
  const label = state === 'live' ? 'LIVE' : state === 'buffering' ? 'BUFFERING (edge-local)' : 'CONNECTING'
  const dotClass = clsx('h-2 w-2 rounded-full', {
    'bg-emerald-400 animate-pulse': state === 'live',
    'bg-amber-400 animate-pulse': state === 'buffering',
    'bg-zinc-500': state === 'connecting',
  })
  return (
    <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-medium tracking-wide text-zinc-300">
      <span className={dotClass} />
      {label}
    </div>
  )
}
