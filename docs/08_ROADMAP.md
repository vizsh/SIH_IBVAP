# Implementation Roadmap

## Phase 0 — Demo (hackathon timeframe) — **complete, far ahead of the doc's own scope**

The reference doc's own Phase 0 target was Tier 1 capabilities on sample/public footage via a standalone script. What's actually shipped goes well past that, into territory the doc scoped for Phase 1/2 and beyond:

- ✅ Detection + tracking + pose estimation (Tier 1, plus real skeletal pose the doc didn't scope for Phase 0 at all)
- ✅ Virtual-fence intrusion, person-only loitering, multi-frame ANPR fusion (Tier 1/2)
- ✅ Real-time alerting + event logging, live backend + WebSocket dashboard (doc scoped this as Phase 1 — already built)
- ✅ Tamper-evident audit log with a live, interactive tamper demonstration
- ✅ Cross-BOP pattern correlation with real haversine-distance travel-time prediction (doc scoped this as Phase 2 — already built)
- ✅ Per-camera virtual-fence configuration (was explicitly flagged as a post-hackathon priority — now built)
- ✅ Real thermal-model detection on real thermal photography, framed honestly as a dedicated sentry post
- ✅ A 3D tactical coverage map (MapLibre GL + deck.gl): real FoV cones, event-density heatmap, target-lock reticle, real satellite imagery, procedural checkpoint digital-twin structures
- ✅ Analyst-curated NAI intelligence layer, fully audit-logged
- ✅ A District Zone Risk Index computed from real polygon-coverage math, real incident counts, and real NAI signal — not a mockup
- ✅ Per-camera alert cooldown (real operator-alert-fatigue prevention, not just a demo-looping workaround)
- ✅ Process control tooling (`scripts/manage.sh`) and a clean-state reset for repeatable demos
- ⏳ Deployment groundwork done (Docker, configurable API base); **deliberately not pursued** — see below

Not attempted, correctly, per the doc's own "what not to attempt live" guidance (Section 19.4):
- Face matching against a watchlist — no legal dataset/DB access
- Real cross-BOP infrastructure — simulated via multiple edge processes on one machine, as the doc itself recommends
- Full PostgreSQL + Kafka stack — SQLite + direct HTTP is sufficient and was the right call

## Deployment — explicitly deferred, not forgotten

A hosted public link is the one structurally significant thing left before this could be shown to someone without a live local demo. It's deliberately not being pursued right now — the feature set was still stabilizing fast enough that deploying early would just mean re-deploying repeatedly. The groundwork (`backend/Dockerfile`, `render.yaml`, `dashboard/.env.example`, configurable `VITE_API_URL`) is ready whenever this gets picked back up; see [05_DEPLOYMENT.md](05_DEPLOYMENT.md) for exactly what can and can't run hosted and why.

## Phase 1 — Pilot (3-6 months, per doc)

Real BOP sites (Panitanki, Raxaul ICP, Jogbani ICP — the only SSB-side sites the doc documents as camera-equipped), live feeds, human-in-the-loop dashboard live. Everything built in Phase 0 is the same code that would run here — no re-architecture needed, per the doc's own design principle. The District Risk Index and NAI layer would extend directly to more zones as more BOPs come online; the pattern doesn't change, just the data volume.

## Phase 2 — Data collection (concurrent with Phase 1)

Field data for behaviour/low-light models under real conditions — feeds back into model retraining, not a live integration step. This is also where a real LWIR sensor would need to be procured and co-located with an existing RGB camera, to honestly enable the "same camera switches to thermal" behavior this build deliberately avoided claiming.

## Phase 3 — Model refinement (3-6 months after Phase 2 data usable)

Retrain Tier 3 capabilities (night detection, behavioural recognition) on real field data. Section 5's confidence-gating stays *permanent*, not training wheels to graduate out of — even a refined model still routes uncertainty to a human.

## Phase 4 — National rollout (12-24 months, phased)

Prioritised BOPs first, per SSB's own vulnerability mapping. Backend API exposed so existing/future CIBMS-style command-and-control software consumes IBVAP's event feed — IBVAP does not replace it.

## What would come immediately after this build, in priority order

1. **A UI for adding new risk zones/districts** — the District Risk Index currently has 3 real zones hardcoded in `lib/riskIndex.ts`; a real deployment covering more BOPs needs this to be data-driven, not a code change per new district.
2. **Postgres migration** if event volume or multi-instance deployment ever requires it (SQLite is correctly sufficient for now, and the reset tooling built this session makes it easy to keep it that way for demos).
3. **Real hosted deployment**, once there's a stable point to freeze the feature set against — see the note above.
4. **A real co-located optical+thermal camera pair**, to honestly build the "same camera auto-switches to thermal in the dark" flow the reference doc originally asked for, rather than the dedicated-sentry-post workaround this build uses.
