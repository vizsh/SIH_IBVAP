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

export function wsUrl(): string {
  if (API_ORIGIN) {
    const proto = API_ORIGIN.startsWith('https') ? 'wss' : 'ws'
    const host = API_ORIGIN.replace(/^https?:\/\//, '').replace(/\/$/, '')
    return `${proto}://${host}/ws`
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws`
}
