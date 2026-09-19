"""
IBVAP edge pipeline — Phase 2, Stage 1: YOLOv8n detection + ByteTrack tracking
+ virtual-fence intrusion + loitering, on any video source (file, RTSP, or a
webcam index), POSTing real events to the backend's existing /events contract.

Reference doc Section 4: sustained-frame confirmation suppresses single-frame
detector jitter; loitering fires when T(id) = t_now - t_first_seen exceeds a
threshold. Both are implemented here as time-based (not raw frame-count) so
the logic is correct regardless of the source's actual FPS.
"""

import argparse
import time

import cv2
import numpy as np
import requests
import supervision as sv
from ultralytics import YOLO

from anpr import PlateVoter, read_candidates
from mjpeg_server import FrameBroadcaster, start_server

# COCO class ids this platform cares about (Section 4: person/vehicle only)
PERSON_CLASS = 0
VEHICLE_CLASSES = {2, 5, 7}  # car, bus, truck
TRACKED_CLASSES = {PERSON_CLASS, *VEHICLE_CLASSES}

INTRUSION_CONFIRM_SECONDS = 0.6  # doc: n~=3 frames @ 5fps
LOITER_THRESHOLD_SECONDS = 20.0  # demo value; production default is 90s (doc Section 4)


def parse_args():
    p = argparse.ArgumentParser(description="IBVAP edge detection + tracking pipeline")
    p.add_argument("--source", default="0", help="video file path, RTSP URL, or webcam index (default: 0)")
    p.add_argument("--camera-id", default="BOP-01")
    p.add_argument("--backend", default="http://127.0.0.1:8000/events")
    p.add_argument("--model", default="yolov8n.pt")
    p.add_argument("--show", action="store_true", help="open a live cv2 window")
    p.add_argument("--save-frame", default="latest_frame.jpg", help="continuously write the annotated frame here for remote inspection")
    p.add_argument("--zone", default=None, help="virtual-fence polygon as x1,y1;x2,y2;... in 0-1 normalized coords")
    p.add_argument("--max-seconds", type=float, default=None, help="stop after N seconds (for scripted test runs)")
    p.add_argument("--stream-port", type=int, default=8091, help="MJPEG preview stream port (0 to disable)")
    return p.parse_args()


def default_zone(width: int, height: int) -> np.ndarray:
    # A generous polygon covering the lower-center portion of the frame —
    # placeholder until a real per-camera geofence is configured.
    pts = [(0.15, 0.95), (0.35, 0.35), (0.75, 0.35), (0.9, 0.95)]
    return np.array([[int(x * width), int(y * height)] for x, y in pts])


def post_event(backend_url: str, **kwargs):
    # A malformed payload or a dead backend must never take the detection
    # loop down with it — this is best-effort telemetry, not the pipeline's
    # own state.
    try:
        requests.post(backend_url, json=kwargs, timeout=1.5)
    except Exception as e:
        print(f"[warn] backend POST failed: {e}")


def main():
    args = parse_args()
    source = int(args.source) if args.source.isdigit() else args.source

    model = YOLO(args.model)
    tracker = sv.ByteTrack()
    box_annotator = sv.BoxAnnotator()
    label_annotator = sv.LabelAnnotator()

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise SystemExit(f"could not open video source: {source}")

    ret, first_frame = cap.read()
    if not ret:
        raise SystemExit("could not read first frame from source")
    h, w = first_frame.shape[:2]

    if args.zone:
        pts = [tuple(map(float, pair.split(','))) for pair in args.zone.split(';')]
        polygon = np.array([[int(x * w), int(y * h)] for x, y in pts])
    else:
        polygon = default_zone(w, h)

    zone = sv.PolygonZone(polygon=polygon)
    zone_annotator = sv.PolygonZoneAnnotator(zone=zone, color=sv.Color.from_hex("#22d3ee"))

    broadcaster = FrameBroadcaster()
    if args.stream_port:
        start_server(broadcaster, args.stream_port)
        print(f"[edge] MJPEG preview: http://127.0.0.1:{args.stream_port}/stream")

    first_seen: dict[int, float] = {}
    zone_entry: dict[int, float] = {}
    intrusion_fired: set[int] = set()
    loiter_fired: set[int] = set()
    detected_fired: set[int] = set()
    plate_voters: dict[int, PlateVoter] = {}
    plate_posted: dict[int, str] = {}
    MIN_OCR_SAMPLES = 5
    OCR_EVERY_N_FRAMES = 5  # EasyOCR is slow on CPU; throttle per track

    start = time.time()
    frame_count = 0

    print(f"[edge] source={args.source} camera_id={args.camera_id} backend={args.backend}")
    print(f"[edge] zone polygon (px): {polygon.tolist()}")

    while True:
        t_capture = time.time()
        ret, frame = cap.read()
        if not ret:
            break
        frame_count += 1
        now = time.time()

        results = model(frame, verbose=False)[0]
        detections = sv.Detections.from_ultralytics(results)
        detections = detections[np.isin(detections.class_id, list(TRACKED_CLASSES))]
        detections = tracker.update_with_detections(detections)
        t_detect = time.time()

        in_zone = zone.trigger(detections) if len(detections) else np.array([], dtype=bool)

        labels = []
        for i in range(len(detections)):
            track_id = int(detections.tracker_id[i]) if detections.tracker_id is not None else -1
            class_id = int(detections.class_id[i])
            conf = float(detections.confidence[i])
            kind = "person" if class_id == PERSON_CLASS else "vehicle"

            if track_id not in first_seen:
                first_seen[track_id] = now

            # Fire a one-shot detection event the first time a track is confirmed.
            if track_id not in detected_fired:
                detected_fired.add(track_id)
                x1, y1, x2, y2 = (float(v) for v in detections.xyxy[i])
                post_event(
                    args.backend,
                    camera_id=args.camera_id,
                    event_type="person_detected" if kind == "person" else "vehicle_detected",
                    confidence=conf,
                    track_id=track_id,
                    bbox=[x1 / w, y1 / h, x2 / w, y2 / h],
                    detail=f"YOLOv8n+ByteTrack, track {track_id}",
                )

            # Virtual-fence intrusion: sustained-frame (time-based) confirmation.
            inside = bool(in_zone[i]) if i < len(in_zone) else False
            if inside:
                zone_entry.setdefault(track_id, now)
                dwell_in_zone = now - zone_entry[track_id]
                if dwell_in_zone >= INTRUSION_CONFIRM_SECONDS and track_id not in intrusion_fired:
                    intrusion_fired.add(track_id)
                    post_event(
                        args.backend,
                        camera_id=args.camera_id,
                        event_type="virtual_fence_intrusion",
                        confidence=0.97,
                        track_id=track_id,
                        zone_id="zone-A",
                        detail=f"sustained {dwell_in_zone:.1f}s in zone, track {track_id}",
                    )
            else:
                zone_entry.pop(track_id, None)
                intrusion_fired.discard(track_id)

            # Loitering: total time-in-frame past threshold, regardless of zone.
            total_dwell = now - first_seen[track_id]
            if total_dwell >= LOITER_THRESHOLD_SECONDS and track_id not in loiter_fired:
                loiter_fired.add(track_id)
                post_event(
                    args.backend,
                    camera_id=args.camera_id,
                    event_type="loitering",
                    confidence=0.95,
                    track_id=track_id,
                    dwell_seconds=total_dwell,
                    detail=f"track {track_id} present {total_dwell:.0f}s",
                )

            plate_label = ""
            if kind == "vehicle":
                voter = plate_voters.setdefault(track_id, PlateVoter())
                if frame_count % OCR_EVERY_N_FRAMES == 0:
                    x1, y1, x2, y2 = map(int, detections.xyxy[i])
                    crop = frame[max(0, y1) : y2, max(0, x1) : x2]
                    try:
                        voter.add(read_candidates(crop))
                    except Exception as e:  # OCR must never take the whole pipeline down
                        print(f"[warn] OCR failed for track {track_id}: {e}")

                fused = voter.fuse()
                if fused and len(voter.samples) >= MIN_OCR_SAMPLES:
                    plate, accuracy = fused
                    plate_label = f" [{plate}]"
                    if plate_posted.get(track_id) != plate:
                        plate_posted[track_id] = plate
                        post_event(
                            args.backend,
                            camera_id=args.camera_id,
                            event_type="anpr_read",
                            confidence=min(0.99, accuracy / 100),
                            track_id=track_id,
                            plate_text=plate,
                            detail=f"multi-frame fusion, {len(voter.samples)} samples, {accuracy:.1f}% fused accuracy",
                        )

            labels.append(f"#{track_id} {kind} {conf:.2f}{plate_label}" + (" [ZONE]" if inside else ""))

        annotated = zone_annotator.annotate(scene=frame.copy())
        annotated = box_annotator.annotate(scene=annotated, detections=detections)
        annotated = label_annotator.annotate(scene=annotated, detections=detections, labels=labels)

        t_done = time.time()
        latency_ms = (t_done - t_capture) * 1000
        cv2.putText(
            annotated,
            f"frame {frame_count} | detect+track {(t_detect - t_capture) * 1000:.0f}ms | e2e {latency_ms:.0f}ms",
            (10, h - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 255, 255),
            1,
        )

        if args.save_frame:
            cv2.imwrite(args.save_frame, annotated)
        if args.stream_port:
            ok, jpg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ok:
                broadcaster.update(jpg.tobytes())
        if args.show:
            cv2.imshow("IBVAP edge pipeline", annotated)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

        if args.max_seconds and (now - start) >= args.max_seconds:
            break

    cap.release()
    if args.show:
        cv2.destroyAllWindows()
    print(f"[edge] stopped after {frame_count} frames, {time.time() - start:.1f}s")


if __name__ == "__main__":
    main()
