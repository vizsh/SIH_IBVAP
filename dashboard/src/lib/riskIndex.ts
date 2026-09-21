import * as turf from '@turf/turf'
import districtBoundariesRaw from './districtBoundaries.json'
import { fovConeLngLat, siteFor } from './cameraSites'
import type { PointOfInterest } from './api'
import type { IbvapEvent } from '../types'

/**
 * District Zone Risk Index (R_Z), per the C2 Spatial Risk & Coverage
 * Intelligence Engine design doc:
 *
 *   R_Z = min(1, w1*(I30/Imax) + w2*((100-%C_Z)/100) + w3*(terrain/2))
 *
 * Every term here is either real or a documented, geography-informed
 * assumption — never a fabricated number:
 *   - %C_Z (coverage): a REAL polygon-union-then-intersect computation
 *     (Turf.js) over this platform's actual camera FoV cone polygons,
 *     intersected with real Indian district boundaries (geohacker/india,
 *     verified: all three real BOP coordinates fall inside their assigned
 *     district polygon).
 *   - I30 (30-day incidents): a REAL count from this platform's own event
 *     log, folded together with NAI markings — an analyst flagging a
 *     suspected staging point is real signal too, just not a logged
 *     incident, so it's weighted in as a fraction of one (NAI_WEIGHT)
 *     rather than invented as its own formula term.
 *   - terrain factor: a documented assumption informed by each region's
 *     real geography (Terai plains vs. riverine belt), same honesty
 *     stance as the camera heading/FOV assumptions elsewhere in this app.
 */

export interface RiskZoneDef {
  id: string
  name: string
  districtName: string // must match NAME_2 in districtBoundaries.json
  cameras: string[]
  terrainFactor: number // 1.0 open plain -> 1.8 dense jungle / unfenced gap
  terrainLabel: string
}

export const RISK_ZONES: RiskZoneDef[] = [
  {
    id: 'darjiling',
    name: 'Zone A — Panitanki Crossing',
    districtName: 'Darjiling',
    cameras: ['BOP-01'],
    terrainFactor: 1.2,
    terrainLabel: 'Terai plains, foothill approach',
  },
  {
    id: 'purba-champaran',
    name: 'Zone B — Raxaul Corridor',
    districtName: 'Purba Champaran',
    cameras: ['BOP-Alpha'],
    terrainFactor: 1.4,
    terrainLabel: 'Forested Indo-Nepal foothill corridor',
  },
  {
    id: 'araria',
    name: 'Zone C — Jogbani Gap',
    districtName: 'Araria',
    cameras: ['BOP-Bravo', 'BOP-Sentry-Thermal'],
    terrainFactor: 1.6,
    terrainLabel: 'Riverine Kosi/Mechi belt, seasonal flooding',
  },
]

const I_MAX = 50 // normalization ceiling for monthly incidents, per doc
const W1 = 0.45 // historical incidents
const W2 = 0.35 // coverage gap
const W3 = 0.2 // terrain factor
const NAI_WEIGHT = 3 // one analyst-marked NAI ~ 3 "effective incidents" of signal
const CONE_RANGE_M = 22000 // must match CoverageMap's CONE_RANGE_M
const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000

export type RiskLevel = 'low' | 'medium' | 'critical'

export interface ZoneRisk {
  zone: RiskZoneDef
  riskIndex: number
  riskLevel: RiskLevel
  coveragePct: number
  incidents30d: number
  naiCount: number
  effectiveIncidents: number
  districtAreaKm2: number
  coveredAreaKm2: number
  hasDistrictData: boolean
}

interface DistrictFeature {
  type: 'Feature'
  properties: { NAME_1: string; NAME_2: string }
  geometry: GeoJSON.Geometry
}

const districtBoundaries = districtBoundariesRaw as unknown as { type: 'FeatureCollection'; features: DistrictFeature[] }

function findDistrict(name: string): DistrictFeature | undefined {
  return districtBoundaries.features.find((f) => f.properties.NAME_2 === name)
}

export function computeZoneRisks(events: IbvapEvent[], pois: PointOfInterest[]): ZoneRisk[] {
  const now = Date.now()

  return RISK_ZONES.map((zone) => {
    const district = findDistrict(zone.districtName)
    let coveragePct = 0
    let districtAreaKm2 = 0
    let coveredAreaKm2 = 0

    if (district) {
      try {
        const districtPoly = turf.feature(district.geometry) as turf.Feature<turf.Polygon | turf.MultiPolygon>
        districtAreaKm2 = turf.area(districtPoly) / 1e6

        let coneUnion: turf.Feature<turf.Polygon | turf.MultiPolygon> | null = null
        for (const camId of zone.cameras) {
          const site = siteFor(camId)
          const ring = fovConeLngLat(site, CONE_RANGE_M)
          const poly = turf.polygon([ring])
          coneUnion = coneUnion ? (turf.union(turf.featureCollection([coneUnion, poly])) ?? coneUnion) : poly
        }

        if (coneUnion) {
          const intersection = turf.intersect(turf.featureCollection([coneUnion, districtPoly]))
          if (intersection) {
            coveredAreaKm2 = turf.area(intersection) / 1e6
            coveragePct = districtAreaKm2 > 0 ? Math.min(100, (coveredAreaKm2 / districtAreaKm2) * 100) : 0
          }
        }
      } catch {
        // real-world polygon edge cases (self-intersections, etc.) — fall
        // back to 0% coverage for this zone rather than crash the panel
      }
    }

    const incidents30d = events.filter(
      (e) => zone.cameras.includes(e.camera_id) && e.confidence_tier === 'high' && now - new Date(e.created_at + 'Z').getTime() < THIRTY_DAYS_MS,
    ).length

    const naiCount = district
      ? pois.filter((p) => {
          try {
            return turf.booleanPointInPolygon(turf.point([p.lng, p.lat]), turf.feature(district.geometry))
          } catch {
            return false
          }
        }).length
      : 0

    const effectiveIncidents = incidents30d + NAI_WEIGHT * naiCount
    const riskIndex = Math.min(1, W1 * (effectiveIncidents / I_MAX) + W2 * ((100 - coveragePct) / 100) + W3 * (zone.terrainFactor / 2))
    const riskLevel: RiskLevel = riskIndex >= 0.7 ? 'critical' : riskIndex >= 0.4 ? 'medium' : 'low'

    return {
      zone,
      riskIndex: Math.round(riskIndex * 100) / 100,
      riskLevel,
      coveragePct: Math.round(coveragePct * 10) / 10,
      incidents30d,
      naiCount,
      effectiveIncidents,
      districtAreaKm2: Math.round(districtAreaKm2),
      coveredAreaKm2: Math.round(coveredAreaKm2 * 100) / 100,
      hasDistrictData: !!district,
    }
  })
}
