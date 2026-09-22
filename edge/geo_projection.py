"""
Pixel-to-ground-GPS projection for a moving (drone-mounted) camera.

Why this exists: every zone/loitering check elsewhere in this codebase
(edge/pipeline.py) assumes a FIXED camera, so "is this pixel inside the
fence" is a static polygon-in-pixel-space test drawn once at startup. A
drone's camera moves every frame, so that assumption breaks completely —
the fence has to live in real-world GPS coordinates instead, and each
detection's PIXEL position has to be converted to a real-world GPS
estimate before it can be checked against that fence. That conversion is
what this module does.

Method: a standard pinhole-camera ray cast, intersected with a flat local
ground plane. Explicit, deliberate simplifications (documented so nobody
mistakes this for full photogrammetry):
  - The ground is treated as flat at a constant elevation under the
    drone's current position (no terrain/DEM model — same honesty stance
    as the "tactical grid" on the 3D map not claiming real elevation).
  - No lens distortion correction (rectilinear pinhole model).
  - Gimbal roll is assumed zero (true for the overwhelming majority of
    real drone footage — gimbals auto-stabilize roll).
  - Small-area flat-Earth meters<->degrees conversion, same convention
    already used in dashboard/src/lib/cameraSites.ts and
    backend/app/camera_sites.py, valid at the sub-few-km scale a single
    drone sortie covers.

Coordinate frame: local East-North-Up (ENU) centered on the drone's
current horizontal position, at each frame. X=East, Y=North, Z=Up.
"""

import math
from dataclasses import dataclass


@dataclass
class DroneState:
    """Real-time drone telemetry — what a real flight controller (MAVLink,
    DJI SDK) streams. lat/lng/alt_m describe the drone's own position;
    heading_deg/gimbal_pitch_deg describe where the camera is looking."""

    lat: float
    lng: float
    alt_m: float  # height above the local ground plane, not sea level
    heading_deg: float  # drone yaw, compass convention: 0=N, 90=E, clockwise
    gimbal_pitch_deg: float  # 0 = straight down (nadir), 90 = level/horizon


@dataclass
class CameraIntrinsics:
    hfov_deg: float
    vfov_deg: float


def _camera_basis(drone: DroneState) -> tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]:
    """Camera forward/right/up unit vectors in local ENU, built from
    heading (yaw around Up) then gimbal pitch (tilt around the yawed
    right axis) — roll assumed zero. See module docstring for the
    derivation; each branch below is independently sanity-checked in
    tools/test_geo_projection.py."""
    h = math.radians(drone.heading_deg)
    p = math.radians(drone.gimbal_pitch_deg)

    # Horizontal forward/right after yaw, before any pitch tilt.
    forward_yawed = (math.sin(h), math.cos(h), 0.0)  # points toward heading
    right_yawed = (math.cos(h), -math.sin(h), 0.0)  # 90 deg clockwise of forward

    sp, cp = math.sin(p), math.cos(p)
    forward = (forward_yawed[0] * sp, forward_yawed[1] * sp, -cp)
    up = (forward_yawed[0] * cp, forward_yawed[1] * cp, sp)
    right = right_yawed
    return forward, right, up


def _normalize(v: tuple[float, float, float]) -> tuple[float, float, float]:
    n = math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
    if n < 1e-12:
        return (0.0, 0.0, 0.0)
    return (v[0] / n, v[1] / n, v[2] / n)


def pixel_ray_direction(drone: DroneState, cam: CameraIntrinsics, u: float, v: float) -> tuple[float, float, float]:
    """Unit ray direction (local ENU) for a normalized pixel (u, v) —
    u: 0=left..1=right, v: 0=top..1=bottom. (0.5, 0.5) is frame center,
    i.e. the camera boresight."""
    forward, right, up = _camera_basis(drone)
    angle_h = math.radians((u - 0.5) * cam.hfov_deg)
    angle_v = math.radians((0.5 - v) * cam.vfov_deg)  # v=0 (top) -> +angle (toward camera "up")

    th, tv = math.tan(angle_h), math.tan(angle_v)
    ray = (
        forward[0] + th * right[0] + tv * up[0],
        forward[1] + th * right[1] + tv * up[1],
        forward[2] + th * right[2] + tv * up[2],
    )
    return _normalize(ray)


def pixel_to_gps(drone: DroneState, cam: CameraIntrinsics, u: float, v: float) -> tuple[float, float] | None:
    """Where a normalized pixel (u, v) is actually pointing on the ground,
    as a real (lat, lng) estimate. Returns None if the ray doesn't hit
    the ground at all (camera pointed at/above the horizon for this
    pixel — genuinely no ground intersection exists, not an error)."""
    ray = pixel_ray_direction(drone, cam, u, v)
    if ray[2] >= -1e-6:  # not pointing downward enough to ever reach the ground
        return None

    t = -drone.alt_m / ray[2]  # distance along the ray to the ground plane
    east_m = t * ray[0]
    north_m = t * ray[1]

    d_lat = north_m / 111_320.0
    d_lng = east_m / (111_320.0 * math.cos(math.radians(drone.lat)))
    return drone.lat + d_lat, drone.lng + d_lng


def bbox_ground_point(drone: DroneState, cam: CameraIntrinsics, bbox_norm: tuple[float, float, float, float]) -> tuple[float, float] | None:
    """A detection's real-world ground position, estimated from the
    bottom-center of its bounding box (the feet point) — the standard
    convention for converting a 2D detection into a ground-plane estimate,
    since the top of a bounding box is the subject's head, floating above
    the ground the ray actually needs to intersect."""
    x1, y1, x2, y2 = bbox_norm
    u = (x1 + x2) / 2
    v = y2
    return pixel_to_gps(drone, cam, u, v)
