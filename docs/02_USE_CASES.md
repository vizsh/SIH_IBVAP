# Use Cases & Personas

## Who uses this, and which screen is theirs

| Role | What they see | What they decide | Dashboard page |
|---|---|---|---|
| Duty personnel at BOP | Push alert with clip + location | Immediate physical response (patrol dispatch, radio report) | `/console` — Alert queue |
| BOP commander | Review queue of medium-confidence flags | Confirm/dismiss before it becomes actionable | `/console` — `ReviewActions.tsx` |
| Command centre (Police II Division) | Aggregated dashboard across all BOPs, cross-BOP pattern correlations | Resource allocation, pattern-level intelligence, no per-event action | `/analytics`, `/correlation` |
| System administrator | Model performance, false-positive/negative rates, edge health | Retraining triggers, hardware health monitoring | `/audit`, Hardware Health card on `/console` |

## End-to-end flow, as actually implemented

1. **Edge box** (`edge/pipeline.py`) reads a camera feed (file, RTSP, or webcam — the pipeline treats them identically), runs YOLOv8n + ByteTrack locally.
2. **Confidence gating** happens at the backend the instant an event lands (`backend/app/confidence.py`): virtual-fence intrusion, loitering, and cross-BOP correlation are deterministic-or-combined-signal events that auto-escalate; single-classifier detections (ANPR, raw detections) route by their actual confidence score.
3. **Local resilience**: the offline-simulation switch on `/console` demonstrates the concept client-side. The real edge box does this for real — SQLite buffering, resync on reconnect — which a browser-only demo can't fully replicate since killing the WebSocket also kills the demo's own connection to itself.
4. **At command**: alerts land in the live-updating alert queue (`AlertQueue.tsx`) instead of an operator watching a raw feed. The audit log (`backend/app/audit.py`) means nothing in that record can be quietly edited later — verified live via `/audit/verify` recomputing the entire hash chain.
5. **Cross-camera correlation**: when the same plate is read at a different camera within a travel-time window, `backend/app/correlation.py` fires an auto-escalated event and the frontend's global watcher (`useCorrelationWatcher.ts`) pops a full-width banner regardless of which page is open — matching a real duty-officer workflow where you shouldn't need to be staring at one specific screen to catch a critical cross-post match.

## What's deliberately NOT automated

The platform never takes action on its own — it decides how urgently to interrupt a human, and which human. Confirm/dismiss is always a human action (`ReviewActions.tsx`); the only fully automatic behavior is escalation *priority*, never a dispatched response.
