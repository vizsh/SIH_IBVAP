# Decision Math — What Counts as Suspicious, and Why

Every threshold below is the actual constant in the codebase, not a rounded-for-slides number. File references let you verify directly.

## 1. Virtual-fence intrusion — geometry, not classifier confidence

`edge/pipeline.py`: `INTRUSION_CONFIRM_SECONDS = 0.6`

A tracked object's centroid is tested against a polygon (`supervision.PolygonZone`) every frame. An intrusion fires only after the centroid stays **inside** the polygon for ≥0.6 seconds of continuous dwell — not on the first frame it crosses in.

**Why 0.6s specifically:** at ~5 FPS this is ≈3 consecutive frames, which suppresses single-frame detector jitter (a box that flickers in/out of the zone boundary for one frame due to detection noise) without meaningfully delaying a real crossing. This is implemented as **time-based**, not frame-count-based, so it stays correct regardless of the source's actual FPS (webcam vs. recorded file vs. RTSP).

This is the platform's most defensible accuracy claim — it rests on tracking continuity and polygon math, not a model's confidence score.

## 2. Loitering — person-only, anchor-based dwell

`edge/pipeline.py`: `LOITER_THRESHOLD_SECONDS = 20.0` (demo value; doc's production default is 90s), `LOITER_RESET_FRACTION = 0.15`

Two decisions that shipped as a fix after real-video testing exposed the naive version:

- **Person-only.** A parked vehicle sitting still is not "loitering" — the threat catalogue's Case 9 defines this as *person reconnaissance behaviour*. Vehicles are excluded entirely, by construction (`if kind == "person":` gate), not by tuning a threshold.
- **Anchor-reset, not total-time-visible.** A per-track anchor position is recorded; if a person's centroid drifts more than 15% of frame width from the anchor, the dwell clock resets. This means someone walking steadily across the frame for 20+ seconds does **not** trigger loitering — only bounded, stay-in-one-place time counts, matching the doc's actual definition ("stationary **or pacing near** a spot," not "present anywhere for a while").

## 3. Multi-frame ANPR fusion — modal vote, not single-frame trust

`edge/anpr.py`: `PlateVoter`, `MIN_OCR_SAMPLES = 5` (in `pipeline.py`)

Single-frame OCR accuracy compounds badly: if plate localisation succeeds 95% of the time and character recognition is ~92% accurate per character, a 10-character plate's full-string single-frame accuracy is only ≈0.95 × 0.92¹⁰ ≈ **41%**. The fix requires no new model — just voting:

```
for each frame a vehicle is tracked:
    read OCR candidates from the crop
    keep the single best-confidence reading that frame
fuse:
    plate = most frequent string across all samples (mode)
    accuracy = (votes_for_winner / total_samples) × avg_confidence_of_winning_votes × 100
```

This is exactly `PlateVoter.fuse()`. Verified on real vehicle footage: 5 samples, `93.5%` fused accuracy on a real plate, correctly resolving despite individual-frame OCR noise.

## 4. Confidence tiers — routing uncertainty to a human, not hiding it

`backend/app/confidence.py`: `HIGH_THRESHOLD = 0.85`, `MEDIUM_THRESHOLD = 0.55`

| Tier | Rule | Behavior |
|---|---|---|
| High | Deterministic events (virtual fence, loitering, correlation match) **or** confidence ≥ 0.85 | Auto-escalated |
| Medium | 0.55 ≤ confidence < 0.85 | Queued for human review |
| Low | confidence < 0.55 | Logged silently, searchable later |

**Why deterministic events always auto-escalate regardless of their numeric confidence:** their accuracy claim rests on geometry/timers/combined-signal-agreement, not a classifier's self-reported certainty — a virtual-fence intrusion posts `confidence: 0.97` as a fixed value precisely because the number isn't really "confidence" in the ML sense, it's a near-ceiling constant reflecting that the *logic itself* is close to deterministic.

## 5. Cross-BOP correlation — travel-time window, not distance/speed math (yet)

`backend/app/correlation.py`: `CORRELATION_WINDOW = timedelta(hours=1)`

The doc's full version computes a window from `distance ÷ plausible speed range` between two named BOPs. The current implementation uses a flat 1-hour window (generous for a same-laptop demo with two virtual BOPs) rather than per-camera-pair geography, since no real BOP distance data exists to plug in yet. The matching itself — same `plate_text`, different `camera_id`, within the window, no duplicate for the same pair — is real and correctly deduped (verified: a third read of an already-correlated plate does not re-fire).

**Combined confidence:** a correlation match's confidence is `min(0.99, (confidence_a + confidence_b) / 2)` — the average of the two independent ANPR reads, reflecting that two independent detections agreeing is stronger evidence than either alone (doc Section 14.3's fusion argument), even though this is a simple average rather than a formal Bayesian combination.
