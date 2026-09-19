import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, ShieldAlert, ShieldCheck, Terminal } from 'lucide-react'
import { toast } from 'sonner'
import { API_BASE, wsUrl } from '@/lib/api'
import type { AuditEntry } from '@/types'

function shortHash(h: string) {
  return `0x${h.slice(0, 10)}…`
}

function fireTamperAlert(blockId: number) {
  toast.custom(
    () => (
      <div className="flex w-[520px] max-w-[90vw] items-center gap-3 rounded-xl border border-pink-500/60 bg-black/95 px-5 py-4 shadow-[0_0_30px_rgba(236,72,153,0.45)] backdrop-blur-md">
        <ShieldAlert size={22} className="shrink-0 animate-pulse text-pink-500" />
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-pink-500">
            Critical — cryptographic hash mismatch at block #{blockId}
          </div>
          <div className="mt-0.5 text-sm text-zinc-200">
            Hash chain broken — every entry after it is now provably unverifiable. Audit integrity preserved.
          </div>
        </div>
      </div>
    ),
    { duration: 8000, position: 'top-center' },
  )
}

export function AuditTerminalWidget() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [valid, setValid] = useState(true)
  const [brokenBlock, setBrokenBlock] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [tampering, setTampering] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function checkVerify() {
    try {
      const res = await fetch(`${API_BASE}/audit/verify`)
      const data = await res.json()
      setValid(data.valid)
      setBrokenBlock(data.broken_block_id)
      if (!data.valid && data.broken_block_id) fireTamperAlert(data.broken_block_id)
    } catch {
      // best-effort — widget stays in its last-known state
    }
  }

  useEffect(() => {
    fetch(`${API_BASE}/audit?limit=8`)
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => {})
    checkVerify()

    const ws = new WebSocket(wsUrl())
    ws.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data)
        if (payload.type === 'audit') {
          setEntries((prev) => [...prev, payload.data].slice(-8))
          checkVerify()
        }
      } catch {
        // ignore malformed frames
      }
    }
    return () => ws.close()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [entries])

  async function handleTamper() {
    setTampering(true)
    try {
      await fetch(`${API_BASE}/audit/demo/tamper`, { method: 'POST' })
      await new Promise((r) => setTimeout(r, 400)) // let the "calculating" beat land visually
      await checkVerify()
    } catch {
      // no-op — best effort demo action
    } finally {
      setTampering(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 font-mono text-xs">
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`flex w-full items-center justify-between rounded-t-lg border px-3 py-2 backdrop-blur-md transition-colors ${
          valid ? 'border-emerald-500/40 bg-black/90 text-emerald-400' : 'border-red-500/60 bg-black/95 text-red-500'
        }`}
      >
        <span className="flex items-center gap-1.5 uppercase tracking-wider">
          {valid ? <ShieldCheck size={13} /> : <ShieldAlert size={13} className="animate-pulse" />}
          {valid ? 'Chain verified' : `Tampering at block #${brokenBlock}`}
        </span>
        {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-b-lg border border-t-0 border-zinc-800 bg-black/95 backdrop-blur-md"
          >
            <div ref={scrollRef} className="max-h-48 space-y-0 overflow-y-auto px-3 py-2 text-[10px] leading-relaxed text-zinc-500">
              {entries.map((e, i) => {
                const broken = brokenBlock != null && e.id >= brokenBlock
                return (
                  <div key={e.id} className="relative pl-4">
                    {i > 0 && (
                      <div
                        className={`absolute left-[5px] top-[-6px] h-2 w-px ${broken ? 'bg-pink-500' : 'bg-emerald-700/60'}`}
                      />
                    )}
                    <span className={`absolute left-0 top-[3px] h-2.5 w-2.5 rounded-full border ${broken ? 'border-pink-400 bg-pink-500/30' : 'border-emerald-600 bg-emerald-500/20'}`} />
                    <div className="flex items-center gap-1.5 py-0.5">
                      <span className={broken ? 'text-pink-500' : 'text-emerald-600'}>{broken ? '✗' : '✓'}</span>
                      <span className="text-zinc-600">[{new Date(e.created_at + 'Z').toLocaleTimeString()}]</span>
                      <span className={broken ? 'text-pink-300' : 'text-zinc-400'}>{e.action.toUpperCase()}</span>
                      <span className="text-zinc-700">→</span>
                      <span className={broken ? 'text-pink-400' : 'text-cyan-500'}>{shortHash(e.entry_hash)}</span>
                      {broken && e.id === brokenBlock && <span className="ml-1 text-pink-400">CHAIN BROKEN HERE</span>}
                    </div>
                  </div>
                )
              })}
              {entries.length === 0 && <div className="text-zinc-600">awaiting chain activity…</div>}
            </div>
            <div className="border-t border-zinc-800 p-2">
              <button
                onClick={handleTamper}
                disabled={tampering}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                <Terminal size={11} />
                {tampering ? 'Calculating hash…' : 'Simulate log modification'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
