# IBVAP — Intelligent Border Video Analytics Platform

**PS 26187** · Ministry of Home Affairs — Sashastra Seema Bal (SSB), Police II Division
**Theme:** Blockchain & Cybersecurity

## One-line pitch

A software fusion layer that turns SSB's existing CCTV network into an AI-driven surveillance platform — detection, tracking, virtual fencing, ANPR, and cross-post correlation — without buying a single new camera.

## The gap

SSB guards ~2,450 km of largely open, unfenced border with Nepal and Bhutan. CCTV at Border Out Posts (BOPs) currently only *records* — detection, identification and alerting all depend on a human watching a screen continuously, which does not scale across hundreds of remote posts with thin staffing.

## What IBVAP is not

Not a request to buy new cameras, radars, or FRS/ANPR appliances. PS 26187 explicitly asks for a **software layer** that extracts intelligence from IP CCTV already installed.

## Scope

**In scope:** real-time analytics on existing/standard IP camera feeds, alerting, event logging, command-centre integration.
**Out of scope:** physical fencing, new sensor hardware procurement, satellite/radar systems (complementary, not replaced).

## What's actually built right now

This isn't a mockup. Every feature below runs against real pipelines and a real backend — see [01_FEATURES.md](01_FEATURES.md) for the live/described split.

- **Edge**: YOLOv8n + ByteTrack detection/tracking, virtual-fence intrusion, person-loitering, multi-frame ANPR fusion (EasyOCR), MJPEG live preview — all in `/edge`
- **Backend**: FastAPI, hash-chained tamper-evident audit log, confidence-tiered event routing, real-time telemetry, cross-BOP correlation detection — all in `/backend`
- **Dashboard**: multi-page React command console (not a single dashboard) — Command Console, Live Feeds/HUD, Cross-BOP Correlation, Security Audit Log, Analytics, Login — in `/dashboard`

## Repository

[github.com/vizsh/SIH_IBVAP](https://github.com/vizsh/SIH_IBVAP)

## Document index

| Doc | Covers |
|---|---|
| [01_FEATURES.md](01_FEATURES.md) | Full feature list, live vs described-only |
| [02_USE_CASES.md](02_USE_CASES.md) | Personas, user flows, which UI page serves whom |
| [03_ARCHITECTURE.md](03_ARCHITECTURE.md) | System diagram, tech stack, real API surface |
| [04_DECISION_MATH.md](04_DECISION_MATH.md) | Every threshold and formula, with the actual constants in code |
| [05_DEPLOYMENT.md](05_DEPLOYMENT.md) | What runs hosted vs local-only, and why |
| [06_DATA_SOURCES.md](06_DATA_SOURCES.md) | Every sourced number, traced |
| [07_DEMO_SCRIPT.md](07_DEMO_SCRIPT.md) | Minute-by-minute pitch runbook |
| [08_ROADMAP.md](08_ROADMAP.md) | Phase 0–4, what's done vs promised |
