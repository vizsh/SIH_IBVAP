import { useEffect, useRef, useState } from 'react'
import type { ConnState } from './useLiveEvents'

export interface MetricSample {
  t: number
  gpu: number
  latency: number
}

const HISTORY_LENGTH = 30

/**
 * Rolling window of edge-box telemetry. Latency is a small random walk
 * (not fully random each tick) so the sparkline reads as a real signal
 * rather than noise, and freezes at the last value while offline — an
 * edge box mid-outage doesn't get faster, it just stops reporting.
 */
export function useMetricHistory(connState: ConnState) {
  const [history, setHistory] = useState<MetricSample[]>([])
  const lastGpu = useRef(34)
  const lastLatency = useRef(130)

  useEffect(() => {
    if (connState !== 'live') return
    const interval = window.setInterval(() => {
      lastGpu.current = clamp(lastGpu.current + (Math.random() - 0.5) * 6, 20, 65)
      lastLatency.current = clamp(lastLatency.current + (Math.random() - 0.5) * 20, 90, 220)
      setHistory((prev) => [...prev, { t: Date.now(), gpu: lastGpu.current, latency: lastLatency.current }].slice(-HISTORY_LENGTH))
    }, 1500)
    return () => window.clearInterval(interval)
  }, [connState])

  return history
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
