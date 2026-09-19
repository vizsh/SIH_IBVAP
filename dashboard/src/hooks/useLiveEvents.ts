import { useEffect, useRef, useState } from 'react'
import { fetchEvents, wsUrl } from '../lib/api'
import type { IbvapEvent } from '../types'

export type ConnState = 'connecting' | 'live' | 'buffering'

/**
 * Live event stream over WebSocket, seeded with REST history on mount.
 * On disconnect, incoming events cannot arrive from the server anyway,
 * but we still surface a "buffering" state so the UI can visibly show
 * the edge-resilience story (Section 7 of the reference doc) instead of
 * silently going stale.
 */
export function useLiveEvents() {
  const [events, setEvents] = useState<IbvapEvent[]>([])
  const [connState, setConnState] = useState<ConnState>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchEvents()
      .then((initial) => {
        if (!cancelled) setEvents(initial)
      })
      .catch(() => {})

    function connect() {
      const ws = new WebSocket(wsUrl())
      wsRef.current = ws

      ws.onopen = () => setConnState('live')
      ws.onclose = () => {
        setConnState('buffering')
        retryRef.current = window.setTimeout(connect, 2000)
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (msg) => {
        try {
          const payload = JSON.parse(msg.data)
          if (payload.type === 'event') {
            const incoming = payload.data as IbvapEvent
            setEvents((prev) => (prev.some((e) => e.id === incoming.id) ? prev : [incoming, ...prev].slice(0, 200)))
          } else if (payload.type === 'event_updated') {
            setEvents((prev) =>
              prev.map((e) => (e.id === payload.data.id ? { ...e, status: payload.data.status } : e)),
            )
          }
        } catch {
          // ignore malformed frames
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      if (retryRef.current) window.clearTimeout(retryRef.current)
      wsRef.current?.close()
    }
  }, [])

  return { events, setEvents, connState }
}
