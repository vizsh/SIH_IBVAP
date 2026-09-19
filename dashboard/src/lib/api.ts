import type { IbvapEvent } from '../types'

const API_BASE = '/api'

export async function fetchEvents(): Promise<IbvapEvent[]> {
  const res = await fetch(`${API_BASE}/events`)
  if (!res.ok) throw new Error('failed to fetch events')
  return res.json()
}

export async function reviewEvent(id: number, action: 'confirm' | 'dismiss') {
  const res = await fetch(`${API_BASE}/events/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  if (!res.ok) throw new Error('failed to review event')
  return res.json()
}

export function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws`
}
