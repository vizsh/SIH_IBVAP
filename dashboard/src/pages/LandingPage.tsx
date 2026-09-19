import { ArrowRight, Lock, Radar, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import DotGrid from '@/components/DotGrid'
import ShinyText from '@/components/ShinyText'

const PILLARS = [
  {
    icon: Radar,
    title: 'Software on existing CCTV',
    body: 'No new cameras, radars, or FRS appliances — a fusion layer that extracts intelligence from IP feeds SSB already has.',
  },
  {
    icon: ShieldCheck,
    title: 'Confidence-gated, never overclaiming',
    body: 'Deterministic geometry for virtual-fence and loitering; every ML-derived alert is routed to a human at the right tier.',
  },
  {
    icon: Lock,
    title: 'Tamper-evident by design',
    body: 'A SHA-256 hash-chained audit ledger for every alert, review and access — the Blockchain & Cybersecurity theme, built in.',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070C] text-zinc-200">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <DotGrid baseColor="#1e293b" activeColor="#22d3ee" proximity={140} gap={28} dotSize={3} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 rounded-full border border-cyan-500/30 bg-cyan-500/5 px-4 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-300">
          PS 26187 · MHA — SSB, Police II Division
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-zinc-50 sm:text-6xl">
          <ShinyText text="IBVAP" speed={3} color="#e4e4e7" shineColor="#22d3ee" className="text-6xl font-extrabold sm:text-7xl" />
          <div className="mt-3 text-2xl font-medium text-zinc-400 sm:text-3xl">
            Intelligent Border Video Analytics Platform
          </div>
        </h1>

        <p className="mt-6 max-w-2xl text-balance text-base text-zinc-400">
          A software fusion layer that turns SSB's existing CCTV network into an AI-driven surveillance
          platform — detection, ANPR, virtual fencing, and alerting — without buying a single new camera.
        </p>

        <button
          onClick={() => navigate('/login')}
          className="group mt-10 flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-6 py-3 text-sm font-semibold text-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.15)] transition-all hover:bg-cyan-500/20 hover:shadow-[0_0_32px_rgba(34,211,238,0.3)]"
        >
          Enter Command Console
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
        </button>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-5 text-left backdrop-blur-sm transition-colors hover:border-cyan-500/30"
            >
              <Icon size={20} className="mb-3 text-cyan-400" />
              <div className="text-sm font-semibold text-zinc-100">{title}</div>
              <div className="mt-1.5 text-xs leading-relaxed text-zinc-500">{body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
