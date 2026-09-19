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
}

export const CAMERA_SITES: Record<string, CameraSite> = {
  'BOP-01': { lat: 26.9598, lng: 88.1852, label: 'Panitanki (Indo-Nepal)', headingDeg: 15, fovDeg: 80 },
  'BOP-Alpha': { lat: 26.9958, lng: 84.8534, label: 'Raxaul ICP (Indo-Nepal)', headingDeg: 340, fovDeg: 80 },
  'BOP-Bravo': { lat: 26.3931, lng: 87.2589, label: 'Jogbani ICP (Indo-Nepal)', headingDeg: 5, fovDeg: 80 },
  'BOP-02': { lat: 26.9598, lng: 88.1852, label: 'Panitanki (Indo-Nepal)', headingDeg: 15, fovDeg: 80 },
  'BOP-TEST2': { lat: 26.9958, lng: 84.8534, label: 'Raxaul ICP (Indo-Nepal)', headingDeg: 340, fovDeg: 80 },
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
