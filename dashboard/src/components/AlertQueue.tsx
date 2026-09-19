import { AnimatePresence, motion } from 'framer-motion'
import { reviewEvent } from '../lib/api'
import { cn } from '@/lib/utils'
import { GlowingEffect } from '@/components/glowing-effect'
import { DwellTimer } from '@/components/console/DwellTimer'
import { ReviewActions } from '@/components/console/ReviewActions'
import type { ConfidenceTier, IbvapEvent } from '../types'
import { TierPill } from './TierPill'

const TIER_BORDER: Record<ConfidenceTier, string> = {
  high: 'border-l-red-500 shadow-[0_0_16px_rgba(239,68,68,0.12)]',
  medium: 'border-l-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.1)]',
  low: 'border-l-emerald-500',
}

const EVENT_LABELS: Record<string, string> = {
  virtual_fence_intrusion: 'Virtual-fence intrusion',
  loitering: 'Loitering / dwell-time',
  vehicle_detected: 'Vehicle detected',
  person_detected: 'Person detected',
  anpr_read: 'ANPR read',
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso + 'Z').getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

export function AlertQueue({
  events,
  onUpdate,
}: {
  events: IbvapEvent[]
  onUpdate: (id: number, status: IbvapEvent['status']) => void
}) {
  async function handle(id: number, action: 'confirm' | 'dismiss') {
    onUpdate(id, action === 'confirm' ? 'confirmed' : 'dismissed')
    try {
      await reviewEvent(id, action)
    } catch {
      // best-effort optimistic update; a failed request will self-correct on next WS event
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300">Alert queue</div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        <AnimatePresence initial={false}>
          {events.map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                'relative rounded-lg border border-zinc-800 border-l-2 bg-zinc-950/60 p-3',
                TIER_BORDER[e.confidence_tier],
              )}
            >
              <GlowingEffect disabled={false} glow proximity={70} spread={28} borderWidth={2} />
              <div className="relative z-10 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-zinc-100">
                    {EVENT_LABELS[e.event_type] ?? e.event_type}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {e.camera_id} · {timeAgo(e.created_at)} · conf {(e.confidence * 100).toFixed(0)}%
                  </div>
                </div>
                <TierPill tier={e.confidence_tier} />
              </div>

              {e.event_type === 'loitering' && e.dwell_seconds != null && (
                <div className="relative z-10 mt-2">
                  <DwellTimer seconds={e.dwell_seconds} />
                </div>
              )}

              <ReviewActions
                status={e.status}
                onConfirm={() => handle(e.id, 'confirm')}
                onDismiss={() => handle(e.id, 'dismiss')}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {events.length === 0 && <div className="p-4 text-sm text-zinc-500">No events yet.</div>}
      </div>
    </div>
  )
}
