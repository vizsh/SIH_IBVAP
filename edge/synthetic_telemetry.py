"""
A SIMULATED flight-telemetry track — standing in for a real MAVLink/DJI
SDK telemetry stream, since no real drone exists on this platform. Same
honesty pattern as the thermal sentry camera: real detection model, real
footage, but the *source of the telemetry* is clearly synthetic and
labeled as such everywhere it's used (drone_pipeline.py tags every event
sensor_mode="drone_simulated_telemetry", never "drone").

This generates a straight-line patrol at constant altitude/speed/heading
over a real, already-used-elsewhere set of coordinates (the Jogbani gap
area), synced to a given frame count/fps — not fitted to match any
specific video's actual camera motion, since no such ground-truth flight
log exists for stock footage. It exists to let the geo-projection and
zone-membership *logic* be demonstrated end-to-end on real video frames
with real detections, not to claim the video was shot by a real,
telemetry-logged flight.
"""

from dataclasses import dataclass

from geo_projection import DroneState


@dataclass
class LinearPatrolConfig:
    start_lat: float
    start_lng: float
    alt_m: float
    heading_deg: float
    speed_mps: float
    gimbal_pitch_deg: float = 0.0  # 0 = nadir (straight down)


def linear_patrol_track(config: LinearPatrolConfig, fps: float, total_frames: int) -> list[DroneState]:
    """One DroneState per frame, moving in a straight line at constant
    speed/altitude/heading/gimbal from the configured start point."""
    import math

    heading_rad = math.radians(config.heading_deg)
    states = []
    for frame_idx in range(total_frames):
        t = frame_idx / fps
        dist_m = config.speed_mps * t
        d_lat = (dist_m * math.cos(heading_rad)) / 111_320.0
        d_lng = (dist_m * math.sin(heading_rad)) / (111_320.0 * math.cos(math.radians(config.start_lat)))
        states.append(
            DroneState(
                lat=config.start_lat + d_lat,
                lng=config.start_lng + d_lng,
                alt_m=config.alt_m,
                heading_deg=config.heading_deg,
                gimbal_pitch_deg=config.gimbal_pitch_deg,
            )
        )
    return states
