import type { IbvapEvent } from '../types'

// In local dev, Vite's proxy rewrites /api/* -> the backend's root paths
// (see vite.config.ts), so '/api' works with no configuration. In a real
// deployment the frontend and backend are on different hosts (Vercel +
// Render/Railway) with no proxy in between, so VITE_API_URL points
// straight at the deployed backend's origin and every call hits its root
// paths directly — same backend, same routes, just no rewrite step.
const API_ORIGIN = import.meta.env.VITE_API_URL as string | undefined
export const API_BASE = API_ORIGIN ? API_ORIGIN.replace(/\/$/, '') : '/api'

// Evidence images are served as static files at the backend's root
// (/evidence/*), not under /api, and Vite's proxy only rewrites /api/* — so
// these need the real backend origin directly, same reasoning as the MJPEG
// stream (see useEdgeStream.ts).
export const BACKEND_ORIGIN = API_ORIGIN ?? 'http://127.0.0.1:8000'

export async function fetchEvents(): Promise<IbvapEvent[]> {
  const res = await fetch(`${API_BASE}/events`)
  if (!res.ok) throw new Error('failed to fetch events')
  return res.json()
}

export async function reviewEvent(id: number, action: 'confirm' | 'dismiss', reason?: string) {
  const res = await fetch(`${API_BASE}/events/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, reason }),
  })
  if (!res.ok) throw new Error('failed to review event')
  return res.json()
}

export interface CameraFence {
  camera_id: string
  polygon: [number, number][]
  updated_at: string
}

export async function fetchFence(cameraId: string): Promise<CameraFence | null> {
  const res = await fetch(`${API_BASE}/cameras/${cameraId}/fence`)
  if (!res.ok) throw new Error('failed to fetch fence')
  const body = await res.json()
  return body ?? null
}

export async function saveFence(cameraId: string, polygon: [number, number][]): Promise<CameraFence> {
  const res = await fetch(`${API_BASE}/cameras/${cameraId}/fence`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon }),
  })
  if (!res.ok) throw new Error('failed to save fence')
  return res.json()
}

// Posts a real event through the same /events contract the edge pipeline
// uses — audit-logged, WS-broadcast, confidence-tiered, everything the
// pipeline's own events get. Used only by clearly-labeled "Simulate
// ..." / "Demo ..." UI controls (same honesty pattern as the existing
// tamper-simulation and offline-BOP-simulation buttons): a scripted
// showcase trigger, never disguised as an undetected real intrusion.
export async function postDemoEvent(payload: Record<string, unknown>): Promise<IbvapEvent> {
  const res = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('failed to post demo event')
  return res.json()
}

export interface PointOfInterest {
  id: number
  name: string
  category: 'suspected_staging_point' | 'historical_seizure' | 'unmonitored_crossing' | 'unverified_tip' | 'other'
  lat: number
  lng: number
  source: 'humint' | 'pattern_of_life' | 'historical_record' | 'unverified'
  notes: string | null
  created_at: string
}

export async function fetchPOIs(): Promise<PointOfInterest[]> {
  const res = await fetch(`${API_BASE}/poi`)
  if (!res.ok) throw new Error('failed to fetch points of interest')
  return res.json()
}

export async function createPOI(payload: Omit<PointOfInterest, 'id' | 'created_at'>): Promise<PointOfInterest> {
  const res = await fetch(`${API_BASE}/poi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('failed to create point of interest')
  return res.json()
}

export async function deletePOI(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/poi/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('failed to delete point of interest')
}

// Logs an operator's acknowledgment of the coverage map's risk-triggered
// drone overflight recommendation — an audited analyst action, never an
// automated dispatch (no real drone fleet exists here to command).
export async function acknowledgeOverflightDispatch(payload: { zone_id: string; zone_name: string; risk_index: number; coverage_pct: number }): Promise<void> {
  const res = await fetch(`${API_BASE}/dispatch/overflight`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('failed to acknowledge overflight dispatch')
}

export function wsUrl(): string {
  if (API_ORIGIN) {
    const proto = API_ORIGIN.startsWith('https') ? 'wss' : 'ws'
    const host = API_ORIGIN.replace(/^https?:\/\//, '').replace(/\/$/, '')
    return `${proto}://${host}/ws`
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws`
}
