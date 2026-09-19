"""
IBVAP edge pipeline — Phase 2: YOLOv8n detection + ByteTrack tracking,
virtual-fence intrusion, person loitering, and multi-frame ANPR fusion, on
any video source (file, RTSP, or a webcam index), POSTing real events to
the backend's existing /events contract.

Reference doc Section 4: sustained-frame confirmation suppresses single-frame
detector jitter (virtual-fence intrusion). Loitering (Case 9) is specifically
person reconnaissance behaviour — stationary or pacing NEAR one spot — so it
excludes vehicles entirely and resets its dwell clock whenever a person's
centroid drifts meaningfully away from where the clock started, rather than
just accumulating total time visible on camera.
"""

import argparse
import time
from collections import deque

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

# COCO-17 keypoint indices (Ultralytics YOLOv8-pose's own output order)
KP_L_SHOULDER, KP_R_SHOULDER = 5, 6
KP_L_HIP, KP_R_HIP = 11, 12
KP_L_KNEE, KP_R_KNEE = 13, 14
KP_MIN_CONF = 0.3  # below this, a joint is "not visible enough" — never guessed

INTRUSION_CONFIRM_SECONDS = 0.6  # doc: n~=3 frames @ 5fps
LOITER_THRESHOLD_SECONDS = 20.0  # demo value; production default is 90s (doc Section 4)
LOITER_RESET_FRACTION = 0.15  # centroid drift past this fraction of frame width resets the loiter clock


def parse_args():
    p = argparse.ArgumentParser(description="IBVAP edge detection + tracking pipeline")
    p.add_argument("--source", default="0", help="video file path, RTSP URL, or webcam index (default: 0)")
    p.add_argument("--camera-id", default="BOP-01")
    p.add_argument("--backend", default="http://127.0.0.1:8000/events")
    p.add_argument("--model", default="yolov8n.pt")
    p.add_argument("--pose-model", default="yolov8n-pose.pt", help="set to empty string to disable pose/skeleton estimation")
    p.add_argument("--pose-every-n-frames", type=int, default=2, help="throttle: pose inference is heavier than detection")
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


def fetch_configured_fence(backend_url: str, camera_id: str) -> list[list[float]] | None:
    # Per-camera geofence set from the dashboard's Zone Configuration page
    # (Section: "per-camera virtual-fence configuration" roadmap item) —
    # the edge pipeline is the actual consumer of that config, not just a
    # UI that saves and does nothing. Best-effort: a dead/unreachable
    # backend at startup falls back to --zone or the hardcoded default.
    fence_url = backend_url.replace("/events", f"/cameras/{camera_id}/fence")
    try:
        resp = requests.get(fence_url, timeout=2.0)
        resp.raise_for_status()
        data = resp.json()
        return data["polygon"] if data else None
    except Exception as e:
        print(f"[warn] could not fetch configured fence for {camera_id}: {e}")
        return None


def iou(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def classify_posture(keypoints: np.ndarray) -> str | None:
    # Geometric, deterministic, and explainable (CLAUDE.md's own rule: measured
    # features, never a generative guess). A standing person's hips sit roughly
    # midway between shoulders and knees; a squat/crawl collapses that gap —
    # the upper-leg (hip->knee) span shrinks relative to the torso (shoulder->hip)
    # span. All four joints must clear KP_MIN_CONF or this returns None rather
    # than tag off partial/occluded keypoints.
    ls, rs = keypoints[KP_L_SHOULDER], keypoints[KP_R_SHOULDER]
    lh, rh = keypoints[KP_L_HIP], keypoints[KP_R_HIP]
    lk, rk = keypoints[KP_L_KNEE], keypoints[KP_R_KNEE]
    joints = [ls, rs, lh, rh, lk, rk]
    if any(j[2] < KP_MIN_CONF for j in joints):
        return None

    shoulder_y = (ls[1] + rs[1]) / 2
    hip_y = (lh[1] + rh[1]) / 2
    knee_y = (lk[1] + rk[1]) / 2
    torso_span = hip_y - shoulder_y
    upper_leg_span = knee_y - hip_y
    if torso_span <= 1:
        return None

    ratio = upper_leg_span / torso_span
    if ratio < 0.35:
        return "SUSPECT CRAWLING"
    return "CIVILIAN"


def post_event(backend_url: str, **kwargs) -> dict | None:
    # A malformed payload or a dead backend must never take the detection
    # loop down with it — this is best-effort telemetry, not the pipeline's
    # own state. Returns the created event (with its id) on success so the
    # caller can attach an evidence snapshot to it.
    try:
        resp = requests.post(backend_url, json=kwargs, timeout=1.5)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[warn] backend POST failed: {e}")
        return None


def post_evidence(backend_url: str, event_id: int, jpg_bytes: bytes) -> None:
    # The actual annotated frame that triggered the alert — not a text
    # description of it. Best-effort, same reasoning as post_event.
    evidence_url = backend_url.replace("/events", f"/events/{event_id}/evidence")
    try:
        requests.post(evidence_url, files={"file": ("evidence.jpg", jpg_bytes, "image/jpeg")}, timeout=2.0)
    except Exception as e:
        print(f"[warn] evidence upload failed for event {event_id}: {e}")


def main():
    args = parse_args()
    source = int(args.source) if args.source.isdigit() else args.source

    model = YOLO(args.model)
    pose_model = YOLO(args.pose_model) if args.pose_model else None
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

    configured_fence = None if args.zone else fetch_configured_fence(args.backend, args.camera_id)
    if args.zone:
        pts = [tuple(map(float, pair.split(','))) for pair in args.zone.split(';')]
        polygon = np.array([[int(x * w), int(y * h)] for x, y in pts])
        print(f"[edge] using --zone override ({len(pts)} points)")
    elif configured_fence:
        polygon = np.array([[int(x * w), int(y * h)] for x, y in configured_fence])
        print(f"[edge] using dashboard-configured fence for {args.camera_id} ({len(configured_fence)} points)")
    else:
        polygon = default_zone(w, h)
        print(f"[edge] no configured fence for {args.camera_id} — using default placeholder zone")

    zone = sv.PolygonZone(polygon=polygon)
    zone_annotator = sv.PolygonZoneAnnotator(zone=zone, color=sv.Color.from_hex("#22d3ee"))
    zone_polygon_norm = [[x / w, y / h] for x, y in polygon.tolist()]

    broadcaster = FrameBroadcaster()
    if args.stream_port:
        start_server(broadcaster, args.stream_port)
        print(f"[edge] MJPEG preview: http://127.0.0.1:{args.stream_port}/stream")

    zone_entry: dict[int, float] = {}
    intrusion_fired: set[int] = set()
    loiter_fired: set[int] = set()
    loiter_anchor: dict[int, tuple[float, float, float]] = {}  # track_id -> (x, y, anchor_time)
    detected_fired: set[int] = set()
    plate_voters: dict[int, PlateVoter] = {}
    plate_posted: dict[int, str] = {}
    position_history: dict[int, deque[tuple[float, float, float]]] = {}  # track_id -> deque[(cx, cy, t)]
    # Longer-term ghost trail (Shadow Ghost Replay): coarser-sampled real
    # centroid history, kept up to TRAIL_WINDOW_SECONDS, attached to whatever
    # alert fires so the dashboard can scrub back through *this track's own
    # recorded frame-space positions* — not a fabricated geo-path, since no
    # camera here is calibrated to convert pixels to real-world coordinates.
    trail_history: dict[int, deque[tuple[float, float, float]]] = {}
    last_trail_sample: dict[int, float] = {}
    TRAIL_WINDOW_SECONDS = 300.0
    TRAIL_SAMPLE_INTERVAL = 1.0

    def trail_payload(track_id: int) -> list[dict] | None:
        trail = trail_history.get(track_id)
        if not trail:
            return None
        return [{"x": round(x / w, 4), "y": round(y / h, 4), "t": t} for x, y, t in trail]
    latest_poses: list[dict] = []  # last computed pose payload, reused between throttled inference frames
    MIN_OCR_SAMPLES = 5
    OCR_EVERY_N_FRAMES = 5  # EasyOCR is slow on CPU; throttle per track

    start = time.time()
    frame_count = 0
    pending_evidence: list[int] = []  # event ids fired this frame, awaiting their snapshot
    frame_times: deque[float] = deque(maxlen=30)  # rolling window for a real FPS reading
    last_telemetry_push = 0.0

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

        pose_candidates: list[tuple[tuple[float, float, float, float], np.ndarray]] = []
        pose_ran_this_frame = pose_model is not None and frame_count % args.pose_every_n_frames == 0
        if pose_ran_this_frame:
            latest_poses = []
            pose_results = pose_model(frame, verbose=False)[0]
            if pose_results.keypoints is not None and len(pose_results.boxes):
                boxes_xyxy = pose_results.boxes.xyxy.cpu().numpy()
                kpts = pose_results.keypoints.data.cpu().numpy()  # (n, 17, 3) x,y,conf in pixels
                for box, kp in zip(boxes_xyxy, kpts):
                    pose_candidates.append((tuple(float(v) for v in box), kp))

        labels = []
        for i in range(len(detections)):
            track_id = int(detections.tracker_id[i]) if detections.tracker_id is not None else -1
            class_id = int(detections.class_id[i])
            conf = float(detections.confidence[i])
            kind = "person" if class_id == PERSON_CLASS else "vehicle"

            # Fire a one-shot detection event the first time a track is confirmed.
            if track_id not in detected_fired:
                detected_fired.add(track_id)
                x1, y1, x2, y2 = (float(v) for v in detections.xyxy[i])
                created = post_event(
                    args.backend,
                    camera_id=args.camera_id,
                    event_type="person_detected" if kind == "person" else "vehicle_detected",
                    confidence=conf,
                    track_id=track_id,
                    bbox=[x1 / w, y1 / h, x2 / w, y2 / h],
                    detail=f"YOLOv8n+ByteTrack, track {track_id}",
                )
                if created:
                    pending_evidence.append(created["id"])

            # Virtual-fence intrusion: sustained-frame (time-based) confirmation.
            inside = bool(in_zone[i]) if i < len(in_zone) else False
            if inside:
                zone_entry.setdefault(track_id, now)
                dwell_in_zone = now - zone_entry[track_id]
                if dwell_in_zone >= INTRUSION_CONFIRM_SECONDS and track_id not in intrusion_fired:
                    intrusion_fired.add(track_id)
                    created = post_event(
                        args.backend,
                        camera_id=args.camera_id,
                        event_type="virtual_fence_intrusion",
                        confidence=0.97,
                        track_id=track_id,
                        zone_id="zone-A",
                        detail=f"sustained {dwell_in_zone:.1f}s in zone, track {track_id}",
                        trail=trail_payload(track_id),
                    )
                    if created:
                        pending_evidence.append(created["id"])
            else:
                zone_entry.pop(track_id, None)
                intrusion_fired.discard(track_id)

            # Loitering (doc Case 9): person reconnaissance behaviour — stationary
            # or pacing NEAR one spot. Two things a naive "time visible" proxy
            # gets wrong, both fixed here:
            #  1. It's a person concept, not a vehicle one — a parked car isn't
            #     "loitering", it's parked. Vehicles are excluded entirely.
            #  2. Someone walking steadily across the frame for 20s+ isn't
            #     loitering either — track centroid drift and reset the dwell
            #     clock once they've moved meaningfully away from where the
            #     clock started, so only bounded stay-in-place time counts.
            if kind == "person":
                bx1, by1, bx2, by2 = detections.xyxy[i]
                cx, cy = float((bx1 + bx2) / 2), float((by1 + by2) / 2)
                reset_px = LOITER_RESET_FRACTION * w

                trail = trail_history.setdefault(track_id, deque())
                if now - last_trail_sample.get(track_id, 0.0) >= TRAIL_SAMPLE_INTERVAL:
                    last_trail_sample[track_id] = now
                    trail.append((cx, cy, now))
                    while trail and now - trail[0][2] > TRAIL_WINDOW_SECONDS:
                        trail.popleft()

                anchor = loiter_anchor.get(track_id)
                if anchor is None or np.hypot(cx - anchor[0], cy - anchor[1]) > reset_px:
                    loiter_anchor[track_id] = (cx, cy, now)
                    loiter_fired.discard(track_id)
                    anchor_time = now
                else:
                    anchor_time = anchor[2]

                dwell_near_spot = now - anchor_time
                if dwell_near_spot >= LOITER_THRESHOLD_SECONDS and track_id not in loiter_fired:
                    loiter_fired.add(track_id)
                    created = post_event(
                        args.backend,
                        camera_id=args.camera_id,
                        event_type="loitering",
                        confidence=0.95,
                        track_id=track_id,
                        dwell_seconds=dwell_near_spot,
                        detail=f"track {track_id} stationary near one spot for {dwell_near_spot:.0f}s",
                        trail=trail_payload(track_id),
                    )
                    if created:
                        pending_evidence.append(created["id"])

                # Trajectory + pose: real centroid history for this track (not
                # a fabricated "1.4 m/s" — no camera is calibrated to convert
                # px/s to real-world speed, so this stays in frame-space units,
                # honestly labeled as such on the dashboard).
                history = position_history.setdefault(track_id, deque(maxlen=10))
                history.append((cx, cy, now))

                best_match, best_iou = None, 0.3  # below this IoU, treat as no match rather than guess
                track_box = tuple(float(v) for v in detections.xyxy[i])
                for box, kp in pose_candidates:
                    score = iou(track_box, box)
                    if score > best_iou:
                        best_iou, best_match = score, kp

                if best_match is not None:
                    behavior = classify_posture(best_match)
                    heading_deg = speed_px_s = None
                    if len(history) >= 2:
                        (x0, y0, t0) = history[0]
                        (x1p, y1p, t1) = history[-1]
                        dt = t1 - t0
                        if dt > 0.1:
                            dx, dy = x1p - x0, y1p - y0
                            speed_px_s = round(float(np.hypot(dx, dy) / dt), 1)
                            heading_deg = round(float(np.degrees(np.arctan2(-dy, dx)) % 360), 1)

                    normalized_kp = [[round(float(x / w), 4), round(float(y / h), 4), round(float(c), 2)] for x, y, c in best_match]
                    latest_poses.append(
                        {
                            "track_id": track_id,
                            "keypoints": normalized_kp,
                            "behavior": behavior,
                            "heading_deg": heading_deg,
                            "speed_px_s": speed_px_s,
                        }
                    )

            plate_label = ""
            if kind == "vehicle":
                voter = plate_voters.setdefault(track_id, PlateVoter())
                if frame_count % OCR_EVERY_N_FRAMES == 0:
                    x1, y1, x2, y2 = map(int, detections.xyxy[i])
                    crop = frame[max(0, y1) : y2, max(0, x1) : x2]
                    try:
                        voter.add(read_candidates(crop), frame_number=frame_count, timestamp=now)
                    except Exception as e:  # OCR must never take the whole pipeline down
                        print(f"[warn] OCR failed for track {track_id}: {e}")

                fused = voter.fuse()
                if fused and len(voter.samples) >= MIN_OCR_SAMPLES:
                    plate, accuracy = fused
                    plate_label = f" [{plate}]"
                    if plate_posted.get(track_id) != plate:
                        plate_posted[track_id] = plate
                        created = post_event(
                            args.backend,
                            camera_id=args.camera_id,
                            event_type="anpr_read",
                            confidence=min(0.99, accuracy / 100),
                            track_id=track_id,
                            plate_text=plate,
                            detail=f"multi-frame fusion, {len(voter.samples)} samples, {accuracy:.1f}% fused accuracy",
                            ocr_samples=voter.frame_log,
                        )
                        if created:
                            pending_evidence.append(created["id"])

            labels.append(f"#{track_id} {kind} {conf:.2f}{plate_label}" + (" [ZONE]" if inside else ""))

        annotated = zone_annotator.annotate(scene=frame.copy())
        annotated = box_annotator.annotate(scene=annotated, detections=detections)
        annotated = label_annotator.annotate(scene=annotated, detections=detections, labels=labels)

        t_done = time.time()
        latency_ms = (t_done - t_capture) * 1000
        frame_times.append(t_done)
        rolling_fps = (len(frame_times) - 1) / (frame_times[-1] - frame_times[0]) if len(frame_times) > 1 else 0.0

        if t_done - last_telemetry_push >= 1.0:
            last_telemetry_push = t_done
            post_event(
                args.backend.replace("/events", "/telemetry"),
                camera_id=args.camera_id,
                fps=round(rolling_fps, 1),
                latency_ms=round(latency_ms, 1),
                active_tracks=len(detections),
                zone_polygon=zone_polygon_norm,
                poses=latest_poses,
            )

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
        if args.stream_port or pending_evidence:
            ok, jpg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if ok:
                jpg_bytes = jpg.tobytes()
                if args.stream_port:
                    broadcaster.update(jpg_bytes)
                for event_id in pending_evidence:
                    post_evidence(args.backend, event_id, jpg_bytes)
                pending_evidence.clear()
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
