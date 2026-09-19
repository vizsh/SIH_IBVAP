from .schemas import ConfidenceTier, EventType

# Deterministic-first events (virtual fence, loitering) get near-ceiling
# confidence because they rest on geometry/timers, not classifier certainty.
DETERMINISTIC_EVENTS = {EventType.virtual_fence_intrusion, EventType.loitering}

HIGH_THRESHOLD = 0.85
MEDIUM_THRESHOLD = 0.55


def tier_for(event_type: EventType, confidence: float) -> ConfidenceTier:
    if event_type in DETERMINISTIC_EVENTS:
        return ConfidenceTier.high
    if confidence >= HIGH_THRESHOLD:
        return ConfidenceTier.high
    if confidence >= MEDIUM_THRESHOLD:
        return ConfidenceTier.medium
    return ConfidenceTier.low


def initial_status(tier: ConfidenceTier) -> str:
    return "auto_escalated" if tier == ConfidenceTier.high else "pending"
