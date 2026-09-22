# Feature List

Tagged **LIVE** (real, verified working end-to-end), **LIVE (simulated)** (a real UI/data path, but standing in for hardware that doesn't exist — always labeled as such on screen, never presented as the real thing), or **DESCRIBED** (designed, not built).

## Core detection pipeline

| Feature | Status | Where | Notes |
|---|---|---|---|
| Person/vehicle detection | **LIVE** | `edge/pipeline.py` (YOLOv8n) | Verified against real footage on all 4 camera feeds |
| Multi-object tracking | **LIVE** | `edge/pipeline.py` (ByteTrack via `supervision`) | Per-track ID persists across frames |
| Virtual-fence intrusion | **LIVE** | `edge/pipeline.py` | Time-based sustained confirmation (0.6s), not raw frame-count — see [04_DECISION_MATH.md](04_DECISION_MATH.md) |
| Person loitering | **LIVE** | `edge/pipeline.py` | Anchor-based dwell (resets on centroid drift); explicitly excludes vehicles — a parked car isn't loitering |
| Multi-frame ANPR fusion | **LIVE** | `edge/anpr.py` + `edge/pipeline.py` (EasyOCR) | Modal vote across frames; the dashboard's ANPR card renders the real frame-by-frame voting matrix, not just the fused answer |
| Skeletal pose overlay + behavior tagging | **LIVE** | `edge/pipeline.py` (YOLOv8n-pose) + `PoseOverlay.tsx` | 17 real COCO keypoints; posture tag (CIVILIAN / SUSPECT CRAWLING) from measured joint-angle geometry only — never guessed, abstains when legs aren't visible enough |
| Shadow Ghost Replay | **LIVE** | `edge/pipeline.py` (trail capture) + `GhostReplay.tsx` | Real recorded centroid trail (up to 5 min) attached to intrusion/loitering events; scrub back through where the track actually was, in the camera's own frame-space — deliberately not plotted on the geo map, since no camera here is calibrated to convert pixels to real-world coordinates |
| Thermal/LWIR sentry detection | **LIVE** | `edge/pipeline.py --sensor-mode thermal` | A genuinely thermal-trained YOLOv8 model (Hugging Face, `pitangent-ds/YOLOv8-human-detection-thermal`) against real thermal photography — not colorized RGB. Framed as a dedicated thermal-only post (`BOP-Sentry-Thermal`), never as an RGB camera "switching" to thermal, since no camera here has co-located optical+thermal sensors |
| Live annotated video stream | **LIVE** | `edge/mjpeg_server.py` → `VideoPane.tsx` | MJPEG-over-HTTP, real boxes/zone/skeleton burned in server-side |
| Real-time HUD telemetry | **LIVE** | `backend` `/telemetry` → `TacticalOverlay.tsx` | Real FPS/latency/track-count/geofence polygon/measured ambient brightness — not decoration |
| Per-camera virtual-fence configuration | **LIVE** | `ZoneConfigPage.tsx`, `FenceEditor.tsx` | Click-to-draw fence polygon against that camera's own feed; the running edge pipeline fetches and uses it on next start |

## Intelligence & command layer

| Feature | Status | Where | Notes |
|---|---|---|---|
| Confidence-tiered alert routing | **LIVE** | `backend/app/confidence.py` | High auto-escalates, medium queues for review, low logs silently |
| Per-camera alert cooldown | **LIVE** | `backend/app/main.py` | Suppresses repeat alerts of the same type on the same camera within a cooldown window (60-90s) — the real fix for a looping demo video re-triggering the same event on every loop, and genuine operator-alert-fatigue prevention for a real deployment |
| Human-in-the-loop confirm/dismiss | **LIVE** | `AlertQueue.tsx`, `ReviewActions.tsx` | Real backend round-trip, audit-logged, dismiss reason captured |
| Tamper-evident audit log | **LIVE** | `backend/app/audit.py` (SHA-256 hash chain) | `/audit/verify` recomputes the whole chain; a live chain-link visual turns pink and names the broken block on tamper |
| Cross-BOP pattern correlation | **LIVE** | `backend/app/correlation.py`, `backend/app/camera_sites.py` | Same plate at a different camera within a real haversine-distance-based travel-time window — not a flat time window |
| 3D tactical coverage map | **LIVE** | `CoverageMap.tsx` (MapLibre GL + deck.gl) | Real GPS-anchored FoV cones, event-density heatmap, target-lock reticle on active alerts, toggleable tactical grid, real Esri satellite imagery layer |
| Checkpoint digital-twin structures | **LIVE** | `cameraSites.ts` (`buildCheckpointStructure`) | Procedural watchtower/cabin/fence/gate geometry at each camera's real GPS coordinate — explicitly schematic, not an as-built scan (no external 3D asset: Sketchfab requires an account for every download, even CC0) |
| NAI intelligence markers | **LIVE** | `points_of_interest` table, `CoverageMap.tsx` | Analyst-placed Named Areas of Interest (suspected staging points, historical seizures, unmonitored crossings) — never AI-detected, since no camera can infer "this is a hideout" from video. Every add/delete is audit-logged |
| District Zone Risk Index (R_Z) | **LIVE** | `lib/riskIndex.ts`, `DistrictRiskMatrix.tsx` | Real Turf.js polygon-union coverage math over real Indian district boundaries (geohacker/india), real 30-day incident counts, NAIs folded in as weighted signal, terrain factor as a documented geography-informed assumption. Computed district areas matched real-world published figures to within ~1km² |
| Live scenario demo triggers | **LIVE** | `DemoScenarioButton.tsx` | Fires a real event through the real `/events` contract (audit-logged, WS-broadcast) for intrusion/loitering/ANPR — a scripted showcase trigger, same honesty pattern as the tamper-simulation button, never disguised as an undetected real intrusion |
| Multi-sensor fusion oscilloscope | **LIVE (simulated)** | `MultiSensorOscilloscope.tsx` | No seismic UGS or acoustic-array hardware exists — the panel says so on a persistent badge. The visual channel and "Unified Master Trigger" are driven by the real latest high-tier event's actual confidence, not synthetic data |
| Command console (bento layout) | **LIVE** | `ConsolePage.tsx` | Live stats, alert queue, hardware health, edge-resilience simulator |
| Offline-first edge resilience demo | **LIVE (simulated)** | `NetworkKillSwitch.tsx` | Client-side simulation of local buffering — the real edge box does this for real; a browser demo can't kill its own backend connection meaningfully |
| Security audit log viewer | **LIVE** | `AuditLogPage.tsx` | Terminal-style, live chain verification, real-time chain-link visual |
| Analytics dashboard | **LIVE** | `AnalyticsPage.tsx` | Real aggregation over logged events, per-camera evidence thumbnails |
| Login gate | **LIVE (UI-only)** | `LoginPage.tsx` | No real auth backend — stated explicitly on the page |

## Operations

| Feature | Status | Where | Notes |
|---|---|---|---|
| Process control script | **LIVE** | `scripts/manage.sh` | `{backend\|cameras\|all} {start\|stop\|restart\|status}` — one command instead of hunting PIDs |
| Demo-data reset | **LIVE** | `scripts/manage.sh reset`, `backend/reset_demo_data.py` | Wipes accumulated events/audit log for a clean judge-ready state; camera fences and NAI markings are left untouched since those are real configuration, not noise |

## Not built

| Feature | Status | Notes |
|---|---|---|
| Face detection / matching | DESCRIBED | No legal dataset/DB access for a hackathon setting (doc Section 19.4) — described as Phase 2, not demoed |
| Real district administrative CRUD (add/edit zones from the UI) | DESCRIBED | Zone definitions currently live in `lib/riskIndex.ts` (3 real districts); no UI to add a 4th zone yet |
| Hosted public deployment | DESCRIBED | Groundwork done (Docker, configurable API base, `render.yaml`); deliberately not pursued yet — see [08_ROADMAP.md](08_ROADMAP.md) |
