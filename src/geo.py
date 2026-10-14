"""Contrôle du lieu d'un sujet et fuseau horaire, hors ligne et sans
dépendance : contours Natural Earth 1:50m (assets/geo/countries-50m.json,
le même fichier que l'app), table ISO 3166 (assets/geo/iso3166.csv) et
table des fuseaux de la base tz (zone1970.tab).

Le modèle donne la ville, le pays (ISO-3) et les coordonnées. On ne le croit
que si le point tombe dans ce pays : sinon, pas de lieu du tout. Le fuseau
n'est jamais demandé au modèle."""

from __future__ import annotations

import csv
import math
import zoneinfo
from functools import lru_cache
from pathlib import Path

from .config import ROOT

GEO_DIR = ROOT / "assets" / "geo"
EARTH_KM_PER_DEG = 111.32

Ring = list[tuple[float, float]]


@lru_cache(maxsize=1)
def _iso_table() -> dict[str, tuple[str, str]]:
    """alpha-3 → (alpha-2, numérique sur 3 chiffres)."""
    with (GEO_DIR / "iso3166.csv").open(encoding="utf-8") as f:
        rows = csv.DictReader(line for line in f if not line.startswith("#"))
        return {r["alpha3"]: (r["alpha2"], r["numeric"]) for r in rows}


def _decode_arcs(topology: dict) -> list[Ring]:
    """Arcs TopoJSON quantifiés (deltas entiers) → coordonnées lon/lat."""
    (sx, sy), (tx, ty) = topology["transform"]["scale"], topology["transform"]["translate"]
    arcs = []
    for arc in topology["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((x * sx + tx, y * sy + ty))
        arcs.append(points)
    return arcs


def _ring(arcs: list[Ring], indexes: list[int]) -> Ring:
    ring: Ring = []
    for index in indexes:
        # Un indice négatif désigne l'arc ~index parcouru à l'envers.
        points = arcs[index] if index >= 0 else arcs[~index][::-1]
        ring.extend(points[1:] if ring else points)
    return ring


@lru_cache(maxsize=1)
def _countries() -> dict[str, list[list[Ring]]]:
    """Numéro ISO → polygones, chacun liste d'anneaux (extérieur, trous)."""
    import json

    topology = json.loads((GEO_DIR / "countries-50m.json").read_text(encoding="utf-8"))
    arcs = _decode_arcs(topology)
    countries: dict[str, list[list[Ring]]] = {}
    for geometry in topology["objects"]["countries"]["geometries"]:
        code = geometry.get("id")
        if not code:
            continue
        if geometry["type"] == "Polygon":
            polygons = [geometry["arcs"]]
        elif geometry["type"] == "MultiPolygon":
            polygons = geometry["arcs"]
        else:
            continue
        countries[code] = [[_ring(arcs, r) for r in polygon] for polygon in polygons]
    return countries


def _inside(ring: Ring, lon: float, lat: float) -> bool:
    inside = False
    j = len(ring) - 1
    for i, (xi, yi) in enumerate(ring):
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _distance_km(ring: Ring, lon: float, lat: float) -> float:
    """Distance du point au tracé, en projection équirectangulaire locale :
    assez juste pour une tolérance de quelques dizaines de kilomètres."""
    kx = EARTH_KM_PER_DEG * math.cos(math.radians(lat))
    ky = EARTH_KM_PER_DEG
    best = math.inf
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        ax, ay = (x1 - lon) * kx, (y1 - lat) * ky
        bx, by = (x2 - lon) * kx, (y2 - lat) * ky
        dx, dy = bx - ax, by - ay
        length = dx * dx + dy * dy
        t = 0.0 if length == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / length))
        best = min(best, math.hypot(ax + t * dx, ay + t * dy))
    return best


def in_country(iso3: str, lat: float, lon: float, tolerance_km: float) -> bool:
    """Vrai si le point est dans le pays, ou à moins de tolerance_km de son
    tracé : une ville côtière tombe parfois juste hors du contour simplifié."""
    codes = _iso_table().get(iso3.upper())
    polygons = _countries().get(codes[1]) if codes else None
    if not polygons:
        return False
    for polygon in polygons:
        outer, holes = polygon[0], polygon[1:]
        if _inside(outer, lon, lat) and not any(_inside(h, lon, lat) for h in holes):
            return True
    return any(_distance_km(polygon[0], lon, lat) <= tolerance_km for polygon in polygons)


def _zone_table() -> Path | None:
    # Linux et macOS : base tz du système ; Windows : paquet tzdata.
    for folder in zoneinfo.TZPATH:
        if (Path(folder) / "zone1970.tab").exists():
            return Path(folder) / "zone1970.tab"
    try:
        import tzdata
    except ImportError:
        return None
    path = Path(tzdata.__file__).parent / "zoneinfo" / "zone1970.tab"
    return path if path.exists() else None


def _coordinate(text: str, degree_digits: int) -> float:
    sign = -1 if text[0] == "-" else 1
    digits = text[1:]
    degrees = int(digits[:degree_digits])
    minutes = int(digits[degree_digits:degree_digits + 2])
    seconds = int(digits[degree_digits + 2:] or 0)
    return sign * (degrees + minutes / 60 + seconds / 3600)


@lru_cache(maxsize=1)
def _zones() -> list[tuple[set[str], float, float, str]]:
    """(pays alpha-2, lat, lon de la ville de référence, fuseau)."""
    path = _zone_table()
    if path is None:
        return []
    zones = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        countries, coords, name = line.split("\t")[:3]
        split = max(coords.rfind("+"), coords.rfind("-"))
        lat = _coordinate(coords[:split], 2)
        lon = _coordinate(coords[split:], 3)
        zones.append((set(countries.split(",")), lat, lon, name))
    return zones


def timezone_for(iso3: str, lat: float, lon: float) -> str | None:
    """Fuseau du pays dont la ville de référence est la plus proche du point.
    Exact pour un pays à un seul fuseau ; pour les autres (États-Unis,
    Russie…), celui de la grande ville la plus proche. None si inconnu."""
    codes = _iso_table().get(iso3.upper())
    if not codes:
        return None
    candidates = [z for z in _zones() if codes[0] in z[0]]
    if not candidates:
        return None
    kx = math.cos(math.radians(lat))
    return min(candidates, key=lambda z: ((z[2] - lon) * kx) ** 2 + (z[1] - lat) ** 2)[3]
