"""
A virtual fence defined in real GPS coordinates instead of fixed pixel
coordinates — the whole point of geo-referencing. A fixed camera's fence
(edge/pipeline.py's --zone) is drawn once in pixel-space because the
camera never moves; a drone's fence has to be real ground coordinates,
checked against each detection's *projected* ground position instead
(see geo_projection.py), since the pixel-space view changes every frame.
"""

from dataclasses import dataclass

from shapely.geometry import Point, Polygon


@dataclass
class GeoZone:
    name: str
    polygon: Polygon  # real (lng, lat) ring — shapely's own (x, y) convention

    @classmethod
    def from_lat_lng_points(cls, name: str, points: list[tuple[float, float]]) -> "GeoZone":
        """points: [(lat, lng), ...] — the natural order everywhere else in
        this repo; converted to shapely's (lng, lat)=(x, y) internally."""
        return cls(name=name, polygon=Polygon([(lng, lat) for lat, lng in points]))

    def contains(self, lat: float, lng: float) -> bool:
        return self.polygon.contains(Point(lng, lat))
