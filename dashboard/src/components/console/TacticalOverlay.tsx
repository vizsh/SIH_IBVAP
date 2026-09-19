const CORNER = 'absolute h-5 w-5 border-cyan-400/70'

export function TacticalOverlay({ fps = 8.4, lat = '27.0392', long = '88.2631' }: { fps?: number; lat?: string; long?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-mono text-cyan-300/80">
      {/* corner brackets */}
      <div className={`${CORNER} top-3 left-3 border-t-2 border-l-2`} />
      <div className={`${CORNER} top-3 right-3 border-t-2 border-r-2`} />
      <div className={`${CORNER} bottom-3 left-3 border-b-2 border-l-2`} />
      <div className={`${CORNER} bottom-3 right-3 border-b-2 border-r-2`} />

      {/* telemetry readout */}
      <div className="absolute top-3 left-10 text-[10px] leading-tight tracking-wider">
        <div>LAT: {lat} | LONG: {long}</div>
        <div>1080p @ {fps.toFixed(1)} FPS</div>
      </div>
      <div className="absolute top-3 right-10 text-right text-[10px] leading-tight tracking-wider text-red-400">
        <div className="flex items-center justify-end gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          REC
        </div>
      </div>

      {/* glowing virtual-fence polygon */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon
          points="20,75 45,40 78,45 70,88"
          fill="rgba(34,211,238,0.05)"
          stroke="#22d3ee"
          strokeWidth="0.4"
          strokeDasharray="2,1.5"
          className="animate-pulse"
        />
      </svg>

      <div className="absolute bottom-3 left-10 text-[10px] tracking-wider text-zinc-500">
        VIRTUAL FENCE — ZONE A · geofence armed
      </div>
    </div>
  )
}
