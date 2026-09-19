"""
Multi-frame ANPR fusion (reference doc Section 4 / Q6): a single frame's OCR
is unreliable, so read every frame a vehicle is visible and take the modal
(most frequent) string via collections.Counter — no extra model needed
beyond the OCR itself. This mirrors the fusion math already shown in the
dashboard's demo ANPR card (dashboard/src/components/console/AnprVotingCard.tsx),
just computed here on real OCR output instead of hardcoded sample frames.

No dedicated plate-localisation model is fine-tuned yet (doc Section 19.4
flags this as a stretch item) — this reads the vehicle's own bounding-box
crop directly. Good enough to prove the fusion mechanism; a real
plate-only crop will tighten accuracy once a fine-tuned detector exists.
"""

import re
from collections import Counter
from dataclasses import dataclass, field

import cv2
import numpy as np

_PLATE_CHARS = re.compile(r"[^A-Z0-9]")
_reader = None


def get_reader():
    global _reader
    if _reader is None:
        import easyocr

        _reader = easyocr.Reader(["en"], gpu=False, verbose=False)
    return _reader


def normalize(text: str) -> str:
    return _PLATE_CHARS.sub("", text.upper())


def read_candidates(crop_bgr: np.ndarray) -> list[tuple[str, float]]:
    """Run OCR on one crop, return (normalized_text, confidence) pairs."""
    if crop_bgr.size == 0:
        return []
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    results = get_reader().readtext(gray)
    out = []
    for _bbox, text, conf in results:
        norm = normalize(text)
        if len(norm) >= 4:  # discard noise too short to plausibly be a plate
            out.append((norm, float(conf)))
    return out


@dataclass
class PlateVoter:
    """Per-track rolling buffer of OCR readings, fused on demand. Keeps the
    frame number and wall-clock timestamp per sample too, not just the
    reading — the multi-frame voting *matrix* the UI shows (Feature 2) is
    only real if it can display which frame each reading came from, not
    just the final fused answer."""

    max_samples: int = 30
    samples: list[tuple[str, float]] = field(default_factory=list)
    frame_log: list[dict] = field(default_factory=list)  # [{frame, timestamp, reading, confidence}]

    def add(self, readings: list[tuple[str, float]], frame_number: int | None = None, timestamp: float | None = None) -> None:
        # keep the single best-confidence reading per frame, if any
        if readings:
            best = max(readings, key=lambda r: r[1])
            self.samples.append(best)
            self.samples = self.samples[-self.max_samples :]
            if frame_number is not None:
                self.frame_log.append(
                    {"frame": frame_number, "timestamp": timestamp, "reading": best[0], "confidence": best[1]}
                )
                self.frame_log = self.frame_log[-self.max_samples :]

    def fuse(self) -> tuple[str, float] | None:
        if not self.samples:
            return None
        counts = Counter(text for text, _ in self.samples)
        plate, votes = counts.most_common(1)[0]
        matching_conf = [c for t, c in self.samples if t == plate]
        avg_conf = sum(matching_conf) / len(matching_conf)
        accuracy = min(99.9, (votes / len(self.samples)) * avg_conf * 100)
        return plate, accuracy
