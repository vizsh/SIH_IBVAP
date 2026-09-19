import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { API_BASE } from '@/lib/api'
import { FenceEditor } from '@/components/console/FenceEditor'
import type { IbvapEvent } from '@/types'

const KNOWN_CAMERAS = ['BOP-01', 'BOP-Alpha', 'BOP-Bravo']

export default function ZoneConfigPage() {
  const [cameras, setCameras] = useState<string[]>(KNOWN_CAMERAS)
  const [selected, setSelected] = useState('BOP-01')

  useEffect(() => {
    fetch(`${API_BASE}/events?limit=200`)
      .then((r) => r.json())
      .then((events: IbvapEvent[]) => {
        setCameras((prev) => Array.from(new Set([...prev, ...events.map((e) => e.camera_id)])))
      })
      .catch(() => {})
  }, [])

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-zinc-100">Zone Configuration</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Per-camera virtual-fence geometry, drawn against that camera's own feed — replaces the single hardcoded default polygon every
          camera used to share.
        </p>
      </header>

      <div className="mb-4 flex items-center gap-2">
        <ShieldAlert size={14} className="text-cyan-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Camera</span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-600 focus:outline-none"
        >
          {cameras.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <FenceEditor key={selected} cameraId={selected} />
      </div>
    </div>
  )
}
