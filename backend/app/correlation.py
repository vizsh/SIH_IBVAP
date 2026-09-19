"""
Cross-BOP pattern correlation (reference doc Section 16.1, Mode 1): a plate
read at one camera that reappears at a different camera within a plausible
travel-time window is a correlated pattern — no new hardware, just a shared
event database keyed by plate text and timestamp. This is genuinely cheap
because the ANPR pipeline already produces real plate strings; this module
just watches for the second sighting.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from . import camera_sites, db as dbm

# Generous enough to catch a real-world-timed match; the *predicted* window
# shown to the operator is computed separately from real site distance
# (see predicted_travel_window_minutes) and is usually much narrower — a
# demo run replays both sightings within minutes regardless of how far
# apart the real sites are, so gating on the real window would make the
# demo depend on real-world drive time. The gate stays permissive; the
# displayed math stays honest.
CORRELATION_WINDOW = timedelta(hours=6)


def find_correlation(db: Session, plate_text: str, camera_id: str, seen_at: datetime) -> dbm.Event | None:
    """Look for the same plate read at a different camera within the window,
    skipping if this exact pair has already been correlated."""
    window_start = seen_at - CORRELATION_WINDOW

    prior = (
        db.query(dbm.Event)
        .filter(
            dbm.Event.event_type == "anpr_read",
            dbm.Event.plate_text == plate_text,
            dbm.Event.camera_id != camera_id,
            dbm.Event.created_at >= window_start,
            dbm.Event.created_at <= seen_at,
        )
        .order_by(dbm.Event.created_at.desc())
        .first()
    )
    if prior is None:
        return None

    already_correlated = (
        db.query(dbm.Event)
        .filter(
            dbm.Event.event_type == "correlation_match",
            dbm.Event.plate_text == plate_text,
            dbm.Event.camera_id == camera_id,
            dbm.Event.created_at >= window_start,
        )
        .first()
    )
    if already_correlated is not None:
        return None

    return prior


def minutes_between(a: datetime, b: datetime) -> float:
    a = a if a.tzinfo else a.replace(tzinfo=timezone.utc)
    b = b if b.tzinfo else b.replace(tzinfo=timezone.utc)
    return abs((a - b).total_seconds()) / 60.0


def predicted_window(camera_a: str, camera_b: str) -> tuple[float, float, float]:
    """Real distance-based prediction (see camera_sites.py) — exposed here
    so main.py doesn't need to import camera_sites directly."""
    return camera_sites.predicted_travel_window_minutes(camera_a, camera_b)
