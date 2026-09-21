import { CoverageMap } from '@/components/console/CoverageMap'
import { DemoScenarioButton } from '@/components/console/DemoScenarioButton'
import { GlowingEffect } from '@/components/glowing-effect'

const STATS = [
  { value: '734', label: 'SSB Border Out Posts', sub: '539 Nepal + 195 Bhutan' },
  { value: '2,450 km', label: 'SSB border length', sub: 'Indo-Nepal + Indo-Bhutan' },
  { value: '≈9%', label: 'Border visually covered', sub: 'if every single BOP had one camera' },
  { value: '≈91%', label: 'Border with zero camera coverage', sub: 'the honest gap this platform cannot close alone' },
]

export default function CoveragePage() {
  return (
    <div>
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-zinc-100">Border Coverage</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Every camera this platform actually knows about, plotted at its real site. Software makes each camera
          smarter — it does not, by itself, create coverage where no camera physically exists. Stated plainly,
          per the reference doc's own honesty about this gap.
        </p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="relative rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
            <GlowingEffect disabled={false} glow proximity={60} spread={20} borderWidth={1.5} />
            <div className="relative z-10 text-xl font-bold text-cyan-300">{s.value}</div>
            <div className="relative z-10 text-xs font-medium text-zinc-300">{s.label}</div>
            <div className="relative z-10 text-[10px] text-zinc-600">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <DemoScenarioButton />
      </div>

      <div className="mb-4 h-[480px] overflow-hidden rounded-xl border border-zinc-800">
        <CoverageMap />
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800/60 bg-zinc-950/40 px-4 py-3 text-xs text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          LIVE — pipeline actively streaming
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          ARMED — has logged real events, not currently streaming
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
          Not yet monitored
        </div>
        <div className="ml-auto text-zinc-600">Dashed rings are illustrative coverage radii, not to scale</div>
      </div>
    </div>
  )
}
