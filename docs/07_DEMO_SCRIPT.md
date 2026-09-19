# Demo Script — Minute-by-Minute Runbook

Every beat below is something that has actually been verified working, not aspirational. One timing constraint to rehearse around, flagged where it matters: **EasyOCR runs slower than real-time on CPU** — a 12-second test clip took ~230 seconds of wall-clock processing. Don't trigger the ANPR/correlation moment live and wait on stage; pre-run it and cue up the result.

## Before you go on stage

- Start the backend (`uvicorn app.main:app`) and confirm `/health` responds
- Pre-run the ANPR/correlation demo once (two `edge/pipeline.py` processes, different `--camera-id`, same test video) 60-90 seconds before your slot, so the correlation banner and audit trail are already sitting in the event history when you open the dashboard
- Have the webcam plugged in and `edge/pipeline.py --source 0` ready to launch live for the fast beats (detection, virtual fence, loitering)

## The script

**0:00 – Hook (30s)**
Open on the landing page (`/`). One line: *"CCTV at Border Out Posts currently only records. IBVAP makes it watch."* Click through the login (note out loud: "UI-only gate, no fake claims about auth we haven't built").

**0:30 – Live detection (60s)**
Land on `/console`. Launch `edge/pipeline.py --source 0` live in a terminal — walk into frame. Point out on-screen: the real bounding box, the ByteTrack ID, the tactical HUD showing **real** FPS/latency/track-count (not decoration — say this explicitly, it's a differentiator), and the geofence polygon that's the same shape burned into the video and drawn by the frontend, because both come from the same real data.

**1:30 – Virtual fence + loitering (45s)**
Walk into the geofence polygon — call out the intrusion alert landing in the queue within under a second, auto-escalated, HIGH tier. Stand still near the edge of frame for the dwell timer ring to visibly count up. Mention the fix: *"This used to also fire on parked vehicles — we caught that in testing and gated it to person-only behavior, because a parked car isn't reconnaissance."*

**2:15 – Human-in-the-loop (30s)**
Click Confirm on a medium-confidence alert — point out the crimson spark-flash and the audit-chain entry it creates. Click Dismiss on another — smooth crossfade, no jarring snap.

**2:45 – The offline-resilience moment (30s)**
Click "Simulate offline BOP" — status flips to OFFLINE/LOCAL BUFFERING, buffer counter increments live, hardware-health panel reflects the same buffered count. Click "Restore connection" — drain animation, resync. *"This simulates client-side what the real edge box does for real when border connectivity drops — SQLite buffering, resync on reconnect."*

**3:15 – ANPR + cross-BOP correlation (60s, pre-run)**
Navigate to `/correlation`. The real match from your pre-run is already there — plate text, both camera IDs, elapsed time, all backend-computed, none seeded. *"This isn't a UI trigger — two independent edge processes each read the same plate off real footage and the backend matched them within a travel-time window."* If timing allows, trigger the demo banner too and name it clearly as a demo fallback, not the real mechanism.

**4:15 – Audit log (30s)**
`/audit`. Point at "CHAIN VERIFIED." Say the sentence: *"Every alert, confirm, and dismiss is hash-chained — SHA-256 of the previous entry plus this one. Try to edit history and the chain breaks, provably."*

**4:45 – Analytics + close (45s)**
`/analytics` — real aggregation, not mock data. Close on the cost comparison from [06_DATA_SOURCES.md](06_DATA_SOURCES.md): ₹21 crore national rollout vs. ₹1,51,067 crore for CIBMS-grade hardware at the same scale, and the one honest caveat — this maximizes existing/future camera spend, it doesn't create border-wide coverage where no camera exists at all.

## Anticipated questions (answer without notes)

- **Why 5-10 FPS sampling, not full frame rate?** Compute-vs-accuracy math in [04_DECISION_MATH.md](04_DECISION_MATH.md) — tracker sees a person every 20-30cm of movement at 5 FPS, finer than detection-box localisation error.
- **Why edge-first, not cloud-first?** Intermittent border connectivity — see [05_DEPLOYMENT.md](05_DEPLOYMENT.md) for exactly what can't run hosted and why.
- **What happens on a false negative?** Confidence gating manages false *positives* (routing uncertain detections to a human); it can't recover a detection the model never made. Stated honestly, not glossed over.
- **Is the hosted link running the real pipeline?** No — say so proactively. A public URL has no route to a physical camera. The same code runs unmodified against RTSP on real edge hardware.
