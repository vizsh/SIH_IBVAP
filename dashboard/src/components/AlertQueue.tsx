import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Layers, Rewind } from 'lucide-react'
import { reviewEvent } from '../lib/api'
import { cn } from '@/lib/utils'
import { GlowingEffect } from '@/components/glowing-effect'
import { AnprVotingCard } from '@/components/console/AnprVotingCard'
import { ConfidenceGauge } from '@/components/console/ConfidenceGauge'
import { DwellTimer } from '@/components/console/DwellTimer'
import { EvidenceThumbnail } from '@/components/console/EvidenceThumbnail'
import { ReviewActions } from '@/components/console/ReviewActions'
import { groupEvents } from '@/lib/groupEvents'
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
  correlation_match: 'Cross-BOP correlation',
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso + 'Z').getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

function AlertCard({
  e,
  onConfirm,
  onDismiss,
  onReplay,
}: {
  e: IbvapEvent
  onConfirm: () => void
  onDismiss: (reason: string) => void
  onReplay?: (e: IbvapEvent) => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn('relative flex gap-3 overflow-hidden rounded-lg border border-zinc-800 border-l-2 bg-zinc-950/60 p-3', TIER_BORDER[e.confidence_tier])}
    >
      <GlowingEffect disabled={false} glow proximity={70} spread={28} borderWidth={2} />
      <EvidenceThumbnail url={e.evidence_url} className="relative z-10 h-16 w-16 shrink-0 rounded-md border border-zinc-800" />
      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-zinc-100">{EVENT_LABELS[e.event_type] ?? e.event_type}</div>
            <div className="text-xs text-zinc-500">
              {e.camera_id} · {timeAgo(e.created_at)} · conf {(e.confidence * 100).toFixed(0)}%
            </div>
          </div>
          <TierPill tier={e.confidence_tier} />
        </div>

        {e.trail && e.trail.length >= 2 && onReplay && (
          <button
            onClick={() => onReplay(e)}
            className="mt-1.5 flex items-center gap-1.5 rounded-md border border-violet-700/50 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-300 hover:bg-violet-500/20"
          >
            <Rewind size={11} /> Shadow ghost replay
          </button>
        )}

        <ConfidenceGauge confidence={e.confidence} tier={e.confidence_tier} />

        {e.event_type === 'loitering' && e.dwell_seconds != null && (
          <div className="mt-2">
            <DwellTimer seconds={e.dwell_seconds} />
          </div>
        )}

        {e.event_type === 'anpr_read' && e.ocr_samples && e.ocr_samples.length > 0 && (
          <div className="mt-2">
            <AnprVotingCard frames={e.ocr_samples} live fullWidth />
          </div>
        )}

        <ReviewActions status={e.status} onConfirm={onConfirm} onDismiss={onDismiss} />
      </div>
    </motion.div>
  )
}

function ClusterCard({ events }: { events: IbvapEvent[] }) {
  const latest = events[0]
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex gap-3 rounded-lg border border-zinc-800/60 border-l-2 border-l-emerald-500/50 bg-zinc-950/30 p-3"
    >
      <EvidenceThumbnail url={latest.evidence_url} className="h-16 w-16 shrink-0 rounded-md border border-zinc-800/60 opacity-70" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
          <Layers size={13} className="text-emerald-500" />
          {EVENT_LABELS[latest.event_type] ?? latest.event_type}
          <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">×{events.length}</span>
        </div>
        <div className="text-xs text-zinc-500">
          {latest.camera_id} · latest {timeAgo(latest.created_at)} · logged silently, low confidence
        </div>
      </div>
    </motion.div>
  )
}

export function AlertQueue({
  events,
  onUpdate,
  onReplay,
}: {
  events: IbvapEvent[]
  onUpdate: (id: number, status: IbvapEvent['status']) => void
  onReplay?: (e: IbvapEvent) => void
}) {
  const items = useMemo(() => groupEvents(events), [events])

  async function handle(id: number, action: 'confirm' | 'dismiss', reason?: string) {
    onUpdate(id, action === 'confirm' ? 'confirmed' : 'dismissed')
    try {
      await reviewEvent(id, action, reason)
    } catch {
      // best-effort optimistic update; a failed request will self-correct on next WS event
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300">Alert queue</div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        <AnimatePresence initial={false}>
          {items.map((item) =>
            item.kind === 'single' ? (
              <AlertCard
                key={item.event.id}
                e={item.event}
                onConfirm={() => handle(item.event.id, 'confirm')}
                onDismiss={(reason) => handle(item.event.id, 'dismiss', reason)}
                onReplay={onReplay}
              />
            ) : (
              <ClusterCard key={`cluster-${item.events[0].id}`} events={item.events} />
            ),
          )}
        </AnimatePresence>
        {events.length === 0 && <div className="p-4 text-sm text-zinc-500">No events yet.</div>}
      </div>
    </div>
  )
}
