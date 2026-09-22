"""
IBVAP drone pipeline — geo-referenced zone intrusion detection on a
MOVING camera. Unlike edge/pipeline.py (which assumes a fixed camera and
checks zone membership in pixel-space), this checks each detection's real
projected ground-GPS position (geo_projection.py) against a real GPS
polygon (geo_zone.py) — the fence doesn't move in pixel-space because it
was never defined there.

No real drone exists on this platform. Telemetry is a clearly-labeled
SIMULATED linear patrol track (synthetic_telemetry.py), standing in for a
real MAVLink/DJI feed. Detection itself is 100% real: real YOLOv8n on
real drone footage, real confidences, real computed ground coordinates.
Every event this fires carries sensor_mode="drone_simulated_telemetry" so
the distinction is never lost downstream.
"""

import argparse
import time
from collections import deque

import cv2
import numpy as np
import requests
import supervision as sv
from ultralytics import YOLO

from geo_projection import CameraIntrinsics, DroneState, bbox_ground_point
from geo_zone import GeoZone
from mjpeg_server import FrameBroadcaster, start_server
from synthetic_telemetry import LinearPatrolConfig, linear_patrol_track

PERSON_CLASS = 0
ZONE_CONFIRM_SECONDS = 2.0  # sustained-frame confirmation, same principle as pipeline.py's fixed-camera intrusion

# Real coordinates already used elsewhere in this repo for the Jogbani gap
# — a documented, real-geography-informed zone, not an arbitrary rectangle.
DEFAULT_ZONE_POINTS = [
    (26.399, 87.269),
    (26.401, 87.269),
    (26.401, 87.271),
    (26.399, 87.271),
]


def parse_args():
    p = argparse.ArgumentParser(description="IBVAP drone pipeline — geo-referenced zone intrusion on a moving camera")
    p.add_argument("--source", required=True, help="drone video file path")
    p.add_argument("--camera-id", default="DRONE-01")
    p.add_argument("--backend", default="http://127.0.0.1:8000/events")
    p.add_argument("--model", default="yolov8n.pt")
    p.add_argument("--stream-port", type=int, default=8095)
    p.add_argument("--loop", action="store_true")
    p.add_argument("--max-seconds", type=float, default=None)

    # Simulated flight telemetry — see synthetic_telemetry.py's own
    # honesty note. Defaults describe a slow nadir survey pass over the
    # default zone at a realistic small-UAS altitude.
    p.add_argument("--start-lat", type=float, default=26.398)
    p.add_argument("--start-lng", type=float, default=87.268)
    p.add_argument("--alt-m", type=float, default=100.0)
    p.add_argument("--heading-deg", type=float, default=15.0)
    p.add_argument("--speed-mps", type=float, default=4.0)
    p.add_argument("--gimbal-pitch-deg", type=float, default=0.0, help="0=nadir (straight down)")

    # Camera intrinsics — a documented assumption (typical small-UAS
    # rectilinear FOV), since the real stock footage's actual lens/sensor
    # specs aren't known. Same honesty pattern as the fixed-camera FOV
    # assumption in dashboard/src/lib/cameraSites.ts.
    p.add_argument("--hfov-deg", type=float, default=80.0)
    p.add_argument("--vfov-deg", type=float, default=52.0)
    return p.parse_args()


def post_event(backend_url: str, **kwargs) -> dict | None:
    try:
        resp = requests.post(backend_url, json=kwargs, timeout=1.5)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[drone] backend POST failed: {e}")
        return None


def main():
    args = parse_args()
    cam = CameraIntrinsics(hfov_deg=args.hfov_deg, vfov_deg=args.vfov_deg)
    zone = GeoZone.from_lat_lng_points("jogbani-gap-patrol-zone", DEFAULT_ZONE_POINTS)

    model = YOLO(args.model)
    tracker = sv.ByteTrack()
    box_annotator = sv.BoxAnnotator()
    label_annotator = sv.LabelAnnotator()

    cap = cv2.VideoCapture(args.source)
    if not cap.isOpened():
        raise SystemExit(f"could not open video source: {args.source}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1

    telemetry_config = LinearPatrolConfig(
        start_lat=args.start_lat,
        start_lng=args.start_lng,
        alt_m=args.alt_m,
        heading_deg=args.heading_deg,
        speed_mps=args.speed_mps,
        gimbal_pitch_deg=args.gimbal_pitch_deg,
    )
    telemetry_track = linear_patrol_track(telemetry_config, fps, total_frames)
    print(f"[drone] SIMULATED telemetry: {total_frames} frames @ {fps:.1f}fps, "
          f"{args.speed_mps}m/s heading {args.heading_deg}° from ({args.start_lat},{args.start_lng})")
    print(f"[drone] geo-zone '{zone.name}': {DEFAULT_ZONE_POINTS}")

    broadcaster = FrameBroadcaster()
    if args.stream_port:
        start_server(broadcaster, args.stream_port)
        print(f"[drone] MJPEG preview: http://127.0.0.1:{args.stream_port}/stream")

    zone_entry: dict[int, float] = {}
    zone_fired: set[int] = set()
    detected_fired: set[int] = set()
    pending_evidence: list[int] = []

    start = time.time()
    frame_count = 0
    frame_times: deque[float] = deque(maxlen=30)
    last_telemetry_push = 0.0

    while True:
        ret, frame = cap.read()
        if not ret:
            if args.loop:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
                if not ret:
                    break
            else:
                break

        telemetry_idx = frame_count % total_frames
        drone = telemetry_track[telemetry_idx]
        frame_count += 1
        now = time.time()
        h, w = frame.shape[:2]

        results = model(frame, verbose=False)[0]
        detections = sv.Detections.from_ultralytics(results)
        detections = detections[detections.class_id == PERSON_CLASS]
        detections = tracker.update_with_detections(detections)

        labels = []
        for i in range(len(detections)):
            track_id = int(detections.tracker_id[i]) if detections.tracker_id is not None else -1
            conf = float(detections.confidence[i])
            x1, y1, x2, y2 = (float(v) for v in detections.xyxy[i])
            bbox_norm = (x1 / w, y1 / h, x2 / w, y2 / h)

            ground = bbox_ground_point(drone, cam, bbox_norm)
            in_zone = ground is not None and zone.contains(*ground)
            label = f"#{track_id} person {conf:.2f}"

            if track_id not in detected_fired:
                detected_fired.add(track_id)
                created = post_event(
                    args.backend,
                    camera_id=args.camera_id,
                    event_type="person_detected",
                    confidence=conf,
                    track_id=track_id,
                    bbox=list(bbox_norm),
                    detail=f"YOLOv8n+ByteTrack (drone), track {track_id}",
                    sensor_mode="drone_simulated_telemetry",
                    detected_lat=ground[0] if ground else None,
                    detected_lng=ground[1] if ground else None,
                    drone_alt_m=drone.alt_m,
                    drone_heading_deg=drone.heading_deg,
                )
                if created:
                    pending_evidence.append(created["id"])

            if in_zone:
                zone_entry.setdefault(track_id, now)
                dwell = now - zone_entry[track_id]
                label += f" [ZONE {dwell:.1f}s]"
                if dwell >= ZONE_CONFIRM_SECONDS and track_id not in zone_fired:
                    zone_fired.add(track_id)
                    created = post_event(
                        args.backend,
                        camera_id=args.camera_id,
                        event_type="virtual_fence_intrusion",
                        confidence=0.95,
                        track_id=track_id,
                        zone_id=zone.name,
                        detail=(
                            f"drone geo-fence intrusion, track {track_id}, "
                            f"sustained {dwell:.1f}s at real ground position "
                            f"({ground[0]:.5f},{ground[1]:.5f})"
                        ),
                        sensor_mode="drone_simulated_telemetry",
                        detected_lat=ground[0],
                        detected_lng=ground[1],
                        drone_alt_m=drone.alt_m,
                        drone_heading_deg=drone.heading_deg,
                    )
                    if created:
                        pending_evidence.append(created["id"])
            else:
                zone_entry.pop(track_id, None)
                zone_fired.discard(track_id)

            labels.append(label)

        annotated = box_annotator.annotate(scene=frame.copy(), detections=detections)
        annotated = label_annotator.annotate(scene=annotated, detections=detections, labels=labels)
        cv2.putText(
            annotated,
            f"SIMULATED TELEMETRY | lat {drone.lat:.5f} lng {drone.lng:.5f} alt {drone.alt_m:.0f}m hdg {drone.heading_deg:.0f}",
            (10, h - 15),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 255, 255),
            1,
        )

        frame_times.append(now)
        rolling_fps = (len(frame_times) - 1) / (frame_times[-1] - frame_times[0]) if len(frame_times) > 1 else 0.0

        if now - last_telemetry_push >= 1.0:
            last_telemetry_push = now
            post_event(
                args.backend.replace("/events", "/telemetry"),
                camera_id=args.camera_id,
                fps=round(rolling_fps, 1),
                latency_ms=0.0,
                active_tracks=len(detections),
                zone_polygon=[],  # geo-fence, not a fixed pixel-space polygon — nothing meaningful to draw here
                sensor_mode="drone_simulated_telemetry",
                lat=drone.lat,
                lng=drone.lng,
                alt_m=drone.alt_m,
                heading_deg=drone.heading_deg,
                gimbal_pitch_deg=drone.gimbal_pitch_deg,
                hfov_deg=cam.hfov_deg,
                vfov_deg=cam.vfov_deg,
            )

        if args.stream_port or pending_evidence:
            ok, jpg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if ok:
                jpg_bytes = jpg.tobytes()
                if args.stream_port:
                    broadcaster.update(jpg_bytes)
                for event_id in pending_evidence:
                    try:
                        requests.post(
                            args.backend.replace("/events", f"/events/{event_id}/evidence"),
                            files={"file": ("evidence.jpg", jpg_bytes, "image/jpeg")},
                            timeout=2.0,
                        )
                    except Exception as e:
                        print(f"[warn] evidence upload failed for event {event_id}: {e}")
                pending_evidence.clear()

        if args.max_seconds and (now - start) >= args.max_seconds:
            break

    cap.release()
    print(f"[drone] stopped after {frame_count} frames, {time.time() - start:.1f}s")


if __name__ == "__main__":
    main()
