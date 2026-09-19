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
