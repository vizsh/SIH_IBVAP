"""
Real-world coordinates for the only SSB-side sites the reference doc
documents as actually camera-equipped (Section 17.1): Panitanki, Raxaul
ICP, Jogbani ICP. Mirrors dashboard/src/lib/cameraSites.ts — kept in sync
manually since the two run in different languages/processes.
"""

import math

CAMERA_SITES = {
    "BOP-01": (26.9598, 88.1852),
    "BOP-Alpha": (26.9958, 84.8534),
    "BOP-Bravo": (26.3931, 87.2589),
    "BOP-02": (26.9598, 88.1852),
    "BOP-TEST2": (26.9958, 84.8534),
}

DEFAULT_SITE = CAMERA_SITES["BOP-01"]

# Rural/highway mixed roads near these BOPs, not open-highway cruising speed
# — a realistic assumption for the actual terrain, stated as an assumption.
MIN_SPEED_KMH = 30.0
MAX_SPEED_KMH = 70.0


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = a
    lat2, lon2 = b
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def predicted_travel_window_minutes(camera_a: str, camera_b: str) -> tuple[float, float, float]:
    """Real haversine distance between the two real sites, converted to a
    min/max travel time via a plausible speed range — the doc's own
    'distance ÷ plausible speed range' formula (Section 4), not a flat
    guess. Returns (distance_km, min_minutes, max_minutes)."""
    site_a = CAMERA_SITES.get(camera_a, DEFAULT_SITE)
    site_b = CAMERA_SITES.get(camera_b, DEFAULT_SITE)
    distance_km = haversine_km(site_a, site_b)
    min_minutes = (distance_km / MAX_SPEED_KMH) * 60
    max_minutes = (distance_km / MIN_SPEED_KMH) * 60
    return distance_km, min_minutes, max_minutes
