# IBVAP — Intelligent Border Video Analytics Platform

**PS 26187** · Ministry of Home Affairs — Sashastra Seema Bal (SSB), Police II Division · **Theme:** Blockchain & Cybersecurity

A software fusion layer that turns SSB's existing CCTV network into an AI-driven surveillance platform — detection, tracking, virtual fencing, ANPR, pose/behavior analysis, thermal detection, cross-post correlation, and a district-level risk intelligence map — without buying a single new camera.

This isn't a mockup. Every feature is a real pipeline against real data; see [docs/01_FEATURES.md](docs/01_FEATURES.md) for the full live/described breakdown, and [docs/07_DEMO_SCRIPT.md](docs/07_DEMO_SCRIPT.md) for a guided walkthrough of what's actually on screen.

## Quick start

Prerequisites: Python 3.11 with venvs already set up in `backend/venv` and `edge/venv` (see `backend/requirements.txt` / `edge/requirements.txt` if setting up fresh), Node.js for `dashboard/`, and `ffmpeg` on PATH if you want to rebuild the demo footage.

```bash
# 1. Backend deps (first time only)
cd backend && python -m venv venv && ./venv/Scripts/pip install -r requirements.txt

# 2. Edge pipeline deps (first time only)
cd ../edge && python -m venv venv && ./venv/Scripts/pip install -r requirements.txt

# 3. Dashboard deps (first time only)
cd ../dashboard && npm install
```

Then, every time you want to run it:

```bash
./scripts/manage.sh reset       # clean judge-ready state (wipes accumulated events/audit history, keeps real config)
cd dashboard && npm run dev     # separately, starts the frontend dev server
```

`scripts/manage.sh` controls the backend and all four edge camera processes as one unit:

```bash
./scripts/manage.sh all status       # what's running
./scripts/manage.sh all start        # bring everything up
./scripts/manage.sh backend restart  # cycle just the backend
./scripts/manage.sh cameras restart  # cycle just the edge pipelines
./scripts/manage.sh reset            # wipe demo data, restart fresh
```

Logs land in `logs/*.log` per service if something looks stuck.

Open the dashboard (default `http://localhost:5180`), log in with any email/password (it's a UI-only gate — no real auth backend, stated on the page), and you land on the Command Console with all four cameras already streaming real footage.

## What's running under the hood

- **`edge/`** — YOLOv8n + ByteTrack detection/tracking, YOLOv8n-pose skeletal overlay, virtual-fence intrusion, person-loitering, multi-frame ANPR fusion (EasyOCR), a real thermal-trained detector for the dedicated LWIR sentry camera, MJPEG live preview. Four camera processes run simultaneously, each looping real demo footage.
- **`backend/`** — FastAPI, hash-chained tamper-evident audit log, confidence-tiered event routing with per-camera cooldown, real-time telemetry, cross-BOP correlation with real haversine travel-time prediction, NAI (Named Area of Interest) CRUD, per-camera fence config.
- **`dashboard/`** — Multi-page React command console: Command Console, Border Coverage (3D MapLibre GL + deck.gl tactical map), Live Feeds & HUD, Zone Configuration, Cross-BOP Correlation, Security Audit Log, Analytics & Health.
- **`scripts/manage.sh`** — process control and demo-data reset.

## Repository

[github.com/vizsh/SIH_IBVAP](https://github.com/vizsh/SIH_IBVAP)

## The honesty rule this whole build follows

Every number on screen is either genuinely computed from real pipeline output, or a clearly-labeled assumption/simulation — never a fabricated figure dressed up to look real. A few examples that show up across the codebase and docs:
- The multi-sensor oscilloscope carries a persistent "SIMULATED — no UGS/mic hardware installed" badge.
- The thermal sentry camera is framed as a dedicated LWIR-only post, never as an RGB camera "switching" to thermal — no camera here has co-located sensors to actually do that.
- The District Risk Index's terrain factor is a documented, geography-informed assumption, not a measured reading.
- Checkpoint digital-twin structures are explicitly schematic, not an as-built architectural scan.

If you're reading the code and something looks too good, check the comment above it — the answer is usually there.

## Document index

| Doc | Covers |
|---|---|
| [docs/00_OVERVIEW.md](docs/00_OVERVIEW.md) | The problem statement, scope, one-line pitch |
| [docs/01_FEATURES.md](docs/01_FEATURES.md) | Full feature list, live vs described-only |
| [docs/02_USE_CASES.md](docs/02_USE_CASES.md) | Personas, user flows, which UI page serves whom |
| [docs/03_ARCHITECTURE.md](docs/03_ARCHITECTURE.md) | System diagram, tech stack, real API surface |
| [docs/04_DECISION_MATH.md](docs/04_DECISION_MATH.md) | Every threshold and formula, with the actual constants in code |
| [docs/05_DEPLOYMENT.md](docs/05_DEPLOYMENT.md) | What runs hosted vs local-only, and why |
| [docs/06_DATA_SOURCES.md](docs/06_DATA_SOURCES.md) | Every sourced number, traced |
| [docs/07_DEMO_SCRIPT.md](docs/07_DEMO_SCRIPT.md) | Minute-by-minute pitch runbook |
| [docs/08_ROADMAP.md](docs/08_ROADMAP.md) | Phase 0–4, what's done vs promised |
