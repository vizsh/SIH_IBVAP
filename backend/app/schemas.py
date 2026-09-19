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


class EventOut(EventIn):
    id: int
    confidence_tier: ConfidenceTier
    status: str  # "pending" | "confirmed" | "dismissed" | "auto_escalated"
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewAction(BaseModel):
    action: str  # "confirm" | "dismiss"


class TelemetryIn(BaseModel):
    """Live edge-box telemetry, pushed by the pipeline every ~second — the
    numbers the video-pane HUD overlay actually displays, not decoration."""

    camera_id: str
    fps: float
    latency_ms: float
    active_tracks: int
    zone_polygon: list[list[float]]  # [[x, y], ...] normalized 0-1 image-plane coords


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
