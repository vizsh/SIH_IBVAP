"""
Sanity-check geo_projection.py against known, hand-computable cases before
trusting it inside a pipeline. Run: python tools/test_geo_projection.py
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "edge"))

from geo_projection import CameraIntrinsics, DroneState, bbox_ground_point, pixel_to_gps  # noqa: E402

EARTH_M_PER_DEG_LAT = 111_320.0


def meters_between(lat1, lng1, lat2, lng2):
    d_lat_m = (lat2 - lat1) * EARTH_M_PER_DEG_LAT
    d_lng_m = (lng2 - lng1) * EARTH_M_PER_DEG_LAT * math.cos(math.radians(lat1))
    return math.hypot(d_lat_m, d_lng_m)


def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))
    if not cond:
        raise SystemExit(1)


DRONE_LAT, DRONE_LNG = 26.40, 87.27  # near the Jogbani gap zone, real coordinates already used elsewhere in this repo
CAM = CameraIntrinsics(hfov_deg=80.0, vfov_deg=52.0)


def test_nadir_center_is_directly_below():
    drone = DroneState(lat=DRONE_LAT, lng=DRONE_LNG, alt_m=100.0, heading_deg=0.0, gimbal_pitch_deg=0.0)
    result = pixel_to_gps(drone, CAM, 0.5, 0.5)
    check("nadir center pixel == drone position", result is not None, str(result))
    dist = meters_between(DRONE_LAT, DRONE_LNG, *result)
    check("nadir center pixel distance ~0m", dist < 0.01, f"{dist:.4f}m")


def test_nadir_right_edge_offsets_east_at_heading_zero():
    drone = DroneState(lat=DRONE_LAT, lng=DRONE_LNG, alt_m=100.0, heading_deg=0.0, gimbal_pitch_deg=0.0)
    result = pixel_to_gps(drone, CAM, 1.0, 0.5)  # right edge of frame, vertical center
    check("nadir right-edge pixel resolves", result is not None)
    lat, lng = result
    expected_east_m = 100.0 * math.tan(math.radians(CAM.hfov_deg / 2))
    dist = meters_between(DRONE_LAT, DRONE_LNG, lat, lng)
    check(
        "nadir right-edge distance matches altitude*tan(hfov/2)",
        abs(dist - expected_east_m) < 0.5,
        f"got {dist:.2f}m, expected {expected_east_m:.2f}m",
    )
    check("nadir right-edge moved east (lng increased), not north", lng > DRONE_LNG and abs(lat - DRONE_LAT) < 1e-6)


def test_nadir_top_edge_is_heading_direction():
    # At nadir with heading=0 (North), "up in the image" should be forward
    # in the heading direction == North, per the documented camera_up
    # convention (image top = direction of travel at pitch=0).
    drone = DroneState(lat=DRONE_LAT, lng=DRONE_LNG, alt_m=100.0, heading_deg=0.0, gimbal_pitch_deg=0.0)
    result = pixel_to_gps(drone, CAM, 0.5, 0.0)  # top edge, horizontal center
    lat, lng = result
    check("nadir top-edge moved north (lat increased), not east", lat > DRONE_LAT and abs(lng - DRONE_LNG) < 1e-6)


def test_heading_90_rotates_ground_track():
    # Same nadir right-edge test, but drone heading east (90 deg) — the
    # image's "up" direction should now point east, so "right in image"
    # (which was east at heading=0) should now point south.
    drone = DroneState(lat=DRONE_LAT, lng=DRONE_LNG, alt_m=100.0, heading_deg=90.0, gimbal_pitch_deg=0.0)
    result = pixel_to_gps(drone, CAM, 1.0, 0.5)
    lat, lng = result
    check(
        "heading=90 right-edge pixel moves south, not east",
        lat < DRONE_LAT and abs(lng - DRONE_LNG) < 0.01 * abs(lat - DRONE_LAT) + 1e-6,
        f"lat={lat}, lng={lng}, drone lat={DRONE_LAT}",
    )


def test_level_flight_center_pixel_never_hits_ground():
    # gimbal_pitch=90 means the boresight is level with the horizon —
    # the ray is horizontal and mathematically never reaches the ground.
    drone = DroneState(lat=DRONE_LAT, lng=DRONE_LNG, alt_m=100.0, heading_deg=0.0, gimbal_pitch_deg=90.0)
    result = pixel_to_gps(drone, CAM, 0.5, 0.5)
    check("level-flight center pixel has no ground intersection", result is None, str(result))


def test_bbox_uses_bottom_center_not_box_top():
    drone = DroneState(lat=DRONE_LAT, lng=DRONE_LNG, alt_m=100.0, heading_deg=0.0, gimbal_pitch_deg=0.0)
    # A tall bbox where the top is near the frame's top edge and the
    # bottom is at frame center — the ground point should match the
    # center-pixel case (bottom-center = (0.5, 0.5)), not the top.
    bbox = (0.45, 0.0, 0.55, 0.5)
    result = bbox_ground_point(drone, CAM, bbox)
    dist = meters_between(DRONE_LAT, DRONE_LNG, *result)
    check("bbox ground point uses feet (bottom-center), matches nadir center", dist < 0.01, f"{dist:.4f}m")


def test_higher_altitude_scales_ground_footprint_linearly():
    drone_low = DroneState(lat=DRONE_LAT, lng=DRONE_LNG, alt_m=50.0, heading_deg=0.0, gimbal_pitch_deg=0.0)
    drone_high = DroneState(lat=DRONE_LAT, lng=DRONE_LNG, alt_m=150.0, heading_deg=0.0, gimbal_pitch_deg=0.0)
    r_low = pixel_to_gps(drone_low, CAM, 1.0, 0.5)
    r_high = pixel_to_gps(drone_high, CAM, 1.0, 0.5)
    d_low = meters_between(DRONE_LAT, DRONE_LNG, *r_low)
    d_high = meters_between(DRONE_LAT, DRONE_LNG, *r_high)
    ratio = d_high / d_low
    check("3x altitude -> 3x ground footprint (pinhole model is linear in altitude)", abs(ratio - 3.0) < 0.01, f"ratio={ratio:.3f}")


if __name__ == "__main__":
    test_nadir_center_is_directly_below()
    test_nadir_right_edge_offsets_east_at_heading_zero()
    test_nadir_top_edge_is_heading_direction()
    test_heading_90_rotates_ground_track()
    test_level_flight_center_pixel_never_hits_ground()
    test_bbox_uses_bottom_center_not_box_top()
    test_higher_altitude_scales_ground_footprint_linearly()
    print("\nAll geo_projection checks passed.")
