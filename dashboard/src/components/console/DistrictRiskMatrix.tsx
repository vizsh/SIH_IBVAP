import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, MapPin, Plane, ShieldAlert, ShieldCheck } from 'lucide-react'
import { acknowledgeOverflightDispatch, API_BASE, fetchPOIs, type PointOfInterest } from '@/lib/api'
import { computeZoneRisks, shouldRecommendOverflight, type RiskLevel, type ZoneRisk } from '@/lib/riskIndex'
import type { IbvapEvent } from '@/types'

const LEVEL_STYLE: Record<RiskLevel, { border: string; bg: string; text: string; label: string; icon: typeof ShieldCheck; pulse: boolean }> = {
  low: { border: 'border-emerald-800/60', bg: 'bg-emerald-950/20', text: 'text-emerald-400', label: 'LOW RISK', icon: ShieldCheck, pulse: false },
  medium: { border: 'border-amber-800/60', bg: 'bg-amber-950/20', text: 'text-amber-400', label: 'MEDIUM RISK', icon: AlertTriangle, pulse: false },
  critical: { border: 'border-red-700/70', bg: 'bg-red-950/25', text: 'text-red-400', label: 'CRITICAL RISK', icon: ShieldAlert, pulse: true },
}

function ZoneCard({ risk }: { risk: ZoneRisk }) {
  const style = LEVEL_STYLE[risk.riskLevel]
  const Icon = style.icon
  const recommend = shouldRecommendOverflight(risk)
  const [acking, setAcking] = useState(false)
  const [acked, setAcked] = useState(false)

  async function acknowledge() {
    setAcking(true)
    try {
      await acknowledgeOverflightDispatch({
        zone_id: risk.zone.id,
        zone_name: risk.zone.name,
        risk_index: risk.riskIndex,
        coverage_pct: risk.coveragePct,
      })
      setAcked(true)
    } catch {
      // best-effort — the operator can retry; nothing else depends on this succeeding
    } finally {
      setAcking(false)
    }
  }

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} p-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
            <MapPin size={13} className={style.text} />
            {risk.zone.name}
          </div>
          <div className="text-[10px] text-zinc-500">{risk.zone.districtName} district · {risk.zone.terrainLabel}</div>
        </div>
        <span className={`flex shrink-0 items-center gap-1 rounded-full border ${style.border} px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${style.text} ${style.pulse ? 'animate-pulse' : ''}`}>
          <Icon size={10} /> {style.label}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full ${risk.riskLevel === 'critical' ? 'bg-red-500' : risk.riskLevel === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${risk.riskIndex * 100}%` }}
          />
        </div>
        <span className={`font-mono text-sm font-bold ${style.text}`}>{risk.riskIndex.toFixed(2)}</span>
      </div>

      {!risk.hasDistrictData ? (
        <div className="mt-2 text-[10px] text-zinc-600">District boundary unavailable — risk computed on incidents/terrain only.</div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-zinc-500">
          <div>
            Visual coverage: <span className="text-zinc-300">{risk.coveragePct}%</span>
          </div>
          <div>
            District area: <span className="text-zinc-300">{risk.districtAreaKm2.toLocaleString()} km²</span>
          </div>
          <div>
            Incidents (30d): <span className="text-zinc-300">{risk.incidents30d}</span>
          </div>
          <div>
            NAI markings: <span className="text-zinc-300">{risk.naiCount}</span>
          </div>
        </div>
      )}

      {recommend && (
        <div className="mt-3 rounded-lg border border-sky-800/50 bg-sky-950/20 p-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-400">
            <Plane size={11} /> Recommend drone overflight
          </div>
          <div className="mt-1 text-[10px] text-zinc-500">
            Fixed-camera coverage here is thin ({risk.coveragePct}%) relative to the zone's risk — a geo-referenced drone
            pass can close that gap faster than a new fixed install.
          </div>
          {acked ? (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
              <CheckCircle2 size={11} /> Acknowledged — logged to audit trail
            </div>
          ) : (
            <button
              onClick={acknowledge}
              disabled={acking}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-sky-700/60 bg-sky-500/10 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
            >
              <Plane size={11} /> {acking ? 'Logging…' : 'Acknowledge & log dispatch'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * District Zone Risk Index panel — R_Z per the C2 Spatial Risk & Coverage
 * Intelligence Engine doc, computed in lib/riskIndex.ts from real polygon
 * coverage math, real incident counts, and real NAI markings (see that
 * file for the full honesty breakdown of what's real vs. a documented
 * assumption).
 */
export function DistrictRiskMatrix() {
  const [events, setEvents] = useState<IbvapEvent[]>([])
  const [pois, setPois] = useState<PointOfInterest[]>([])

  useEffect(() => {
    function refresh() {
      fetch(`${API_BASE}/events?limit=500`)
        .then((r) => r.json())
        .then(setEvents)
        .catch(() => {})
      fetchPOIs().then(setPois).catch(() => {})
    }
    refresh()
    const interval = setInterval(refresh, 8000)
    window.addEventListener('ibvap:events-refresh', refresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener('ibvap:events-refresh', refresh)
    }
  }, [])

  const risks = computeZoneRisks(events, pois)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-1 text-sm font-semibold text-zinc-200">District Risk &amp; Control Matrix</div>
      <p className="mb-3 text-[11px] text-zinc-500">
        R_Z = 0.45·(incidents ÷ 30d ceiling) + 0.35·(coverage gap) + 0.20·(terrain factor). Coverage is a real polygon
        union of this platform's camera FoV cones intersected with the real district boundary — not an estimate.
        Since this is a freshly-seeded system, the 30-day incident window is mostly empty; that's an honest reflection
        of a new deployment, not a sign of low risk.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {risks.map((r) => (
          <ZoneCard key={r.zone.id} risk={r} />
        ))}
      </div>
    </div>
  )
}
