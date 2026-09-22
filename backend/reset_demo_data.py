"""
Wipes accumulated events + audit log for a clean judge-ready state, without
touching real configuration (camera fences, NAI markings) — those are
operator-entered setup, not noise, so a reset shouldn't erase them.

Run with the backend stopped (scripts/manage.sh reset does this for you).
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "ibvap.db"


def main() -> None:
    if not DB_PATH.exists():
        print(f"[reset] no database at {DB_PATH} — nothing to do")
        return

    conn = sqlite3.connect(DB_PATH)
    before_events = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
    before_audit = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]

    conn.execute("DELETE FROM events")
    conn.execute("DELETE FROM audit_log")
    conn.commit()  # VACUUM can't run inside a transaction — commit first
    conn.execute("VACUUM")
    conn.close()

    print(f"[reset] cleared {before_events} events and {before_audit} audit entries")
    print("[reset] camera fences and NAI markings were left untouched")


if __name__ == "__main__":
    main()
