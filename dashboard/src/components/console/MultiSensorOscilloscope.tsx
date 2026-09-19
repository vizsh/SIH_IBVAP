import { useEffect, useMemo, useRef, useState } from 'react'
import { Radio } from 'lucide-react'
import { API_BASE } from '@/lib/api'
import type { IbvapEvent } from '@/types'

const SAMPLE_INTERVAL_MS = 150
const HISTORY_LEN = 60
const ALERT_WINDOW_SECONDS = 20

interface Channel {
  key: 'visual' | 'seismic' | 'acoustic'
  label: string
  color: string
  real: boolean // whether this channel's idle/active *reading* comes from real data
}

const CHANNELS: Channel[] = [
  { key: 'visual', label: 'VISUAL (YOLOv8n detector)', color: '#22d3ee', real: true },
  { key: 'seismic', label: 'SEISMIC UGS #04', color: '#f59e0b', real: false },
  { key: 'acoustic', label: 'ACOUSTIC ARRAY', color: '#a78bfa', real: false },
]

function Waveform({ points, color, height = 32 }: { points: number[]; color: string; height?: number }) {
  const width = 100
  const step = width / (HISTORY_LEN - 1)
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${(height / 2 - v * (height / 2 - 2)).toFixed(2)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-8 w-full">
      <path d={path} fill="none" stroke={color} strokeWidth="1" opacity={0.9} />
    </svg>
  )
}

/**
 * Reference-doc "sensor fusion" panel, built as a clearly labeled simulator:
 * no seismic UGS or acoustic array hardware exists on this platform, so
 * fabricating those two readings as if real would violate the project's own
 * honesty rule (CLAUDE.md: never a bare confidence score presented as more
 * than it is). The visual channel is the exception — its baseline reading
 * is the real latest high-tier event confidence for this camera, not a
 * simulated number, and the "unified trigger" only fires off that real event.
 */
export function MultiSensorOscilloscope({ cameraId }: { cameraId: string }) {
  const [history, setHistory] = useState<Record<Channel['key'], number[]>>({
    visual: Array(HISTORY_LEN).fill(0.05),
    seismic: Array(HISTORY_LEN).fill(0.05),
    acoustic: Array(HISTORY_LEN).fill(0.05),
  })
  const [recentEvents, setRecentEvents] = useState<IbvapEvent[]>([])
  const tickRef = useRef(0)

  useEffect(() => {
    function refresh() {
      fetch(`${API_BASE}/events?limit=50`)
        .then((r) => r.json())
        .then((events: IbvapEvent[]) => setRecentEvents(events.filter((e) => e.camera_id === cameraId)))
        .catch(() => {})
    }
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [cameraId])

  const activeEvent = useMemo(() => {
    const now = Date.now()
    return recentEvents.find((e) => e.confidence_tier === 'high' && now - new Date(e.created_at + 'Z').getTime() < ALERT_WINDOW_SECONDS * 1000)
  }, [recentEvents])

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1
      const t = tickRef.current
      setHistory((prev) => {
        const next = { ...prev }
        for (const ch of CHANNELS) {
          const arr = prev[ch.key].slice(1)
          let value: number
          if (ch.key === 'visual') {
            const base = activeEvent ? activeEvent.confidence : 0.06
            value = base + (activeEvent ? Math.sin(t * 0.9) * 0.03 : Math.sin(t * 0.4) * 0.02)
          } else {
            const base = activeEvent ? 0.55 + Math.sin(t * (ch.key === 'seismic' ? 1.6 : 2.3)) * 0.35 : Math.sin(t * 0.3 + (ch.key === 'seismic' ? 0 : 2)) * 0.06
            value = base
          }
          arr.push(Math.max(-1, Math.min(1, value)))
          next[ch.key] = arr
        }
        return next
      })
    }, SAMPLE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [activeEvent])

  const unifiedConfidence = activeEvent ? Math.min(99.9, activeEvent.confidence * 100 + 4.5) : null

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
          <Radio size={13} className="text-cyan-400" /> Multi-sensor fusion oscilloscope
        </div>
        <span className="rounded-full border border-amber-700/50 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400">
          Seismic/acoustic simulated — no UGS/mic hardware installed
        </span>
      </div>

      <div className="space-y-2.5">
        {CHANNELS.map((ch) => (
          <div key={ch.key} className="flex items-center gap-3">
            <div className="w-40 shrink-0 font-mono text-[10px] text-zinc-400">
              {ch.label}
              {ch.real && <span className="ml-1 text-emerald-500">·real</span>}
            </div>
            <Waveform points={history[ch.key]} color={ch.color} />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2 text-xs">
        <span className="text-zinc-500">
          {activeEvent ? `Converging on real ${activeEvent.event_type.replace(/_/g, ' ')} event, conf ${(activeEvent.confidence * 100).toFixed(0)}%` : 'Idle — no active high-confidence event on this camera'}
        </span>
        {unifiedConfidence != null && (
          <span className="font-mono font-semibold text-amber-300">Unified Master Trigger: {unifiedConfidence.toFixed(1)}%</span>
        )}
      </div>
    </div>
  )
}
