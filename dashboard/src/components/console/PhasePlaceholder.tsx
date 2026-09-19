import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function PhasePlaceholder({
  icon: Icon,
  title,
  phase,
  description,
  bullets,
  action,
}: {
  icon: LucideIcon
  title: string
  phase: string
  description: string
  bullets: string[]
  action?: ReactNode
}) {
  return (
    <div>
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-zinc-100">{title}</h1>
        <p className="mt-1 text-xs text-zinc-500">{description}</p>
      </header>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 px-8 py-16 text-center">
        <Icon size={36} className="mb-4 text-cyan-500/60" strokeWidth={1.2} />
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-cyan-400">{phase}</div>
        <p className="max-w-md text-sm text-zinc-500">
          Wired into this same navigation shell and backend contract — not built as an afterthought once the layout above is real.
        </p>
        <ul className="mt-6 w-full max-w-md space-y-1.5 text-left text-xs text-zinc-500">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-500/60" />
              {b}
            </li>
          ))}
        </ul>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  )
}
