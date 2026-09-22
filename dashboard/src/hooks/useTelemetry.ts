import { useEffect, useState } from 'react'
import { API_BASE, wsUrl } from '../lib/api'

export interface PoseData {
  track_id: number
  keypoints: [number, number, number][] // 17 COCO joints, normalized [x, y, confidence]
  behavior: string | null
  heading_deg: number | null
  speed_px_s: number | null
}

export interface Telemetry {
  camera_id: string
  fps: number
  latency_ms: number
  active_tracks: number
  zone_polygon: [number, number][]
  poses?: PoseData[]
  mean_brightness?: number
  sensor_mode?: 'thermal' | 'drone_simulated_telemetry' | null

  // Present only on a geo-referenced (drone) camera's telemetry push — the
  // real simulated flight state (see edge/synthetic_telemetry.py) plus the
  // camera intrinsics used for its geo-projection (edge/geo_projection.py),
  // so the coverage map can draw the camera's actual ground footprint
  // instead of a fixed site's static cone. Absent for every fixed camera.
  lat?: number | null
  lng?: number | null
  alt_m?: number | null
  heading_deg?: number | null
  gimbal_pitch_deg?: number | null
  hfov_deg?: number | null
  vfov_deg?: number | null
}

/**
 * Live edge-box telemetry (real FPS, measured latency, active track count,
 * the actual geofence polygon) — the numbers the video-pane HUD displays.
 * Seeded from REST on mount, then updated via the same WebSocket the event
 * feed uses. Returns null until the edge pipeline has actually pushed
 * something for this camera — the HUD shows a dash rather than a fake
 * number while that's true.
 */
export function useTelemetry(cameraId: string): Telemetry | null {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(`${API_BASE}/telemetry/${cameraId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data) setTelemetry(data)
      })
      .catch(() => {})

    const ws = new WebSocket(wsUrl())
    ws.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data)
        if (payload.type === 'telemetry' && payload.data.camera_id === cameraId) {
          setTelemetry(payload.data)
        }
      } catch {
        // ignore malformed frames
      }
    }

    return () => {
      cancelled = true
      ws.close()
    }
  }, [cameraId])

  return telemetry
}
