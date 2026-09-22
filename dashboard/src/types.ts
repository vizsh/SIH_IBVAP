export type ConfidenceTier = 'high' | 'medium' | 'low'
export type EventStatus = 'pending' | 'confirmed' | 'dismissed' | 'auto_escalated'

export type EventType =
  | 'virtual_fence_intrusion'
  | 'loitering'
  | 'vehicle_detected'
  | 'person_detected'
  | 'anpr_read'
  | 'correlation_match'

export interface IbvapEvent {
  id: number
  camera_id: string
  event_type: EventType
  confidence: number
  confidence_tier: ConfidenceTier
  track_id: number | null
  zone_id: string | null
  bbox: number[] | null
  dwell_seconds: number | null
  plate_text: string | null
  frame_timestamp: number | null
  detail: string | null
  status: EventStatus
  created_at: string
  evidence_url: string | null
  distance_km: number | null
  travel_min_minutes: number | null
  travel_max_minutes: number | null
  elapsed_minutes: number | null
  from_camera_id: string | null
  ocr_samples: OcrSample[] | null
  trail: TrailPoint[] | null
  sensor_mode: 'thermal' | 'drone_simulated_telemetry' | null

  // Only present on drone_simulated_telemetry events: the real computed
  // ground-GPS estimate of the detection (pinhole-camera ray cast to a
  // flat ground plane — see edge/geo_projection.py), plus the telemetry
  // state that produced it. A fixed camera has no per-frame position to
  // project from, so these stay null for every ordinary event.
  detected_lat: number | null
  detected_lng: number | null
  drone_alt_m: number | null
  drone_heading_deg: number | null
}

export interface TrailPoint {
  x: number
  y: number
  t: number
}

export interface OcrSample {
  frame: number
  timestamp: number | null
  reading: string
  confidence: number
}

export interface AuditEntry {
  id: number
  event_id: number | null
  action: string
  detail: string
  prev_hash: string
  entry_hash: string
  created_at: string
}
