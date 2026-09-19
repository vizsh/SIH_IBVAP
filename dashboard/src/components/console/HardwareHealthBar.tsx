import { Cpu, Gauge, Inbox } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import type { ConnState } from '@/hooks/useLiveEvents'
import { useMetricHistory } from '@/hooks/useMetricHistory'

function Sparkline({ data, dataKey, color, domain }: { data: unknown[]; dataKey: string; color: string; domain: [number, number] }) {
  return (
    <div className="h-8 w-16 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <YAxis domain={domain} hide />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.15} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function HardwareHealthBar({ connState, bufferedCount }: { connState: ConnState; bufferedCount: number }) {
  const history = useMetricHistory(connState)
  const latest = history[history.length - 1]

  return (
    <div className="flex h-full flex-col justify-center gap-2.5 rounded-xl border border-zinc-800/80 bg-black/30 px-4 py-3 text-xs text-zinc-400 backdrop-blur-sm">
      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Hardware health</div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Cpu size={13} className="text-cyan-400" /> Edge GPU:{' '}
          <span className="text-zinc-200">{latest ? `${latest.gpu.toFixed(0)}%` : '—'}</span>
        </div>
        <Sparkline data={history} dataKey="gpu" color="#22d3ee" domain={[0, 100]} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Gauge size={13} className="text-cyan-400" /> Latency:{' '}
          <span className="text-zinc-200">{latest ? `${latest.latency.toFixed(0)}ms` : '—'}</span>
        </div>
        <Sparkline data={history} dataKey="latency" color="#a78bfa" domain={[80, 230]} />
      </div>

      <div className="flex items-center gap-1.5">
        <Inbox size={13} className={bufferedCount > 0 ? 'text-amber-400' : 'text-cyan-400'} /> Buffer:{' '}
        <span className={bufferedCount > 0 ? 'text-amber-300' : 'text-zinc-200'}>{bufferedCount} msg</span>
      </div>
    </div>
  )
}
