/**
 * Pixel-to-ground-GPS projection for a moving (drone-mounted) camera — a
 * direct TypeScript port of edge/geo_projection.py's pinhole ray-cast to a
 * flat local ground plane. Kept in lockstep with that module by hand (no
 * shared runtime between the Python edge process and this dashboard), so
 * the map draws the exact same footprint shape the edge pipeline's own
 * geo-fence check reasons about, not an approximation.
 *
 * Same documented simplifications as the Python original: ENU frame
 * (X=East, Y=North, Z=Up), gimbal_pitch 0=nadir / 90=level, zero roll
 * (gimbal auto-stabilized), flat local ground plane (no DEM), rectilinear
 * lens (no distortion).
 */

export interface DroneState {
  lat: number
  lng: number
  altM: number
  headingDeg: number
  gimbalPitchDeg: number // 0=nadir (straight down), 90=level/horizon
}

export interface CameraIntrinsics {
  hfovDeg: number
  vfovDeg: number
}

type Vec3 = [number, number, number]

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / len, v[1] / len, v[2] / len]
}

function cameraBasis(drone: DroneState): { forward: Vec3; right: Vec3; up: Vec3 } {
  const h = (drone.headingDeg * Math.PI) / 180
  const p = (drone.gimbalPitchDeg * Math.PI) / 180
  const forwardYawed: Vec3 = [Math.sin(h), Math.cos(h), 0]
  const rightYawed: Vec3 = [Math.cos(h), -Math.sin(h), 0]
  const sp = Math.sin(p)
  const cp = Math.cos(p)
  const forward: Vec3 = [forwardYawed[0] * sp, forwardYawed[1] * sp, -cp]
  const up: Vec3 = [forwardYawed[0] * cp, forwardYawed[1] * cp, sp]
  return { forward, right: rightYawed, up }
}

/** Ray direction (ENU, normalized) for a normalized image-plane pixel (u,v), u/v in 0-1. */
export function pixelRayDirection(drone: DroneState, cam: CameraIntrinsics, u: number, v: number): Vec3 {
  const { forward, right, up } = cameraBasis(drone)
  const angleH = ((u - 0.5) * cam.hfovDeg * Math.PI) / 180
  const angleV = ((0.5 - v) * cam.vfovDeg * Math.PI) / 180
  const th = Math.tan(angleH)
  const tv = Math.tan(angleV)
  return normalize([forward[0] + th * right[0] + tv * up[0], forward[1] + th * right[1] + tv * up[1], forward[2] + th * right[2] + tv * up[2]])
}

/** Ground GPS for pixel (u,v), or null if the ray never hits the ground plane (e.g. level flight). */
export function pixelToGps(drone: DroneState, cam: CameraIntrinsics, u: number, v: number): [number, number] | null {
  const ray = pixelRayDirection(drone, cam, u, v)
  if (ray[2] >= -1e-6) return null
  const t = -drone.altM / ray[2]
  const eastM = t * ray[0]
  const northM = t * ray[1]
  const dLat = northM / 111_320
  const dLng = eastM / (111_320 * Math.cos((drone.lat * Math.PI) / 180))
  return [drone.lat + dLat, drone.lng + dLng]
}

/**
 * The camera's real ground footprint — the four image corners projected to
 * ground, in deck.gl's [lng, lat] winding order, closed. Returns null if
 * any corner doesn't intersect the ground plane (steep/level gimbal), since
 * a partial footprint would misrepresent what the camera actually covers.
 */
export function droneFootprintLngLat(drone: DroneState, cam: CameraIntrinsics): [number, number][] | null {
  const corners: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]
  const ring: [number, number][] = []
  for (const [u, v] of corners) {
    const g = pixelToGps(drone, cam, u, v)
    if (!g) return null
    ring.push([g[1], g[0]])
  }
  ring.push(ring[0])
  return ring
}
