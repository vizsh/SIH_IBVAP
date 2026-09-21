/**
 * Real-world coordinates for the only SSB-side sites the reference doc
 * documents as actually camera-equipped (Section 17.1): Panitanki, Raxaul
 * ICP, Jogbani ICP. Demo camera IDs are mapped onto these real places
 * rather than fictional ones, so the map means something.
 */
export interface CameraSite {
  lat: number
  lng: number
  label: string
  // Facing direction (0=N, 90=E, 180=S, 270=W) toward the border line at
  // this checkpoint, and the horizontal field of view of a typical fixed
  // CCTV lens (~75-90 degrees). No PTZ telemetry exists for these demo
  // sites, so these are a documented installation-orientation assumption
  // (border-facing), not a measured/fabricated reading — same honesty
  // stance as the haversine travel-time estimates in camera_sites.py.
  headingDeg: number
  fovDeg: number
  // True only for a dedicated LWIR/thermal-only sentry post — never set on
  // an ordinary RGB camera. No real thermal hardware exists on this
  // platform's actual BOP cameras, so this flag exists specifically to
  // keep a thermal-only post visually and semantically distinct rather
  // than implying every camera can "switch" to thermal.
  isThermal?: boolean
}

export const CAMERA_SITES: Record<string, CameraSite> = {
  'BOP-01': { lat: 26.9598, lng: 88.1852, label: 'Panitanki (Indo-Nepal)', headingDeg: 15, fovDeg: 80 },
  'BOP-Alpha': { lat: 26.9958, lng: 84.8534, label: 'Raxaul ICP (Indo-Nepal)', headingDeg: 340, fovDeg: 80 },
  'BOP-Bravo': { lat: 26.3931, lng: 87.2589, label: 'Jogbani ICP (Indo-Nepal)', headingDeg: 5, fovDeg: 80 },
  'BOP-02': { lat: 26.9598, lng: 88.1852, label: 'Panitanki (Indo-Nepal)', headingDeg: 15, fovDeg: 80 },
  'BOP-TEST2': { lat: 26.9958, lng: 84.8534, label: 'Raxaul ICP (Indo-Nepal)', headingDeg: 340, fovDeg: 80 },
  // Supplementary thermal watchtower near the Jogbani gap — a documented
  // placement choice (real known unfenced-corridor risk area), not a
  // measured GPS fix for actual hardware that doesn't exist.
  'BOP-Sentry-Thermal': { lat: 26.4021, lng: 87.2680, label: 'Jogbani Gap — LWIR Sentry Post', headingDeg: 5, fovDeg: 60, isThermal: true },
}

export function siteFor(cameraId: string): CameraSite {
  return CAMERA_SITES[cameraId] ?? { lat: 26.9598, lng: 88.1852, label: cameraId, headingDeg: 0, fovDeg: 80 }
}

/** Destination point at `bearingDeg`/`distanceM` from (lat, lng) — standard
 * spherical-earth projection, same formula family as the backend's
 * haversine distance calc, just solved for the forward point instead. */
export function destinationPoint(lat: number, lng: number, bearingDeg: number, distanceM: number): [number, number] {
  const R = 6371000
  const bearing = (bearingDeg * Math.PI) / 180
  const lat1 = (lat * Math.PI) / 180
  const lng1 = (lng * Math.PI) / 180
  const angularDist = distanceM / R

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDist) + Math.cos(lat1) * Math.sin(angularDist) * Math.cos(bearing))
  const lng2 =
    lng1 + Math.atan2(Math.sin(bearing) * Math.sin(angularDist) * Math.cos(lat1), Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2))

  return [(lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI]
}

/** Build the FoV cone polygon for a camera: [site, left edge, right edge, site]. */
export function fovConePoints(site: CameraSite, rangeM: number): [number, number][] {
  const half = site.fovDeg / 2
  const left = destinationPoint(site.lat, site.lng, site.headingDeg - half, rangeM)
  const right = destinationPoint(site.lat, site.lng, site.headingDeg + half, rangeM)
  return [[site.lat, site.lng], left, right, [site.lat, site.lng]]
}

/** Same cone, in deck.gl's [lng, lat] winding order for a PolygonLayer,
 * closed (first point repeated at the end). */
export function fovConeLngLat(site: CameraSite, rangeM: number): [number, number][] {
  return fovConePoints(site, rangeM).map(([lat, lng]) => [lng, lat])
}

/** A small square footprint centered at (lat, lng), in deck.gl's [lng, lat]
 * order, closed. Corners placed on the diagonal bearings so the square
 * isn't forced to cardinal alignment — a schematic footprint, not a
 * surveyed building outline. */
function squareFootprint(lat: number, lng: number, halfSizeM: number): [number, number][] {
  const diag = halfSizeM * Math.SQRT2
  const corners = [45, 135, 225, 315].map((b) => destinationPoint(lat, lng, b, diag))
  const ring = corners.map(([la, ln]) => [ln, la] as [number, number])
  return [...ring, ring[0]]
}

export interface CheckpointStructure {
  towerFootprint: [number, number][]
  towerHeight: number
  cabinFootprint: [number, number][]
  cabinHeight: number
  fenceSegments: [number, number][][]
  fenceHeight: number
  gateBar: [[number, number, number], [number, number, number]]
}

/**
 * A procedural, schematic checkpoint structure (watchtower + cabin, a
 * fence line, a gate barrier) computed at the camera's real GPS coordinate
 * — the same haversine projection already used for FoV cones, not an
 * external 3D asset. Deliberately representative, not an as-built scan:
 * no architectural survey exists for these real sites, so this is styled
 * as an operational schematic (like the tactical grid), not a claim of
 * structural accuracy.
 */
export function buildCheckpointStructure(site: CameraSite): CheckpointStructure {
  const TOWER_HALF_M = 4
  const TOWER_HEIGHT_M = 14
  const CABIN_HALF_M = 6
  const CABIN_HEIGHT_M = 5
  const FENCE_HEIGHT_M = 2.5
  const FENCE_HALF_M = 0.6
  const FENCE_SPACING_M = 12
  const FENCE_COUNT = 10
  const FENCE_DISTANCE_M = 25
  const GATE_HALF_WIDTH_M = 6
  const GATE_HEIGHT_M = 3

  const towerFootprint = squareFootprint(site.lat, site.lng, TOWER_HALF_M)
  const cabinFootprint = squareFootprint(site.lat, site.lng, CABIN_HALF_M)

  const perpBearing = (site.headingDeg + 90) % 360
  const [fenceLat, fenceLng] = destinationPoint(site.lat, site.lng, site.headingDeg, FENCE_DISTANCE_M)
  const fenceSegments: [number, number][][] = []
  for (let i = -Math.floor(FENCE_COUNT / 2); i <= Math.floor(FENCE_COUNT / 2); i++) {
    const [plat, plng] = destinationPoint(fenceLat, fenceLng, perpBearing, i * FENCE_SPACING_M)
    fenceSegments.push(squareFootprint(plat, plng, FENCE_HALF_M))
  }

  const [g1lat, g1lng] = destinationPoint(site.lat, site.lng, perpBearing, -GATE_HALF_WIDTH_M)
  const [g2lat, g2lng] = destinationPoint(site.lat, site.lng, perpBearing, GATE_HALF_WIDTH_M)

  return {
    towerFootprint,
    towerHeight: TOWER_HEIGHT_M,
    cabinFootprint,
    cabinHeight: CABIN_HEIGHT_M,
    fenceSegments,
    fenceHeight: FENCE_HEIGHT_M,
    gateBar: [
      [g1lng, g1lat, GATE_HEIGHT_M],
      [g2lng, g2lat, GATE_HEIGHT_M],
    ],
  }
}
