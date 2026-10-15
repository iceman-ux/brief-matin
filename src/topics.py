"""Données des sujets publiées pour l'app et les lecteurs de podcast : début
dans l'audio, lieu contrôlé, sources, sujets liés et présence dans nos
sources sur 7 jours, chapitres.

Règle : rien n'est inventé. Une donnée douteuse ou absente est omise (pas
de null partout), et l'app masque ce qui l'affiche."""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any, Callable

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


def _same_subject(cfg: Config, topic: dict) -> Callable[[dict], bool]:
    """Règle qui relie deux sujets de jours différents : même slug, ou
    titres qui se recoupent (comme le dédoublonnage RSS)."""
    slug = topic.get("slug")
    words = _tokens(str(topic.get("title") or ""))
    threshold = float(cfg.raw["topics"]["related_title_overlap"])
    return lambda other: bool(slug and other.get("slug") == slug) or _similar(
        words, _tokens(str(other.get("title") or "")), threshold)


def _shift(date: str, days: int) -> str:
    return (datetime.strptime(date, "%Y-%m-%d")
            + timedelta(days=days)).strftime("%Y-%m-%d")


def related_count(cfg: Config, topic: dict, date: str,
                  episodes: list[dict]) -> int:
    """Sujets des related_days jours précédents qui parlent de la même chose."""
    since = _shift(date, -int(cfg.raw["topics"]["related_days"]))
    same = _same_subject(cfg, topic)
    return sum(1 for episode in episodes if since <= episode["date"] < date
               for other in episode.get("topics") or [] if same(other))


def _has_article_numbers(episode: dict) -> bool:
    return any("articles" in t for t in episode.get("topics") or [])


def trend(cfg: Config, topic: dict, date: str,
          episodes: list[dict]) -> list[int | None] | None:
    """Présence du sujet dans nos sources, jour par jour jusqu'à J : nombre
    d'articles envoyés au rédacteur sur ce sujet ou un sujet relié.

    Un jour ne compte que si l'épisode a noté les numéros de ses articles :
    la courbe commence au premier qui l'a fait, sans rattrapage. Après ce
    début, un jour sans épisode (run raté) vaut None, on ne sait pas ; un
    épisode sans sujet relié vaut 0, c'est vrai. None tant qu'il n'y a pas
    trend_min_days jours connus."""
    params = cfg.raw["topics"]
    if "articles" not in topic:
        return None
    noted = {e["date"]: e for e in episodes
             if e["date"] < date and _has_article_numbers(e)}
    first = min([*noted, date])
    same = _same_subject(cfg, topic)
    values: list[int | None] = []
    for back in range(int(params["trend_days"]) - 1, 0, -1):
        day = _shift(date, -back)
        if day < first:
            continue
        if day not in noted:
            values.append(None)
            continue
        articles: set[int] = set()
        for other in noted[day].get("topics") or []:
            if same(other):
                articles.update(other.get("articles") or [])
        values.append(len(articles))
    values.append(len(topic["articles"]))
    known = sum(1 for v in values if v is not None)
    return values if known >= int(params["trend_min_days"]) else None


def enrich(cfg: Config, topics: list[dict], date: str,
           starts: list[float | None] | None, episodes: list[dict]) -> list[dict]:
    """Sujets du jour complétés : place contrôlée (ou retirée), start,
    related7d, trend7d. Le champ place disparaît s'il est douteux, au lieu
    de valoir null : un épisode n'affiche que ce qu'il sait."""
    enriched = []
    for index, topic in enumerate(topics):
        item = {k: v for k, v in topic.items() if k != "place"}
        place = clean_place(cfg, topic.get("place"))
        if place:
            item["place"] = place
        if starts and len(starts) == len(topics) and starts[index] is not None:
            item["start"] = starts[index]
        item["related7d"] = related_count(cfg, topic, date, episodes)
        curve = trend(cfg, topic, date, episodes)
        if curve:
            item["trend7d"] = curve
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
