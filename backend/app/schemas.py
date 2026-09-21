from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class EventType(str, Enum):
    virtual_fence_intrusion = "virtual_fence_intrusion"
    loitering = "loitering"
    vehicle_detected = "vehicle_detected"
    person_detected = "person_detected"
    anpr_read = "anpr_read"
    correlation_match = "correlation_match"


class ConfidenceTier(str, Enum):
    high = "high"      # auto-escalate
    medium = "medium"  # human review queue
    low = "low"        # logged silently


class EventIn(BaseModel):
    """What the edge pipeline POSTs to the backend for every detected event."""

    camera_id: str
    event_type: EventType
    confidence: float = Field(ge=0.0, le=1.0)
    track_id: Optional[int] = None
    zone_id: Optional[str] = None
    bbox: Optional[list[float]] = None  # [x1, y1, x2, y2] in normalized 0-1 coords
    dwell_seconds: Optional[float] = None
    plate_text: Optional[str] = None
    frame_timestamp: Optional[float] = None  # seconds into source video, for replay sync
    detail: Optional[str] = None  # short human-readable extra context

    # correlation_match only: real haversine-distance-based prediction
    # (Section 4's "distance ÷ plausible speed range" formula), plus the
    # actual elapsed time between the two sightings, for the transit
    # corridor gauge — not present on any other event type.
    distance_km: Optional[float] = None
    travel_min_minutes: Optional[float] = None
    travel_max_minutes: Optional[float] = None
    elapsed_minutes: Optional[float] = None
    from_camera_id: Optional[str] = None

    # anpr_read only: the real per-frame OCR readings behind the fused
    # plate_text — [{frame, timestamp, reading, confidence}, ...] — so the
    # UI can show the actual multi-frame voting matrix, not just the answer.
    ocr_samples: Optional[list[dict]] = None

    # virtual_fence_intrusion / loitering only: the real recent centroid
    # history for the track that fired this alert — [{x, y, t}, ...] in
    # normalized 0-1 frame-space coordinates plus a wall-clock timestamp, up
    # to 5 minutes back. Powers the "Shadow Ghost Replay" scrubber. Deliberately
    # frame-space, not a geo path — no camera here is calibrated to convert
    # pixels to real-world coordinates, so plotting this on a map would
    # fabricate a precision that doesn't exist.
    trail: Optional[list[dict]] = None

    # Set only on events from a dedicated thermal (LWIR-style) camera post —
    # never inferred, never defaulted to "thermal" for an ordinary RGB
    # camera. Lets the dashboard show a THERMAL badge instead of silently
    # presenting IR-sourced detections as if they were optical.
    sensor_mode: Optional[str] = None  # "thermal" | None (omitted = ordinary optical camera)


class EventOut(EventIn):
    id: int
    confidence_tier: ConfidenceTier
    status: str  # "pending" | "confirmed" | "dismissed" | "auto_escalated"
    created_at: datetime
    evidence_url: Optional[str] = None  # the actual annotated frame that triggered this alert

    class Config:
        from_attributes = True


class ReviewAction(BaseModel):
    action: str  # "confirm" | "dismiss"
    reason: Optional[str] = None  # dismiss reason, e.g. "Animal/foliage movement" — logged into the audit trail


class TelemetryIn(BaseModel):
    """Live edge-box telemetry, pushed by the pipeline every ~second — the
    numbers the video-pane HUD overlay actually displays, not decoration."""

    camera_id: str
    fps: float
    latency_ms: float
    active_tracks: int
    zone_polygon: list[list[float]]  # [[x, y], ...] normalized 0-1 image-plane coords

    # Real YOLOv8n-pose output per tracked person, not a generative overlay:
    # 17 COCO keypoints (normalized 0-1, [x, y, confidence] each), a behavior
    # tag derived from measured joint-angle geometry (never guessed), and a
    # heading/speed computed from that track's own recent centroid history.
    # speed_px_s is frame-space pixels/sec, not a fabricated real-world
    # m/s — no camera calibration exists to make that conversion honest.
    poses: Optional[list[dict]] = None

    # Real measured ambient frame brightness (0-255 grayscale mean) — the
    # same signal a real zero-light auto-switch would key off of. No
    # co-located thermal sensor exists for any optical camera here, so this
    # is reported as real telemetry rather than wired to a fake auto-switch.
    mean_brightness: Optional[float] = None
    sensor_mode: Optional[str] = None  # "thermal" | None


class FenceIn(BaseModel):
    """A camera's virtual-fence polygon, drawn by an operator in the
    dashboard's Zone Configuration page — normalized 0-1 image-plane
    coordinates, same convention as TelemetryIn.zone_polygon, so the edge
    pipeline can scale it to whatever resolution that camera actually runs
    at."""

    polygon: list[list[float]] = Field(min_length=3)


class FenceOut(FenceIn):
    camera_id: str
    updated_at: datetime

    class Config:
        from_attributes = True


class POICategory(str, Enum):
    suspected_staging_point = "suspected_staging_point"
    historical_seizure = "historical_seizure"
    unmonitored_crossing = "unmonitored_crossing"
    unverified_tip = "unverified_tip"
    other = "other"


class POISource(str, Enum):
    humint = "humint"
    pattern_of_life = "pattern_of_life"
    historical_record = "historical_record"
    unverified = "unverified"


class POIIn(BaseModel):
    """A Named Area of Interest an analyst places on the map — never
    auto-generated. category/source are deliberately plain enums an
    operator picks, not a confidence score, since there's no model output
    behind this to score."""

    name: str
    category: POICategory
    lat: float
    lng: float
    source: POISource
    notes: Optional[str] = None


class POIOut(POIIn):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AuditEntryOut(BaseModel):
    id: int
    event_id: Optional[int]
    action: str
    detail: str
    prev_hash: str
    entry_hash: str
    created_at: datetime

    class Config:
        from_attributes = True
