import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { WifiOff, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * "Simulate Offline BOP Connection" — the offline-first demo moment (reference
 * doc Section 19.3 / Q9). This does NOT touch the real WebSocket; it's a
 * client-side simulation layer that mirrors what the edge box does for real
 * when RTSP/backend connectivity actually drops: keep detecting locally,
 * buffer events, then drain+sync once reconnected.
 */
export function NetworkKillSwitch({ onBufferedChange }: { onBufferedChange?: (n: number) => void }) {
  const [offline, setOffline] = useState(false)
  const [buffered, setBuffered] = useState(0)
  const [draining, setDraining] = useState(false)

  useEffect(() => {
    onBufferedChange?.(buffered)
  }, [buffered, onBufferedChange])
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (offline) {
      intervalRef.current = window.setInterval(() => {
        setBuffered((b) => b + 1)
      }, 1200)
    } else if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [offline])

  function toggle() {
    if (offline) {
      // reconnecting: drain the buffer with a visible progress moment
      setDraining(true)
      window.setTimeout(() => {
        setBuffered(0)
        setDraining(false)
        setOffline(false)
      }, 1400)
    } else {
      setOffline(true)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-black/30 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Edge resilience test</span>
        <button
          onClick={toggle}
          disabled={draining}
          className={cn(
            'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
            offline
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800',
          )}
        >
          {offline ? 'Restore connection' : 'Simulate offline BOP'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        {offline ? (
          <WifiOff size={16} className="text-amber-400" />
        ) : (
          <Wifi size={16} className="text-emerald-400" />
        )}
        <motion.span
          key={offline ? 'offline' : 'online'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn('text-sm font-semibold', offline ? 'text-amber-300' : 'text-emerald-400')}
        >
          {draining
            ? `Draining local buffer → syncing ${buffered} event${buffered === 1 ? '' : 's'} to command DB…`
            : offline
              ? 'OFFLINE — LOCAL BUFFERING (SQLite)'
              : 'CONNECTED (edge → command link)'}
        </motion.span>
      </div>

      {offline && !draining && (
        <div className="mt-2 text-xs text-zinc-500">
          Buffered events in memory: <span className="text-amber-300">{buffered}</span> — detections keep running locally, nothing is lost
        </div>
      )}
    </div>
  )
}
