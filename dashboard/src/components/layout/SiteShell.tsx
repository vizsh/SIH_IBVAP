import { Activity, FileTerminal, Globe, LayoutGrid, Radar, ShieldAlert, Video } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import Particles from '@/components/Particles'
import { AuditTerminalWidget } from '@/components/console/AuditTerminalWidget'
import { Toaster } from '@/components/ui/sonner'
import { useCorrelationWatcher } from '@/hooks/useCorrelationWatcher'

const NAV_ITEMS = [
  { to: '/console', label: 'Command Console', icon: LayoutGrid },
  { to: '/coverage', label: 'Border Coverage', icon: Globe },
  { to: '/live', label: 'Live Feeds & HUD', icon: Video },
  { to: '/correlation', label: 'Cross-BOP Correlation', icon: Radar },
  { to: '/audit', label: 'Security Audit Log', icon: FileTerminal },
  { to: '/analytics', label: 'Analytics & Health', icon: Activity },
]

export function SiteShell() {
  useCorrelationWatcher()

  return (
    <div className="relative min-h-screen bg-[#05070C] text-zinc-200">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40">
        <Particles particleColors={['#22d3ee', '#3f3f46']} particleCount={140} speed={0.05} particleBaseSize={80} moveParticlesOnHover={false} alphaParticles disableRotation />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <aside className="flex w-64 flex-col border-r border-zinc-800/80 bg-black/40 backdrop-blur-md">
          <div className="flex items-center gap-2 border-b border-zinc-800/80 px-5 py-5">
            <ShieldAlert className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" size={22} />
            <div>
              <div className="text-sm font-bold tracking-widest text-zinc-100">IBVAP</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">C2 Console</div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-300 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.3)]'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200',
                  )
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-zinc-800/80 p-4 text-[10px] text-zinc-600">
            PS 26187 · MHA — SSB, Police II Division
            <br />
            Prototype build · offline-capable edge design
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <Toaster position="top-center" />
      <AuditTerminalWidget />
    </div>
  )
}
