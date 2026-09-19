import { useRef, useState } from 'react'
import { Camera, ScanLine } from 'lucide-react'
import Crosshair from '@/components/Crosshair'
import { AnprVotingCard } from '@/components/console/AnprVotingCard'
import { GhostReplay } from '@/components/console/GhostReplay'
import { PoseOverlay } from '@/components/console/PoseOverlay'
import { TacticalOverlay } from '@/components/console/TacticalOverlay'
import { useEdgeStream } from '@/hooks/useEdgeStream'
import { useTelemetry } from '@/hooks/useTelemetry'
import type { IbvapEvent } from '@/types'

export function VideoPane({
  cameraId = 'BOP-01',
  replayEvent,
  onCloseReplay,
}: {
  cameraId?: string
  replayEvent?: IbvapEvent | null
  onCloseReplay?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showAnpr, setShowAnpr] = useState(false)
  const stream = useEdgeStream(cameraId)
  const telemetry = useTelemetry(cameraId)

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300">
        Camera feed — {cameraId}
        <div className="flex items-center gap-2">
          <span
            className={
              stream.status === 'live'
                ? 'flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-emerald-400'
                : 'flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600'
            }
          >
            <span className={`h-1.5 w-1.5 rounded-full ${stream.status === 'live' ? 'animate-pulse bg-emerald-400' : 'bg-zinc-600'}`} />
            {stream.status === 'live' ? 'edge pipeline live' : 'edge pipeline offline'}
          </span>
          <button
            onClick={() => setShowAnpr((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800"
          >
            <ScanLine size={12} /> {showAnpr ? 'Hide' : 'Demo'} ANPR fusion
          </button>
        </div>
      </div>
      <div ref={containerRef} className="relative flex flex-1 items-center justify-center overflow-hidden bg-black/60">
        {/* Real annotated stream from /edge/pipeline.py — only visible once it actually loads */}
        <img
          src={stream.src}
          onLoad={stream.onLoad}
          onError={stream.onError}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover ${stream.status === 'live' ? 'opacity-100' : 'opacity-0'}`}
        />

        {stream.status !== 'live' && (
          <div className="flex flex-col items-center gap-2 text-zinc-600">
            <Camera size={40} strokeWidth={1.2} />
            <span className="text-xs">
              Edge pipeline not running — start it with{' '}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">
                python edge/pipeline.py --camera-id {cameraId} --stream-port {cameraId === 'BOP-Alpha' ? 8092 : cameraId === 'BOP-Bravo' ? 8093 : 8091}
              </code>
            </span>
          </div>
        )}

        <TacticalOverlay cameraId={cameraId} telemetry={telemetry} />
        <PoseOverlay poses={telemetry?.poses} />
        <Crosshair color="rgba(34,211,238,0.5)" containerRef={containerRef} />

        {showAnpr && (
          <div className="absolute bottom-4 right-4 z-20">
            <AnprVotingCard />
          </div>
        )}

        {replayEvent && replayEvent.camera_id === cameraId && (
          <GhostReplay event={replayEvent} onClose={() => onCloseReplay?.()} />
        )}
      </div>
    </div>
  )
}
