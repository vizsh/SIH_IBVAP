# Implementation Roadmap

## Phase 0 — Demo (hackathon timeframe) — **substantially complete, ahead of doc's own scope**

The doc's own Phase 0 target was Tier 1 capabilities on sample/public footage via a standalone script. What's actually shipped exceeds that:

- ✅ Detection + tracking (Tier 1)
- ✅ Virtual-fence intrusion (Tier 1)
- ✅ Loitering, person-only with anchor-based dwell (Tier 1, refined past the doc's naive version)
- ✅ Multi-frame ANPR fusion (Tier 2) — the doc scoped this as a stretch feature; it's live and verified on real footage
- ✅ Real-time alerting + event logging with a live backend and WebSocket dashboard — the doc scoped this as Phase 1 (pilot); it's already built
- ✅ Tamper-evident audit log — verified, not just designed
- ✅ Cross-BOP pattern correlation — the doc scoped this as Phase 2; it's live and verified with two real edge processes
- ⏳ Deployment groundwork done (Docker, configurable API base); actual hosted link pending account creation

Not attempted, correctly, per the doc's own "what not to attempt live" guidance (Section 19.4):
- Face matching against a watchlist — no legal dataset/DB access
- Real cross-BOP infrastructure — simulated via two edge processes on one laptop, as the doc itself recommends
- Full PostgreSQL + Kafka stack — SQLite + direct HTTP is sufficient and was the right call

## Phase 1 — Pilot (3-6 months, per doc)

Real BOP sites (Panitanki, Raxaul ICP, Jogbani ICP — the only SSB-side sites with documented camera presence), live feeds, human-in-the-loop dashboard live. Everything built in Phase 0 is the same code that would run here — no re-architecture needed, per the doc's own design principle.

## Phase 2 — Data collection (concurrent with Phase 1)

Field data for behaviour/low-light models under real conditions — feeds back into model retraining, not a live integration step.

## Phase 3 — Model refinement (3-6 months after Phase 2 data usable)

Retrain Tier 3 capabilities (night detection, behavioural recognition) on real field data. Section 5's confidence-gating stays *permanent*, not training wheels to graduate out of — even a refined model still routes uncertainty to a human.

## Phase 4 — National rollout (12-24 months, phased)

Prioritised BOPs first, per SSB's own vulnerability mapping. Backend API exposed so existing/future CIBMS-style command-and-control software consumes IBVAP's event feed — IBVAP does not replace it.

## What would come immediately after this hackathon build, in priority order

1. **Real BOP distance data** to replace the flat 1-hour correlation window with the doc's actual `distance ÷ plausible speed range` formula
2. **Per-camera virtual-fence configuration** (currently one default polygon shape; production needs a config UI per installed camera)
3. **Postgres migration** if event volume or multi-instance deployment ever requires it (SQLite is correctly sufficient for now)
4. **Real hosted deployment** once Render/Vercel accounts exist — code is ready, this is purely an account-creation blocker
