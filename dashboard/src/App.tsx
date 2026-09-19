import { AlertQueue } from './components/AlertQueue'
import { StatBar } from './components/StatBar'
import { StatusBadge } from './components/StatusBadge'
import { VideoPane } from './components/VideoPane'
import { useLiveEvents } from './hooks/useLiveEvents'
import type { IbvapEvent } from './types'

export default function App() {
  const { events, setEvents, connState } = useLiveEvents()

  function onUpdate(id: number, status: IbvapEvent['status']) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)))
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">IBVAP Command Dashboard</h1>
          <p className="text-sm text-zinc-500">Intelligent Border Video Analytics Platform</p>
        </div>
        <StatusBadge state={connState} />
      </header>

      <div className="mb-6">
        <StatBar events={events} />
      </div>

      <div className="grid h-[calc(100vh-220px)] grid-cols-3 gap-4">
        <div className="col-span-2">
          <VideoPane />
        </div>
        <div className="col-span-1">
          <AlertQueue events={events} onUpdate={onUpdate} />
        </div>
      </div>
    </div>
  )
}
