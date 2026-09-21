import { useState } from 'react'
import { Car, Clock, Radar, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { postDemoEvent } from '@/lib/api'
import { triggerEventsRefresh } from '@/lib/refreshEvents'
import { CAMERA_SITES } from '@/lib/cameraSites'

type ScenarioType = 'intrusion' | 'loitering' | 'anpr'

interface ScenarioDef {
  label: string
  icon: typeof Radar
  cameras: string[]
  color: string // tailwind color stem, e.g. "red"
  build: (camera: string) => Record<string, unknown>
  successText: (camera: string) => { title: string; description: string }
}

// A single fabricated-but-plausible plate + a small real-shaped voting
// matrix (frame/timestamp/reading/confidence, one row deliberately noisy)
// so the ANPR demo renders the real AnprVotingCard fusion UI, not a bare
// string — same shape the edge pipeline's real ocr_samples use.
function demoOcrSamples() {
  const now = Date.now() / 1000
  return [
    { frame: 401, timestamp: now, reading: 'HR26AB1234', confidence: 0.88 },
    { frame: 404, timestamp: now + 0.1, reading: 'HR26AB123A', confidence: 0.52 },
    { frame: 407, timestamp: now + 0.2, reading: 'HR26AB1234', confidence: 0.94 },
    { frame: 410, timestamp: now + 0.3, reading: 'HR26AB1234', confidence: 0.91 },
    { frame: 413, timestamp: now + 0.4, reading: 'HR268B1234', confidence: 0.49 },
  ]
}

const SCENARIOS: Record<ScenarioType, ScenarioDef> = {
  intrusion: {
    label: 'Virtual-fence intrusion',
    icon: Radar,
    cameras: ['BOP-Bravo', 'BOP-01', 'BOP-Sentry-Thermal'],
    color: 'red',
    build: (camera) => ({
      camera_id: camera,
      event_type: 'virtual_fence_intrusion',
      confidence: 0.97,
      zone_id: 'zone-A',
      detail: `DEMONSTRATION TRIGGER — scripted showcase event for presentation purposes (${CAMERA_SITES[camera]?.label ?? camera}), not a real physical intrusion`,
    }),
    successText: (camera) => ({
      title: `Target confirmed — ${camera}, 97% confidence`,
      description: 'Watch the map: cone locks red, camera flies to target, reticle engages.',
    }),
  },
  loitering: {
    label: 'Loitering / dwell-time',
    icon: Clock,
    cameras: ['BOP-01', 'BOP-Bravo'],
    color: 'amber',
    build: (camera) => ({
      camera_id: camera,
      event_type: 'loitering',
      confidence: 0.95,
      dwell_seconds: 47,
      detail: `DEMONSTRATION TRIGGER — scripted showcase of loitering detection (${CAMERA_SITES[camera]?.label ?? camera}), not a real physical intrusion`,
    }),
    successText: (camera) => ({
      title: `Loitering confirmed — ${camera}, 47s dwell`,
      description: 'Check the Alert Queue: dwell timer and confidence gauge render on the card.',
    }),
  },
  anpr: {
    label: 'ANPR multi-frame fusion',
    icon: Car,
    cameras: ['BOP-Alpha'],
    color: 'cyan',
    build: (camera) => ({
      camera_id: camera,
      event_type: 'anpr_read',
      confidence: 0.91,
      plate_text: 'HR26AB1234',
      detail: `DEMONSTRATION TRIGGER — scripted showcase of multi-frame ANPR fusion (${CAMERA_SITES[camera]?.label ?? camera}), not a real physical reading`,
      ocr_samples: demoOcrSamples(),
    }),
    successText: (camera) => ({
      title: `Plate resolved — HR26AB1234, ${camera}`,
      description: 'Check the Alert Queue: the frame-by-frame voting matrix renders live.',
    }),
  },
}

const COLOR_CLASSES: Record<string, { border: string; bg: string; text: string; btnBorder: string; btnBg: string; btnHover: string }> = {
  red: { border: 'border-red-900/40', bg: 'bg-red-950/10', text: 'text-red-300', btnBorder: 'border-red-600/60', btnBg: 'bg-red-500/15', btnHover: 'hover:bg-red-500/25' },
  amber: { border: 'border-amber-900/40', bg: 'bg-amber-950/10', text: 'text-amber-300', btnBorder: 'border-amber-600/60', btnBg: 'bg-amber-500/15', btnHover: 'hover:bg-amber-500/25' },
  cyan: { border: 'border-cyan-900/40', bg: 'bg-cyan-950/10', text: 'text-cyan-300', btnBorder: 'border-cyan-600/60', btnBg: 'bg-cyan-500/15', btnHover: 'hover:bg-cyan-500/25' },
}

/**
 * A scripted showcase trigger for presentations — same honesty pattern as
 * the existing "Simulate log modification" / "Simulate offline BOP"
 * controls elsewhere in this dashboard: clearly labeled as a demo action,
 * but it posts a REAL event through the real /events contract (audit-
 * logged, confidence-tiered, WS-broadcast) rather than faking client-side
 * UI state. Every downstream effect — the map's flyTo, cone flip, target
 * reticle, alert queue entry, ANPR voting matrix — is the platform's own
 * real reaction to a real (if operator-triggered) event, not a separate
 * demo-only code path.
 */
export function DemoScenarioButton() {
  const [scenarioType, setScenarioType] = useState<ScenarioType>('intrusion')
  const scenario = SCENARIOS[scenarioType]
  const [camera, setCamera] = useState(scenario.cameras[0])
  const [status, setStatus] = useState<'idle' | 'dispatching' | 'cooldown'>('idle')
  const c = COLOR_CLASSES[scenario.color]
  const Icon = scenario.icon

  function selectScenario(next: ScenarioType) {
    setScenarioType(next)
    setCamera(SCENARIOS[next].cameras[0])
  }

  async function runScenario() {
    if (status !== 'idle') return
    setStatus('dispatching')
    toast.message(`Dispatching demo ${scenario.label.toLowerCase()} — ${camera}…`, { duration: 1500 })

    try {
      await postDemoEvent(scenario.build(camera))
      triggerEventsRefresh()
      const { title, description } = scenario.successText(camera)
      toast.success(title, { description, duration: 5000 })
    } catch {
      toast.error('Demo trigger failed — is the backend reachable?')
    } finally {
      setStatus('cooldown')
      window.setTimeout(() => setStatus('idle'), 6000)
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border ${c.border} ${c.bg} px-3 py-2`}>
      <Icon size={14} className={`shrink-0 ${c.text}`} />
      <div className="flex flex-col">
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${c.text}`}>Live scenario demo</span>
        <span className="text-[10px] text-zinc-500">Fires a real, audit-logged event to showcase the full detection flow</span>
      </div>

      <div className="ml-2 flex overflow-hidden rounded-md border border-zinc-700">
        {(Object.keys(SCENARIOS) as ScenarioType[]).map((key) => (
          <button
            key={key}
            onClick={() => selectScenario(key)}
            disabled={status !== 'idle'}
            className={`px-2 py-1 text-[10px] font-medium uppercase tracking-wide disabled:opacity-50 ${
              scenarioType === key ? `${COLOR_CLASSES[SCENARIOS[key].color].bg} ${COLOR_CLASSES[SCENARIOS[key].color].text}` : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'
            }`}
          >
            {SCENARIOS[key].label.split(' ')[0]}
          </button>
        ))}
      </div>

      <select
        value={camera}
        onChange={(e) => setCamera(e.target.value)}
        disabled={status !== 'idle'}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:outline-none disabled:opacity-50"
      >
        {scenario.cameras.map((cam) => (
          <option key={cam} value={cam}>
            {cam}
          </option>
        ))}
      </select>

      <button
        onClick={runScenario}
        disabled={status !== 'idle'}
        className={`ml-auto flex items-center gap-1.5 rounded-md border ${c.btnBorder} ${c.btnBg} px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${c.text} ${c.btnHover} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <Zap size={12} />
        {status === 'dispatching' ? 'Dispatching…' : status === 'cooldown' ? 'Cooling down…' : `Simulate ${scenario.label.toLowerCase()}`}
      </button>
    </div>
  )
}
