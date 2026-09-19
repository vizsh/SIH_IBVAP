import { useState } from 'react'
import { AlertQueue } from '@/components/AlertQueue'
import { StatBar } from '@/components/StatBar'
import { StatusBadge } from '@/components/StatusBadge'
import { VideoPane } from '@/components/VideoPane'
import { AuditPreviewCard } from '@/components/console/AuditPreviewCard'
import { EscalationPipeline } from '@/components/console/EscalationPipeline'
import { HardwareHealthBar } from '@/components/console/HardwareHealthBar'
import { NetworkKillSwitch } from '@/components/console/NetworkKillSwitch'
import { BentoGrid } from '@/components/ui/bento-grid'
import ShinyText from '@/components/ShinyText'
import { useLiveEvents } from '@/hooks/useLiveEvents'
import type { IbvapEvent } from '@/types'

export default function ConsolePage() {
  const { events, setEvents, connState } = useLiveEvents()
  const [bufferedCount, setBufferedCount] = useState(0)
  const [replayEvent, setReplayEvent] = useState<IbvapEvent | null>(null)

  function onUpdate(id: number, status: IbvapEvent['status']) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)))
  }

  return (
    <div>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <ShinyText
            text="[ LIVE EDGE FEED: PANITANKI BOP-104 ]"
            speed={4}
            color="#a1a1aa"
            shineColor="#22d3ee"
            className="text-sm font-semibold tracking-wide"
          />
          <p className="mt-1 text-xs text-zinc-500">IBVAP Command Console — confidence-gated review, Sector 4</p>
        </div>
        <StatusBadge state={connState} />
      </header>

      <div className="mb-4">
        <StatBar events={events} />
      </div>

      <div className="mb-4">
        <EscalationPipeline events={events} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <div className="h-[420px]">
            <VideoPane replayEvent={replayEvent} onCloseReplay={() => setReplayEvent(null)} />
          </div>
          <BentoGrid className="max-w-none gap-4 md:auto-rows-[9.5rem] md:grid-cols-3">
            <div className="h-full md:col-span-1">
              <HardwareHealthBar connState={connState} bufferedCount={bufferedCount} />
            </div>
            <div className="h-full md:col-span-1">
              <NetworkKillSwitch onBufferedChange={setBufferedCount} />
            </div>
            <div className="h-full md:col-span-1">
              <AuditPreviewCard />
            </div>
          </BentoGrid>
        </div>
        <div className="col-span-1 h-[560px]">
          <AlertQueue events={events} onUpdate={onUpdate} onReplay={setReplayEvent} />
        </div>
      </div>
    </div>
  )
}
