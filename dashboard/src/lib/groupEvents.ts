import type { IbvapEvent } from '@/types'

export type QueueItem = { kind: 'single'; event: IbvapEvent } | { kind: 'cluster'; events: IbvapEvent[] }

/**
 * Collapse consecutive low-confidence events of the same type+camera into
 * one summary card. Low-tier events are, by the platform's own confidence
 * design (backend/app/confidence.py), meant to be "logged silently,
 * searchable later" — showing each one as an individually actionable card
 * is exactly the review-fatigue problem confidence-gating exists to
 * prevent. High/medium events are never clustered; they need eyes on each one.
 */
export function groupEvents(events: IbvapEvent[]): QueueItem[] {
  const items: QueueItem[] = []
  let cluster: IbvapEvent[] = []

  function flush() {
    if (cluster.length === 0) return
    items.push(cluster.length === 1 ? { kind: 'single', event: cluster[0] } : { kind: 'cluster', events: cluster })
    cluster = []
  }

  for (const e of events) {
    const canCluster = e.confidence_tier === 'low'
    const last = cluster[cluster.length - 1]
    const sameGroup = last && last.confidence_tier === 'low' && last.event_type === e.event_type && last.camera_id === e.camera_id

    if (canCluster && (cluster.length === 0 || sameGroup)) {
      cluster.push(e)
    } else {
      flush()
      cluster = [e]
      if (!canCluster) flush()
    }
  }
  flush()

  return items
}
