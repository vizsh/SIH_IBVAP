from datetime import datetime, timezone

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./ibvap.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String, index=True)
    event_type = Column(String, index=True)
    confidence = Column(Float)
    confidence_tier = Column(String, index=True)
    track_id = Column(Integer, nullable=True)
    zone_id = Column(String, nullable=True)
    bbox = Column(String, nullable=True)  # comma-joined floats
    dwell_seconds = Column(Float, nullable=True)
    plate_text = Column(String, nullable=True)
    frame_timestamp = Column(Float, nullable=True)
    detail = Column(String, nullable=True)
    status = Column(String, default="pending")
    evidence_filename = Column(String, nullable=True)
    distance_km = Column(Float, nullable=True)
    travel_min_minutes = Column(Float, nullable=True)
    travel_max_minutes = Column(Float, nullable=True)
    elapsed_minutes = Column(Float, nullable=True)
    from_camera_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)


class AuditEntry(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, nullable=True, index=True)
    action = Column(String)
    detail = Column(String)
    prev_hash = Column(String)
    entry_hash = Column(String)
    created_at = Column(DateTime, default=utcnow)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
