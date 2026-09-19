import { useEffect } from 'react'
import { fireCorrelationAlert } from '@/components/console/CorrelationBanner'
import { wsUrl } from '@/lib/api'

/**
 * Fires the real correlation banner the moment the backend detects an
 * actual cross-BOP plate match (see backend/app/correlation.py) — mounted
 * once at the app shell so it fires regardless of which page is open,
 * same as a real operator wouldn't need to be on a specific screen to see
 * a critical cross-post alert.
 */
export function useCorrelationWatcher() {
  useEffect(() => {
    const ws = new WebSocket(wsUrl())
    ws.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data)
        if (payload.type === 'event' && payload.data.event_type === 'correlation_match') {
          fireCorrelationAlert({ plateText: payload.data.plate_text, detail: payload.data.detail })
        }
      } catch {
        // ignore malformed frames
      }
    }
    return () => ws.close()
  }, [])
}
