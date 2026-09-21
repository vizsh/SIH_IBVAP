import { useState } from 'react'
import { Radar, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { postDemoEvent } from '@/lib/api'
import { triggerEventsRefresh } from '@/lib/refreshEvents'
import { CAMERA_SITES } from '@/lib/cameraSites'

const SCENARIO_CAMERAS = ['BOP-Bravo', 'BOP-01', 'BOP-Alpha', 'BOP-Sentry-Thermal']

/**
 * A scripted showcase trigger for presentations — same honesty pattern as
 * the existing "Simulate log modification" / "Simulate offline BOP"
 * controls elsewhere in this dashboard: clearly labeled as a demo action,
 * but it posts a REAL event through the real /events contract (audit-
 * logged, confidence-tiered, WS-broadcast) rather than faking client-side
 * UI state. Every downstream effect — the map's flyTo, cone flip, target
 * reticle, alert queue entry — is the platform's own real reaction to a
 * real (if operator-triggered) event, not a separate demo-only code path.
 */
export function DemoScenarioButton() {
  const [camera, setCamera] = useState('BOP-Bravo')
  const [status, setStatus] = useState<'idle' | 'dispatching' | 'cooldown'>('idle')

  async function runScenario() {
    if (status !== 'idle') return
    setStatus('dispatching')
    toast.message(`Dispatching demo intrusion — ${camera}…`, { duration: 1500 })

    try {
      const site = CAMERA_SITES[camera]
      await postDemoEvent({
        camera_id: camera,
        event_type: 'virtual_fence_intrusion',
        confidence: 0.97,
        zone_id: 'zone-A',
        detail: `DEMONSTRATION TRIGGER — scripted showcase event for presentation purposes (${site?.label ?? camera}), not a real physical intrusion`,
      })
      triggerEventsRefresh()
      toast.success(`Target confirmed — ${camera}, 97% confidence`, {
        description: 'Watch the map: cone locks red, camera flies to target, reticle engages.',
        duration: 5000,
      })
    } catch {
      toast.error('Demo trigger failed — is the backend reachable?')
    } finally {
      setStatus('cooldown')
      window.setTimeout(() => setStatus('idle'), 6000)
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-red-900/40 bg-red-950/10 px-3 py-2">
      <Radar size={14} className="shrink-0 text-red-400" />
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-red-300">Live scenario demo</span>
        <span className="text-[10px] text-zinc-500">Fires a real, audit-logged event to showcase the full detection flow</span>
      </div>
      <select
        value={camera}
        onChange={(e) => setCamera(e.target.value)}
        disabled={status !== 'idle'}
        className="ml-2 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-red-600 focus:outline-none disabled:opacity-50"
      >
        {SCENARIO_CAMERAS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button
        onClick={runScenario}
        disabled={status !== 'idle'}
        className="ml-auto flex items-center gap-1.5 rounded-md border border-red-600/60 bg-red-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-300 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Zap size={12} />
        {status === 'dispatching' ? 'Dispatching…' : status === 'cooldown' ? 'Cooling down…' : 'Simulate live intrusion'}
      </button>
    </div>
  )
}
