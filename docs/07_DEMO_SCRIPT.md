# Demo Script — Minute-by-Minute Runbook

Every beat below is something that has actually been verified working, not aspirational. Two real timing/logistics constraints to rehearse around:

- **EasyOCR runs slower than real-time on CPU.** Don't wait on a live ANPR read on stage — the `BOP-Alpha` feed is already looping a real vehicle clip with a legible plate, so a genuine read lands naturally within the first minute or two of the pipeline being up.
- **Reset before you go on.** Three days of build/test activity accumulates thousands of events and inflates the Risk Index with test noise, not real signal. Run `./scripts/manage.sh reset` before your slot — it wipes events/audit history but keeps your camera fence configs and NAI markings.

## Before you go on stage

```bash
./scripts/manage.sh reset      # clean judge-ready state
```

Wait ~15s, then confirm everything is actually up:

```bash
./scripts/manage.sh all status
```

You should see `backend: RUNNING` and all four cameras (`BOP-01`, `BOP-Alpha`, `BOP-Bravo`, `BOP-Sentry-Thermal`) `RUNNING`. Open the dashboard, log in (any email/password — it's a UI-only gate, say so if asked), and let the feeds run for ~30s before you start talking, so the first few real detections have already landed.

## The script

**0:00 – Hook (20s)**
Open on the landing page (`/`). One line: *"CCTV at Border Out Posts currently only records. IBVAP makes it watch — and it doesn't stop at the camera feed."* Log in.

**0:20 – Command Console (45s)**
Land on `/console`. Real footage is already streaming on all 4 cameras. Point out: the live bounding box + skeletal pose overlay on `BOP-01` (a person near a fence, real pose keypoints, real posture tag), the tactical HUD showing real FPS/latency/track-count (say explicitly: not decoration), and the confidence-tier breakdown (Tier 1/2/3) in the stat row above the alert queue.

**1:05 – Virtual fence + loitering + ANPR (60s)**
Scroll the alert queue. Call out three different real detections as they appear: a `virtual_fence_intrusion` (auto-escalated, HIGH tier), a `loitering` card with the real dwell timer, and an `anpr_read` card — expand it and point at the live frame-by-frame voting matrix: *"This isn't the fused answer with the working shown after — every frame's raw OCR reading is real, and you can watch noisy readings get outvoted."*

**2:05 – Live scenario demo (30s)**
Navigate to `/coverage`. Use the **Live Scenario Demo** control at the top — pick a scenario tab (Virtual-fence / Loitering / ANPR), pick a camera, click Simulate. Narrate while it fires: *"This posts a real event through the same API the edge pipeline uses — audit-logged, confidence-tiered — so what happens next is the platform's own real reaction, not a separate demo path."* Watch the map fly to the camera, its FoV cone lock solid red, and the target reticle engage.

**2:35 – The 3D tactical map (60s)**
Stay on `/coverage`. Walk through the layer toggles: **Tactical grid** (a reference graticule, honestly labeled — not real elevation data), **Satellite** (real Esri imagery — mention *why*: OpenStreetMap's tagging turned out to be too sparse at these real BOP coordinates to build a useful vector layer, so real pixels replaced it), **Checkpoint structures** (a procedural watchtower/fence/gate at each camera's real GPS coordinate — explicitly schematic, not an as-built scan), and **Mark intel point (NAI)** — click the map, fill in a category and source, save it live. Say what it is precisely: *"An analyst-placed Named Area of Interest — a suspected staging point or a historical seizure site. No camera detects a hideout. This is what a human marks, audit-logged like everything else."*

**3:35 – District Risk Index (45s)**
Scroll down to the **District Risk & Control Matrix**. Read the formula off the panel itself. Point at one zone's breakdown — real coverage percentage (a genuine polygon union of the FoV cones intersected with the real district boundary, not an estimate), real 30-day incident count, real NAI count. *"The computed district areas came out within about a kilometer of the real published figures for these districts — that's not a coincidence, that's real GIS data."*

**4:20 – Thermal detection (30s)**
Navigate to `/live`, click the `BOP-Sentry-Thermal` chip. *"This is a real thermal-trained model — not a color filter on a night-vision camera — running on real thermal photography. It's framed as a dedicated thermal sentry post, because none of our other cameras have a co-located thermal sensor to 'switch' to, and claiming that would be dishonest."*

**4:50 – Human-in-the-loop + audit (40s)**
Back on `/console`, click Confirm on a medium-confidence alert — crimson flash, audit-chain entry. Navigate to `/audit`. Point at "CHAIN VERIFIED" and the live chain-link visual. Click **Simulate log modification** — watch the chain visual turn pink and name the exact broken block. *"Every alert, review, fence edit, and NAI marking is hash-chained. Tamper with history and the chain breaks, provably, and tells you exactly where."*

**5:30 – Close (30s)**
`/analytics` — real aggregation, real per-camera evidence thumbnails, not mock data. Close on the honest caveat that's been the platform's throughline: *"This makes every camera SSB already has smarter. It does not, by itself, create coverage where no camera physically exists — that gap is real, and we say so on the coverage page itself."*

## Anticipated questions (answer without notes)

- **Why 5-10 FPS sampling, not full frame rate?** Compute-vs-accuracy math in [04_DECISION_MATH.md](04_DECISION_MATH.md) — tracker sees a person every 20-30cm of movement at 5 FPS, finer than detection-box localisation error.
- **Why edge-first, not cloud-first?** Intermittent border connectivity — see [05_DEPLOYMENT.md](05_DEPLOYMENT.md) for exactly what can't run hosted and why.
- **Is the thermal detection real, or a colorized RGB feed?** Real — a genuinely thermal-trained YOLOv8 model, run against real thermal photography, producing real (not scripted) confidence scores. Say this proactively if it comes up; it's the one place a lot of hackathon demos fake it.
- **Where does the risk index's terrain factor come from?** A documented, geography-informed assumption per zone (Terai plains / forested foothill corridor / riverine flood belt) — the same honesty stance as every other assumption in this build (camera heading, checkpoint structure). Never presented as measured.
- **What happens on a false negative?** Confidence gating manages false *positives* (routing uncertain detections to a human); it can't recover a detection the model never made. Stated honestly, not glossed over.
- **Is this deployed / is there a public link?** Not yet, deliberately — the feature set was still stabilizing. Say so plainly rather than dodge it.
