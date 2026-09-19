# Deployment

## Status: groundwork done, not yet live

Code is deployment-ready (configurable API base, Dockerfile, `render.yaml`). Going live needs accounts only a human can create — see the checklist at the bottom.

## What can't run hosted, and why

| Feature | Why it breaks on a public URL | Substitute |
|---|---|---|
| Real RTSP/webcam ingestion | A public cloud instance has no route to a physical camera | Pre-recorded video files served as the feed — same code path as real RTSP |
| Live GPU inference at speed | Free/cheap hosting tiers are CPU-only | Precompute detections for scripted demo clips, or accept CPU-speed live inference for a small demo |
| True offline-first "kill the network" | No real local edge process if everything is cloud-hosted | Client-side simulation (`NetworkKillSwitch.tsx`) mirrors what the edge box does for real |
| Persistent SQLite across redeploys | Ephemeral disks on free PaaS wipe on redeploy | Accept reseed-on-boot, or use a hosted Postgres if persistence across judge visits matters |
| Cold starts | Free-tier services sleep after inactivity | Ping the backend before a judging slot, or pay the ~$5-7/mo hobby tier for the submission window |

**The honest line for judges:** "The submission link demonstrates the full detection, tracking, virtual-fence, and alerting pipeline on recorded/synthetic feeds because a public URL has no path to a physical border camera or GPU edge box — the same code runs unmodified against RTSP on the Jetson-class hardware described in the architecture doc."

## Configuration that makes hosting possible

- **`IBVAP_DEMO_MODE`** (backend env var, default `0` locally, `1` in `backend/Dockerfile`): turns the Phase-1 synthetic event generator back on, since a hosted instance has no reachable camera to run `edge/pipeline.py` against. Local dev with a real pipeline keeps this off so demo noise doesn't drown out real events.
- **`VITE_API_URL`** (frontend build-time env var, see `dashboard/.env.example`): unset in local dev (relative `/api/*` paths via Vite's proxy); set to the deployed backend's real origin in production. Every fetch and the WebSocket URL are centralized in `dashboard/src/lib/api.ts` — verified via a real production build that the env var correctly bakes the deployed origin into the bundle.

## To actually go live

1. Push this repo to GitHub (done: [github.com/vizsh/SIH_IBVAP](https://github.com/vizsh/SIH_IBVAP))
2. **Backend**: import the repo on Render (or Railway), point it at `backend/render.yaml` / `backend/Dockerfile`. `IBVAP_DEMO_MODE=1` is already set by default.
3. **Frontend**: import the repo on Vercel, set the root directory to `dashboard/`, add env var `VITE_API_URL=<the Render backend's URL>`.
4. Ping the backend `/health` endpoint before a judging slot to avoid a cold-start delay reading as a dead demo.
5. Record/finalize 2-3 scripted demo clips (intrusion, loitering, the offline-buffering moment) — these are what a judge watching the hosted link actually sees, since the real camera pipeline can't run there.
