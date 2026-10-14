"""Données des sujets publiées pour l'app et les lecteurs de podcast : début
dans l'audio, lieu contrôlé, sources, sujets liés sur 7 jours, chapitres.

Règle : rien n'est inventé. Une donnée douteuse ou absente est omise (pas
de null partout), et l'app masque ce qui l'affiche."""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any

from . import geo
from .config import Config
from .sources import _similar, _tokens

# Champs d'un sujet transmis à l'app, dans <lora:topics> et episodes.json.
APP_FIELDS = ("title", "start", "place", "sources", "related7d", "trend7d")
PLACE_FIELDS = ("city", "country", "iso3", "lat", "lon", "tz")


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if math.isfinite(value) else None


def clean_place(cfg: Config, raw: Any) -> dict | None:
    """Lieu du modèle, gardé seulement si le point tombe dans le pays
    annoncé ; le fuseau est calculé ici, jamais demandé au modèle."""
    if not isinstance(raw, dict):
        return None
    city = str(raw.get("city") or "").strip()
    country = str(raw.get("country") or "").strip()
    iso3 = str(raw.get("iso3") or "").strip().upper()
    lat, lon = _number(raw.get("lat")), _number(raw.get("lon"))
    if not city or not country or len(iso3) != 3 or lat is None or lon is None:
        return None
    if abs(lat) > 90 or abs(lon) > 180:
        return None
    tolerance = float(cfg.raw["topics"]["place_tolerance_km"])
    if not geo.in_country(iso3, lat, lon, tolerance):
        return None
    place = {"city": city, "country": country, "iso3": iso3,
             "lat": round(lat, 2), "lon": round(lon, 2)}
    tz = geo.timezone_for(iso3, lat, lon)
    if tz:
        place["tz"] = tz
    return place


def related_count(cfg: Config, topic: dict, date: str,
                  episodes: list[dict]) -> int:
    """Sujets des related_days jours précédents qui parlent de la même chose :
    même slug, ou titres qui se recoupent (comme le dédoublonnage RSS)."""
    params = cfg.raw["topics"]
    day = datetime.strptime(date, "%Y-%m-%d")
    since = (day - timedelta(days=int(params["related_days"]))).strftime("%Y-%m-%d")
    slug = topic.get("slug")
    words = _tokens(str(topic.get("title") or ""))
    threshold = float(params["related_title_overlap"])
    count = 0
    for episode in episodes:
        if not since <= episode["date"] < date:
            continue
        for other in episode.get("topics") or []:
            if (slug and other.get("slug") == slug) or _similar(
                    words, _tokens(str(other.get("title") or "")), threshold):
                count += 1
    return count


def enrich(cfg: Config, topics: list[dict], date: str,
           starts: list[float | None] | None, episodes: list[dict]) -> list[dict]:
    """Sujets du jour complétés : place contrôlée (ou retirée), start,
    related7d. Le champ place disparaît s'il est douteux, au lieu de valoir
    null : un épisode n'affiche que ce qu'il sait."""
    enriched = []
    for index, topic in enumerate(topics):
        item = {k: v for k, v in topic.items() if k != "place"}
        place = clean_place(cfg, topic.get("place"))
        if place:
            item["place"] = place
        if starts and len(starts) == len(topics) and starts[index] is not None:
            item["start"] = starts[index]
        item["related7d"] = related_count(cfg, topic, date, episodes)
        enriched.append(item)
    return enriched


def app_topics(topics: list[dict]) -> list[dict]:
    """Ce que l'app lit (Topic, app/src/topics.ts) : champs connus seulement."""
    result = []
    for topic in topics:
        item = {k: topic[k] for k in APP_FIELDS if k in topic}
        if "place" in item:
            item["place"] = {k: item["place"][k] for k in PLACE_FIELDS
                             if k in item["place"]}
        if item.get("title"):
            result.append(item)
    return result


def chapters(cfg: Config, topics: list[dict]) -> dict | None:
    """Chapitres Podcasting 2.0 (version 1.2.0) : un par sujet dont le début
    est connu, plus l'ouverture avant le premier. Un sujet sans début reste
    dans le chapitre précédent. None si aucun début n'est connu."""
    marks = [{"startTime": t["start"], "title": t.get("title", "")}
             for t in topics if "start" in t]
    if not marks:
        return None
    if marks[0]["startTime"] > 0:
        marks.insert(0, {"startTime": 0,
                         "title": cfg.raw["topics"]["intro_chapter"]})
    return {"version": "1.2.0", "chapters": marks}
