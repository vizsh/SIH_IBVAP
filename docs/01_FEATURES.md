# Feature List

Tagged **LIVE** (real, verified working end-to-end), **DESCRIBED** (designed, not built — honest placeholder in the UI), or **PHASE 2+** (next build increment).

| Feature | Status | Where | Notes |
|---|---|---|---|
| Person/vehicle detection | **LIVE** | `edge/pipeline.py` (YOLOv8n) | Verified on webcam and real vehicle footage |
| Multi-object tracking | **LIVE** | `edge/pipeline.py` (ByteTrack via `supervision`) | Per-track ID persists across frames |
| Virtual-fence intrusion | **LIVE** | `edge/pipeline.py` | Time-based sustained confirmation (0.6s), not raw frame-count — see [04_DECISION_MATH.md](04_DECISION_MATH.md) |
| Person loitering | **LIVE** | `edge/pipeline.py` | Anchor-based dwell (resets on centroid drift); explicitly excludes vehicles — a parked car isn't loitering |
| Multi-frame ANPR fusion | **LIVE** | `edge/anpr.py` + `edge/pipeline.py` (EasyOCR) | Modal vote across frames, not single-frame OCR; verified against real vehicle plate footage |
| Live annotated video stream | **LIVE** | `edge/mjpeg_server.py` → dashboard `VideoPane.tsx` | MJPEG-over-HTTP, real boxes/zone burned in server-side |
| Real-time HUD telemetry | **LIVE** | `backend` `/telemetry` → `TacticalOverlay.tsx` | Real FPS/latency/track-count/geofence polygon, not decoration |
| Confidence-tiered alert routing | **LIVE** | `backend/app/confidence.py` | High auto-escalates, medium queues for review, low logs silently |
| Human-in-the-loop confirm/dismiss | **LIVE** | `AlertQueue.tsx`, `ReviewActions.tsx` | Real backend round-trip, audit-logged |
| Tamper-evident audit log | **LIVE** | `backend/app/audit.py` (SHA-256 hash chain) | `/audit/verify` recomputes the whole chain |
| Cross-BOP pattern correlation | **LIVE** | `backend/app/correlation.py` | Same plate at a different camera within a travel-time window; verified with two real edge processes |
| Command console (bento layout) | **LIVE** | `ConsolePage.tsx` | Live stats, alert queue, hardware health, edge-resilience simulator |
| Offline-first edge resilience demo | **LIVE (simulated)** | `NetworkKillSwitch.tsx` | Client-side simulation of local buffering — the real edge box does this for real; a browser demo can't kill its own backend connection meaningfully |
| Security audit log viewer | **LIVE** | `AuditLogPage.tsx` | Terminal-style, live chain verification |
| Analytics dashboard | **LIVE** | `AnalyticsPage.tsx` | Real aggregation over logged events (shadcn `chart` + Recharts) |
| Login gate | **LIVE (UI-only)** | `LoginPage.tsx` | No real auth backend — stated explicitly on the page |
| Face detection | DESCRIBED | — | Reasonable stretch (RetinaFace/MTCNN); not built |
| Face matching / watchlist | DESCRIBED | — | No legal dataset/DB access for a hackathon setting (doc Section 19.4) — described as Phase 2, not demoed |
| Night-time detection | DESCRIBED | — | Hardware-dependent (IR); doc's own honest limitation |
| Riverine crossing detection | DESCRIBED | — | Phase 2 per doc |
| Encroachment/change detection | DESCRIBED | — | Weekly-snapshot diffing, Phase 2 per doc |
| Sensor fusion (UGS/thermal/radar) | DESCRIBED | — | Forward-compatible design promise; no such sensors exist to integrate yet |
| Hosted public deployment | PHASE 2+ | `backend/Dockerfile`, `render.yaml`, `dashboard/.env.example` | Groundwork done (configurable API base, Docker-ready); needs Render/Vercel accounts to actually go live |
