import { useEffect, useRef, useState } from 'react'
import { Camera, Check, RotateCcw, Save, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { fetchFence, saveFence } from '@/lib/api'
import { useEdgeStream } from '@/hooks/useEdgeStream'
import { cn } from '@/lib/utils'

type Point = [number, number] // normalized 0-1, image-plane coords

const DEFAULT_ZONE: Point[] = [
  [0.15, 0.95],
  [0.35, 0.35],
  [0.75, 0.35],
  [0.9, 0.95],
]

/**
 * Draws and saves a real per-camera virtual-fence polygon on top of that
 * camera's actual feed (live stream if the edge pipeline is running,
 * otherwise a placeholder frame) — an operator clicks points directly on
 * the ground they want fenced, not a config file. Saved points are
 * normalized 0-1 image-plane coordinates, the same convention the edge
 * pipeline already uses for TelemetryIn.zone_polygon, so a running
 * pipeline can fetch and scale this straight into its own PolygonZone.
 */
export function FenceEditor({ cameraId }: { cameraId: string }) {
  const stream = useEdgeStream(cameraId)
  const containerRef = useRef<HTMLDivElement>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [savedPoints, setSavedPoints] = useState<Point[] | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved'>('loading')

  useEffect(() => {
    setStatus('loading')
    fetchFence(cameraId)
      .then((fence) => {
        const pts = (fence?.polygon as Point[] | undefined) ?? DEFAULT_ZONE
        setPoints(pts)
        setSavedPoints(fence ? pts : null)
        setStatus('idle')
      })
      .catch(() => {
        setPoints(DEFAULT_ZONE)
        setStatus('idle')
      })
  }, [cameraId])

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    setPoints((prev) => [...prev, [x, y]])
  }

  function undo() {
    setPoints((prev) => prev.slice(0, -1))
  }

  function resetToDefault() {
    setPoints(DEFAULT_ZONE)
  }

  async function handleSave() {
    if (points.length < 3) {
      toast.error('A fence needs at least 3 points')
      return
    }
    setStatus('saving')
    try {
      const saved = await saveFence(cameraId, points)
      setSavedPoints(saved.polygon as Point[])
      setStatus('saved')
      toast.success(`Fence saved for ${cameraId}`, { description: `${points.length}-point polygon, logged to the audit ledger` })
      window.setTimeout(() => setStatus('idle'), 1500)
    } catch {
      setStatus('idle')
      toast.error('Failed to save fence — backend unreachable')
    }
  }

  const isDirty = JSON.stringify(points) !== JSON.stringify(savedPoints ?? DEFAULT_ZONE)
  // SVG's `points` attribute takes unitless numbers, not percentages — the
  // viewBox is already 0-100, so plain 0-100 values line up exactly with
  // what a "%" would have meant, without the invalid syntax the browser
  // was silently choking on.
  const polygonPx = points.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-200">Zone configuration — {cameraId}</div>
          <div className="text-xs text-zinc-500">Click on the feed to place fence points. Needs 3+ points.</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={points.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/50 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          >
            <Undo2 size={12} /> Undo point
          </button>
          <button
            onClick={resetToDefault}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/50 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          >
            <RotateCcw size={12} /> Reset to default
          </button>
          <button
            onClick={handleSave}
            disabled={status === 'saving' || points.length < 3}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40',
              status === 'saved'
                ? 'border-emerald-600 bg-emerald-500/10 text-emerald-400'
                : 'border-cyan-700 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20',
            )}
          >
            {status === 'saved' ? <Check size={12} /> : <Save size={12} />}
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save fence'}
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onClick={handleClick}
        className="relative aspect-video w-full cursor-crosshair overflow-hidden rounded-xl border border-zinc-800 bg-black/60"
      >
        <img
          src={stream.src}
          onLoad={stream.onLoad}
          onError={stream.onError}
          alt=""
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${stream.status === 'live' ? 'opacity-100' : 'opacity-0'}`}
        />
        {stream.status !== 'live' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-600">
            <Camera size={32} strokeWidth={1.2} />
            <span className="text-xs">
              Edge pipeline offline for {cameraId} — fence still editable against this placeholder; the running pipeline fetches
              whatever you save here on its next start.
            </span>
          </div>
        )}

        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {points.length >= 2 && (
            <polygon points={polygonPx} fill="rgba(34,211,238,0.15)" stroke="#22d3ee" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        {points.map(([x, y], i) => (
          <div
            key={i}
            className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-cyan-400 bg-black/80 text-[9px] font-bold text-cyan-300"
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
          >
            {i + 1}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          {points.length} point{points.length === 1 ? '' : 's'} placed
          {isDirty && points.length >= 3 && <span className="ml-2 text-amber-400">· unsaved changes</span>}
        </span>
        {savedPoints ? (
          <span className="text-emerald-500">Configured — pipeline will use this fence on next start</span>
        ) : (
          <span className="text-zinc-600">Not yet configured — pipeline currently falls back to its hardcoded default zone</span>
        )}
      </div>
    </div>
  )
}
