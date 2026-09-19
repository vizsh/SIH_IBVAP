import type { Telemetry } from '@/hooks/useTelemetry'

const CORNER = 'absolute h-5 w-5 border-cyan-400/70'

/**
 * Per-camera install coordinates — genuinely static config (a border camera
 * doesn't move), not runtime telemetry, so it lives here rather than being
 * fabricated by the pipeline each frame.
 */
const CAMERA_COORDS: Record<string, { lat: string; long: string }> = {
  'BOP-01': { lat: '27.0392', long: '88.2631' },
}

export function TacticalOverlay({ cameraId, telemetry }: { cameraId: string; telemetry: Telemetry | null }) {
  const coords = CAMERA_COORDS[cameraId] ?? { lat: '—', long: '—' }
  const polygonPoints = telemetry?.zone_polygon.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')

  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-mono text-cyan-300/80">
      {/* corner brackets */}
      <div className={`${CORNER} top-3 left-3 border-t-2 border-l-2`} />
      <div className={`${CORNER} top-3 right-3 border-t-2 border-r-2`} />
      <div className={`${CORNER} bottom-3 left-3 border-b-2 border-l-2`} />
      <div className={`${CORNER} bottom-3 right-3 border-b-2 border-r-2`} />

      {/* telemetry readout — real, from the edge pipeline; em-dash until it reports in */}
      <div className="absolute top-3 left-10 text-[10px] leading-tight tracking-wider">
        <div>LAT: {coords.lat} | LONG: {coords.long}</div>
        <div>{telemetry ? `${telemetry.fps.toFixed(1)} FPS · ${telemetry.latency_ms.toFixed(0)}ms e2e` : '— FPS · — ms'}</div>
        <div>{telemetry ? `${telemetry.active_tracks} active track${telemetry.active_tracks === 1 ? '' : 's'}` : '0 active tracks'}</div>
      </div>
      <div className="absolute top-3 right-10 text-right text-[10px] leading-tight tracking-wider text-red-400">
        <div className="flex items-center justify-end gap-1">
          <span className={`h-1.5 w-1.5 rounded-full bg-red-500 ${telemetry ? 'animate-pulse' : 'opacity-30'}`} />
          REC
        </div>
      </div>

      {/* real virtual-fence polygon, from the pipeline's actual PolygonZone — not decorative */}
      {polygonPoints && (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon
            points={polygonPoints}
            fill="rgba(34,211,238,0.05)"
            stroke="#22d3ee"
            strokeWidth="0.4"
            strokeDasharray="2,1.5"
            className="animate-pulse"
          />
        </svg>
      )}

      <div className="absolute bottom-3 left-10 text-[10px] tracking-wider text-zinc-500">
        VIRTUAL FENCE — ZONE A · {telemetry ? 'geofence armed' : 'awaiting edge telemetry'}
      </div>
    </div>
  )
}
