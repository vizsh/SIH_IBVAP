import asyncio
import json
import os
import random
import time
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import audit, confidence, correlation, db as dbm
from .schemas import EventIn, EventOut, EventType, FenceIn, FenceOut, POIIn, POIOut, ReviewAction, TelemetryIn
from .ws_manager import manager

app = FastAPI(title="IBVAP Backend", version="0.1.0")

# Latest telemetry per camera, in-memory only — this is live HUD state, not
# an auditable record, so it doesn't belong in the events/audit tables.
latest_telemetry: dict[str, dict] = {}

# Evidence snapshots: the actual annotated frame that triggered each alert,
# not just a text description of it. Confirmed-alert clips are exactly what
# the reference doc says should cross the edge->command boundary alongside
# metadata — this is the still-frame version of that.
EVIDENCE_DIR = Path(__file__).resolve().parent.parent / "evidence"
EVIDENCE_DIR.mkdir(exist_ok=True)
app.mount("/evidence", StaticFiles(directory=str(EVIDENCE_DIR)), name="evidence")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before real deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _broadcast_audit(entry: dbm.AuditEntry) -> None:
    await manager.broadcast(
        {
            "type": "audit",
            "data": {
                "id": entry.id,
                "event_id": entry.event_id,
                "action": entry.action,
                "entry_hash": entry.entry_hash,
                "prev_hash": entry.prev_hash,
                "created_at": entry.created_at.isoformat(),
            },
        }
    )


def _event_out(row: dbm.Event) -> EventOut:
    return EventOut(
        id=row.id,
        camera_id=row.camera_id,
        event_type=row.event_type,
        confidence=row.confidence,
        confidence_tier=row.confidence_tier,
        track_id=row.track_id,
        zone_id=row.zone_id,
        bbox=[float(x) for x in row.bbox.split(",")] if row.bbox else None,
        dwell_seconds=row.dwell_seconds,
        plate_text=row.plate_text,
        frame_timestamp=row.frame_timestamp,
        detail=row.detail,
        status=row.status,
        created_at=row.created_at,
        evidence_url=f"/evidence/{row.evidence_filename}" if row.evidence_filename else None,
        distance_km=row.distance_km,
        travel_min_minutes=row.travel_min_minutes,
        travel_max_minutes=row.travel_max_minutes,
        elapsed_minutes=row.elapsed_minutes,
        from_camera_id=row.from_camera_id,
        ocr_samples=json.loads(row.ocr_samples_json) if row.ocr_samples_json else None,
        trail=json.loads(row.trail_json) if row.trail_json else None,
        sensor_mode=row.sensor_mode,
    )


@app.on_event("startup")
def on_startup() -> None:
    dbm.init_db()


@app.get("/health")
def health():
    return {"status": "ok", "time": time.time()}


@app.post("/telemetry")
async def post_telemetry(telemetry: TelemetryIn):
    payload = telemetry.model_dump()
    payload["received_at"] = time.time()  # server-stamped, so staleness is computable regardless of client clocks
    latest_telemetry[telemetry.camera_id] = payload
    await manager.broadcast({"type": "telemetry", "data": payload})
    return {"ok": True}


@app.get("/telemetry/{camera_id}")
def get_telemetry(camera_id: str):
    return latest_telemetry.get(camera_id)


@app.get("/telemetry")
def get_all_telemetry():
    """Every camera's last-known telemetry, for the coverage map's live/idle
    status — a camera counts as LIVE only if it reported within the last
    few seconds, not just because it has ever reported at all."""
    return latest_telemetry


@app.post("/events", response_model=EventOut)
async def create_event(event: EventIn, db: Session = Depends(dbm.get_db)):
    tier = confidence.tier_for(event.event_type, event.confidence)
    status = confidence.initial_status(tier)

    row = dbm.Event(
        camera_id=event.camera_id,
        event_type=event.event_type.value,
        confidence=event.confidence,
        confidence_tier=tier.value,
        track_id=event.track_id,
        zone_id=event.zone_id,
        bbox=",".join(map(str, event.bbox)) if event.bbox else None,
        dwell_seconds=event.dwell_seconds,
        plate_text=event.plate_text,
        frame_timestamp=event.frame_timestamp,
        detail=event.detail,
        status=status,
        distance_km=event.distance_km,
        travel_min_minutes=event.travel_min_minutes,
        travel_max_minutes=event.travel_max_minutes,
        elapsed_minutes=event.elapsed_minutes,
        from_camera_id=event.from_camera_id,
        ocr_samples_json=json.dumps(event.ocr_samples) if event.ocr_samples else None,
        trail_json=json.dumps(event.trail) if event.trail else None,
        sensor_mode=event.sensor_mode,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    audit_entry = audit.append_entry(db, action="event_created", detail=f"{event.event_type.value}@{event.camera_id}", event_id=row.id)
    await _broadcast_audit(audit_entry)

    out = _event_out(row)
    await manager.broadcast({"type": "event", "data": out.model_dump(mode="json")})

    if event.event_type == EventType.anpr_read and event.plate_text:
        prior = correlation.find_correlation(db, event.plate_text, event.camera_id, row.created_at)
        if prior is not None:
            elapsed_min = correlation.minutes_between(row.created_at, prior.created_at)
            distance_km, travel_min, travel_max = correlation.predicted_window(prior.camera_id, event.camera_id)
            corr_event = EventIn(
                camera_id=event.camera_id,
                event_type=EventType.correlation_match,
                confidence=min(0.99, (event.confidence + prior.confidence) / 2),
                plate_text=event.plate_text,
                detail=f"Vehicle {event.plate_text} spotted at {event.camera_id}, {elapsed_min:.0f} min after {prior.camera_id}",
                distance_km=distance_km,
                travel_min_minutes=travel_min,
                travel_max_minutes=travel_max,
                elapsed_minutes=elapsed_min,
                from_camera_id=prior.camera_id,
            )
            await create_event(corr_event, db)

    return out


@app.get("/events", response_model=list[EventOut])
def list_events(db: Session = Depends(dbm.get_db), limit: int = 100):
    rows = db.query(dbm.Event).order_by(dbm.Event.id.desc()).limit(limit).all()
    return [_event_out(r) for r in rows]


@app.post("/events/{event_id}/evidence")
async def upload_evidence(event_id: int, file: UploadFile, db: Session = Depends(dbm.get_db)):
    row = db.query(dbm.Event).filter(dbm.Event.id == event_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="event not found")

    filename = f"{event_id}.jpg"
    contents = await file.read()
    (EVIDENCE_DIR / filename).write_bytes(contents)

    row.evidence_filename = filename
    db.commit()

    await manager.broadcast({"type": "event_updated", "data": {"id": event_id, "evidence_url": f"/evidence/{filename}"}})
    return {"ok": True, "evidence_url": f"/evidence/{filename}"}


@app.post("/events/{event_id}/review")
async def review_event(event_id: int, action: ReviewAction, db: Session = Depends(dbm.get_db)):
    row = db.query(dbm.Event).filter(dbm.Event.id == event_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="event not found")
    if action.action not in ("confirm", "dismiss"):
        raise HTTPException(status_code=400, detail="action must be confirm or dismiss")

    row.status = "confirmed" if action.action == "confirm" else "dismissed"
    db.commit()

    detail = f"reviewer action on event {event_id}"
    if action.reason:
        detail += f" — reason: {action.reason}"
    audit_entry = audit.append_entry(db, action=f"event_{action.action}", detail=detail, event_id=event_id)
    await _broadcast_audit(audit_entry)

    await manager.broadcast({"type": "event_updated", "data": {"id": event_id, "status": row.status, "reason": action.reason}})
    return {"id": event_id, "status": row.status}


@app.get("/cameras/fences", response_model=list[FenceOut])
def list_fences(db: Session = Depends(dbm.get_db)):
    rows = db.query(dbm.CameraFence).all()
    return [FenceOut(camera_id=r.camera_id, polygon=json.loads(r.polygon_json), updated_at=r.updated_at) for r in rows]


@app.get("/cameras/{camera_id}/fence", response_model=FenceOut | None)
def get_fence(camera_id: str, db: Session = Depends(dbm.get_db)):
    row = db.query(dbm.CameraFence).filter(dbm.CameraFence.camera_id == camera_id).first()
    if not row:
        return None
    return FenceOut(camera_id=row.camera_id, polygon=json.loads(row.polygon_json), updated_at=row.updated_at)


@app.put("/cameras/{camera_id}/fence", response_model=FenceOut)
async def set_fence(camera_id: str, fence: FenceIn, db: Session = Depends(dbm.get_db)):
    row = db.query(dbm.CameraFence).filter(dbm.CameraFence.camera_id == camera_id).first()
    if row:
        row.polygon_json = json.dumps(fence.polygon)
    else:
        row = dbm.CameraFence(camera_id=camera_id, polygon_json=json.dumps(fence.polygon))
        db.add(row)
    db.commit()
    db.refresh(row)

    audit_entry = audit.append_entry(db, action="fence_configured", detail=f"{camera_id} fence set to {len(fence.polygon)}-point polygon")
    await _broadcast_audit(audit_entry)
    await manager.broadcast({"type": "fence_updated", "data": {"camera_id": camera_id, "polygon": fence.polygon}})

    return FenceOut(camera_id=row.camera_id, polygon=fence.polygon, updated_at=row.updated_at)


@app.get("/poi", response_model=list[POIOut])
def list_poi(db: Session = Depends(dbm.get_db)):
    return db.query(dbm.PointOfInterest).order_by(dbm.PointOfInterest.id.desc()).all()


@app.post("/poi", response_model=POIOut)
async def create_poi(poi: POIIn, db: Session = Depends(dbm.get_db)):
    row = dbm.PointOfInterest(name=poi.name, category=poi.category.value, lat=poi.lat, lng=poi.lng, source=poi.source.value, notes=poi.notes)
    db.add(row)
    db.commit()
    db.refresh(row)

    audit_entry = audit.append_entry(
        db, action="poi_created", detail=f"NAI '{poi.name}' marked ({poi.category.value}, source: {poi.source.value})"
    )
    await _broadcast_audit(audit_entry)
    await manager.broadcast({"type": "poi_created", "data": POIOut.model_validate(row).model_dump(mode="json")})
    return row


@app.delete("/poi/{poi_id}")
async def delete_poi(poi_id: int, db: Session = Depends(dbm.get_db)):
    row = db.query(dbm.PointOfInterest).filter(dbm.PointOfInterest.id == poi_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="point of interest not found")
    name = row.name
    db.delete(row)
    db.commit()

    audit_entry = audit.append_entry(db, action="poi_deleted", detail=f"NAI '{name}' (id {poi_id}) removed")
    await _broadcast_audit(audit_entry)
    await manager.broadcast({"type": "poi_deleted", "data": {"id": poi_id}})
    return {"ok": True}


@app.get("/audit")
def get_audit(db: Session = Depends(dbm.get_db), limit: int = 200):
    rows = db.query(dbm.AuditEntry).order_by(dbm.AuditEntry.id.desc()).limit(limit).all()
    return list(reversed(rows))


@app.get("/audit/verify")
def audit_verify(db: Session = Depends(dbm.get_db)):
    ok, broken_block_id = audit.verify_chain_detailed(db)
    return {"valid": ok, "broken_block_id": broken_block_id}


@app.post("/audit/demo/tamper")
def audit_demo_tamper(db: Session = Depends(dbm.get_db)):
    """Demo-only: deliberately corrupts the oldest untampered audit entry's
    detail field, breaking the hash chain from that block forward — proving
    tamper-evidence live rather than just asserting it. Never called by the
    edge pipeline or any real code path; exists purely for the UI's
    'Simulate Log Modification' button."""
    entries = db.query(dbm.AuditEntry).order_by(dbm.AuditEntry.id.asc()).all()
    target = next((e for e in entries if "[TAMPERED]" not in e.detail), None)
    if target is None:
        raise HTTPException(status_code=400, detail="no untampered entry left to demonstrate on — restart the backend for a fresh chain")

    target.detail = f"{target.detail} [TAMPERED]"
    db.commit()
    return {"tampered_block_id": target.id}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keepalive / ignored client pings
    except WebSocketDisconnect:
        manager.disconnect(ws)


# ---------------------------------------------------------------------------
# Synthetic event generator. Real detections now come from /edge (Phase 2),
# so this defaults OFF for local dev. It stays available and env-gated for
# the hosted deployment, which has no reachable camera to run the real
# pipeline against (see deployment notes: recorded/synthetic feed only).
# ---------------------------------------------------------------------------
DEMO_MODE = os.environ.get("IBVAP_DEMO_MODE", "0") == "1"

_DEMO_EVENT_TYPES = [
    (EventType.virtual_fence_intrusion, 0.97),
    (EventType.loitering, 0.95),
    (EventType.person_detected, 0.78),
    (EventType.vehicle_detected, 0.65),
    (EventType.anpr_read, 0.42),
]


@app.on_event("startup")
async def start_demo_generator():
    if DEMO_MODE:
        asyncio.create_task(_demo_loop())


async def _demo_loop():
    await asyncio.sleep(2)
    while True:
        event_type, base_conf = random.choice(_DEMO_EVENT_TYPES)
        jitter = random.uniform(-0.1, 0.1)
        confidence_val = max(0.05, min(0.99, base_conf + jitter))
        db = dbm.SessionLocal()
        try:
            ev = EventIn(
                camera_id=random.choice(["BOP-01", "BOP-02"]),
                event_type=event_type,
                confidence=confidence_val,
                zone_id="zone-A",
                dwell_seconds=random.uniform(20, 150) if event_type == EventType.loitering else None,
                detail="synthetic demo event (Phase 1 placeholder)",
            )
            await create_event(ev, db)  # type: ignore[arg-type]
        finally:
            db.close()
        await asyncio.sleep(random.uniform(3, 6))
