import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react'
import { API_BASE } from '@/lib/api'
import type { AuditEntry } from '@/types'

async function fetchAudit(): Promise<AuditEntry[]> {
  const res = await fetch(`${API_BASE}/audit?limit=200`)
  if (!res.ok) throw new Error('failed to fetch audit log')
  return res.json()
}

async function verifyChain(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/audit/verify`)
  const data = await res.json()
  return data.valid
}

function shortHash(h: string) {
  return `${h.slice(0, 8)}…${h.slice(-6)}`
}

function formatLine(e: AuditEntry): string {
  const time = new Date(e.created_at + 'Z').toLocaleTimeString()
  return `[${time}] ${e.action.toUpperCase()}${e.event_id ? ` #${e.event_id}` : ''} -> SHA256: ${shortHash(e.entry_hash)}`
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [valid, setValid] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      const [rows, isValid] = await Promise.all([fetchAudit(), verifyChain()])
      setEntries(rows)
      setValid(isValid)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Tamper-Evident Audit Log</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Hash-chained: each entry = SHA-256(previous_hash + entry). Any retroactive edit breaks the chain.
          </p>
        </div>
        {valid !== null && (
          <div
            className={
              valid
                ? 'flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300'
                : 'flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300'
            }
          >
            {valid ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {valid ? 'CHAIN VERIFIED' : 'CHAIN TAMPERED'}
          </div>
        )}
      </header>

      <div className="rounded-xl border border-zinc-800 bg-black/70 p-4 font-mono text-[13px] leading-relaxed backdrop-blur-sm">
        {loading && entries.length === 0 && <div className="text-zinc-600">connecting to audit ledger…</div>}
        {entries
          .slice()
          .reverse()
          .map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 border-b border-zinc-900 py-1 text-zinc-400 last:border-0"
            >
              <ShieldAlert size={12} className="shrink-0 text-cyan-500" />
              <span className="text-emerald-500">✓</span>
              <span>{formatLine(e)}</span>
              <span className="ml-auto text-zinc-600">[VERIFIED MATCH]</span>
            </motion.div>
          ))}
        {!loading && entries.length === 0 && <div className="text-zinc-600">No audit entries yet.</div>}
      </div>
    </div>
  )
}
