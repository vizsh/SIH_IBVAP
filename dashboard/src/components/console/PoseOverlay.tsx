import type { PoseData } from '@/hooks/useTelemetry'

// Standard COCO-17 skeleton edges (Ultralytics' own joint order) — the same
// connectivity every YOLOv8-pose demo draws, not a made-up rig.
const SKELETON: [number, number][] = [
  [15, 13],
  [13, 11],
  [16, 14],
  [14, 12],
  [11, 12],
  [5, 11],
  [6, 12],
  [5, 6],
  [5, 7],
  [6, 8],
  [7, 9],
  [8, 10],
  [1, 2],
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 4],
  [3, 5],
  [4, 6],
]

const MIN_CONF = 0.3
const COMPASS = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE']

// Screen-space heading (0deg = right/east, CCW) expressed as an 8-point
// compass label purely for readability — same underlying degree value the
// edge pipeline actually measured, just annotated the way the reference
// doc's "142DEG SE" mockup reads.
function compassLabel(deg: number): string {
  const idx = Math.round(deg / 45) % 8
  return COMPASS[idx]
}
// Real per-track px/s from the edge pipeline's own centroid history — no
// camera calibration exists to turn this into a real-world m/s figure, so
// the arrow length is deliberately just a relative visual cue, and the
// label says "px/s", never a fabricated physical speed.
const SPEED_ARROW_SCALE = 0.00035

function Skeleton({ pose }: { pose: PoseData }) {
  const kp = pose.keypoints
  const visible = (i: number) => kp[i] && kp[i][2] >= MIN_CONF
  const isAlert = pose.behavior === 'SUSPECT CRAWLING'
  const color = isAlert ? '#f87171' : '#34d399'

  const shoulderPts = [5, 6].filter(visible).map((i) => kp[i])
  const hipPts = [11, 12].filter(visible).map((i) => kp[i])
  let chest: [number, number] | null = null
  if (shoulderPts.length && hipPts.length) {
    const sx = shoulderPts.reduce((s, p) => s + p[0], 0) / shoulderPts.length
    const sy = shoulderPts.reduce((s, p) => s + p[1], 0) / shoulderPts.length
    const hx = hipPts.reduce((s, p) => s + p[0], 0) / hipPts.length
    const hy = hipPts.reduce((s, p) => s + p[1], 0) / hipPts.length
    chest = [(sx + hx) / 2, (sy + hy) / 2]
  }

  const topJoint = [0, 5, 6].find(visible)
  const labelPos = topJoint !== undefined ? kp[topJoint] : null

  return (
    <g>
      {SKELETON.map(([a, b], i) =>
        visible(a) && visible(b) ? (
          <line
            key={i}
            x1={kp[a][0] * 100}
            y1={kp[a][1] * 100}
            x2={kp[b][0] * 100}
            y2={kp[b][1] * 100}
            stroke={color}
            strokeWidth="0.35"
            strokeLinecap="round"
            opacity={0.85}
          />
        ) : null,
      )}
      {kp.map((p, i) =>
        visible(i) ? <circle key={i} cx={p[0] * 100} cy={p[1] * 100} r="0.6" fill={color} opacity={0.9} /> : null,
      )}

      {chest && pose.heading_deg != null && pose.speed_px_s != null && pose.speed_px_s > 5 && (
        <g>
          {(() => {
            const rad = (pose.heading_deg * Math.PI) / 180
            const len = Math.min(12, pose.speed_px_s * SPEED_ARROW_SCALE * 100)
            const x2 = chest[0] * 100 + Math.cos(rad) * len
            const y2 = chest[1] * 100 - Math.sin(rad) * len
            return (
              <>
                <line x1={chest[0] * 100} y1={chest[1] * 100} x2={x2} y2={y2} stroke="#facc15" strokeWidth="0.5" markerEnd="url(#pose-arrowhead)" />
              </>
            )
          })()}
        </g>
      )}

      {labelPos && (
        <foreignObject x={labelPos[0] * 100 - 20} y={Math.max(0, labelPos[1] * 100 - 12)} width="40" height="11">
          <div
            className={`whitespace-nowrap text-center font-mono text-[1.9px] font-bold uppercase tracking-wider ${
              isAlert ? 'text-red-400' : 'text-emerald-400'
            }`}
            style={{ textShadow: '0 0 2px black' }}
          >
            <div>
              #{pose.track_id} · POSE: {pose.behavior ?? 'ANALYZING'}
            </div>
            {pose.heading_deg != null && pose.speed_px_s != null && pose.speed_px_s > 5 && (
              <div className="text-amber-300">
                HEADING: {pose.heading_deg.toFixed(0)}° {compassLabel(pose.heading_deg)} · SPEED: {pose.speed_px_s.toFixed(0)}px/s
              </div>
            )}
          </div>
        </foreignObject>
      )}
    </g>
  )
}

export function PoseOverlay({ poses }: { poses: PoseData[] | undefined }) {
  if (!poses || poses.length === 0) return null
  return (
    <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <marker id="pose-arrowhead" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
          <path d="M0,0 L4,2 L0,4 Z" fill="#facc15" />
        </marker>
      </defs>
      {poses.map((pose) => (
        <Skeleton key={pose.track_id} pose={pose} />
      ))}
    </svg>
  )
}
