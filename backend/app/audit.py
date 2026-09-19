import hashlib

from sqlalchemy.orm import Session

from . import db as dbm

GENESIS_HASH = "0" * 64


def _hash(prev_hash: str, payload: str) -> str:
    return hashlib.sha256((prev_hash + payload).encode("utf-8")).hexdigest()


def append_entry(db: Session, action: str, detail: str, event_id: int | None = None) -> dbm.AuditEntry:
    """Append one entry to the hash chain. Tamper-evidence: recompute the chain
    and any edited row's stored hash will no longer match the recomputation."""
    last = db.query(dbm.AuditEntry).order_by(dbm.AuditEntry.id.desc()).first()
    prev_hash = last.entry_hash if last else GENESIS_HASH

    payload = f"{action}|{detail}|{event_id}"
    entry_hash = _hash(prev_hash, payload)

    entry = dbm.AuditEntry(
        event_id=event_id,
        action=action,
        detail=detail,
        prev_hash=prev_hash,
        entry_hash=entry_hash,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def verify_chain(db: Session) -> bool:
    return verify_chain_detailed(db)[0]


def verify_chain_detailed(db: Session) -> tuple[bool, int | None]:
    """Same recomputation as verify_chain, but also reports which block id
    is the first one whose stored hash no longer matches what it should be
    — the actual block a tamper attempt touched, not just a boolean."""
    entries = db.query(dbm.AuditEntry).order_by(dbm.AuditEntry.id.asc()).all()
    prev_hash = GENESIS_HASH
    for e in entries:
        payload = f"{e.action}|{e.detail}|{e.event_id}"
        expected = _hash(prev_hash, payload)
        if expected != e.entry_hash or e.prev_hash != prev_hash:
            return False, e.id
        prev_hash = e.entry_hash
    return True, None
