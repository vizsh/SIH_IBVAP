import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import type { AuditEntry } from '@/types'

export function AuditPreviewCard() {
  const [entries, setEntries] = useState<AuditEntry[]>([])

  useEffect(() => {
    fetch('/api/audit?limit=3')
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => {})
  }, [])

  return (
    <Link
      to="/audit"
      className="flex h-full flex-col justify-between rounded-xl border border-zinc-800/80 bg-black/30 p-4 backdrop-blur-sm transition-colors hover:border-cyan-500/30"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        <Lock size={12} className="text-cyan-400" /> Audit ledger
      </div>
      <div className="mt-2 space-y-1 overflow-hidden font-mono text-[10px] text-zinc-500">
        {entries
          .slice()
          .reverse()
          .map((e) => (
            <div key={e.id} className="truncate">
              <span className="text-emerald-500">✓</span> {e.action} → {e.entry_hash.slice(0, 10)}…
            </div>
          ))}
        {entries.length === 0 && <div>connecting…</div>}
      </div>
    </Link>
  )
}
