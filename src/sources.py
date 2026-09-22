"""Agrégation des flux RSS : récupération, normalisation, dédoublonnage."""

from __future__ import annotations

import concurrent.futures
import html
import re
import unicodedata
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone

import feedparser

from .config import Config, Source

UA = "brief-matin/1.0 (+https://github.com/)"
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


@dataclass
class Item:
    title: str
    summary: str
    link: str
    source: str
    category: str
    weight: int
    published: str  # ISO 8601 UTC

    def to_dict(self) -> dict:
        return asdict(self)


def _clean(text: str, limit: int = 400) -> str:
    text = html.unescape(text or "")
    text = _TAG_RE.sub(" ", text)
    text = _WS_RE.sub(" ", text).strip()
    return text[:limit]


def _parsed_dt(entry) -> datetime | None:
    for key in ("published_parsed", "updated_parsed"):
        tm = entry.get(key)
        if tm:
            try:
                return datetime(*tm[:6], tzinfo=timezone.utc)
            except (TypeError, ValueError):
                continue
    return None


def _fetch_one(source: Source, cutoff: datetime) -> tuple[Source, list[Item], str]:
    """Retourne (source, items, message d'erreur éventuel)."""
    try:
        feed = feedparser.parse(source.url, agent=UA)
    except Exception as exc:  # noqa: BLE001 - on ne casse jamais le run
        return source, [], f"exception: {exc}"

    if getattr(feed, "bozo", False) and not feed.entries:
        return source, [], f"illisible: {getattr(feed, 'bozo_exception', '?')}"

    items: list[Item] = []
    for entry in feed.entries:
        dt = _parsed_dt(entry)
        # Un flux sans date est gardé : mieux vaut un doublon qu'un trou.
        if dt and dt < cutoff:
            continue
        title = _clean(entry.get("title", ""), 200)
        if not title:
            continue
        items.append(
            Item(
                title=title,
                summary=_clean(entry.get("summary", "") or entry.get("description", "")),
                link=entry.get("link", ""),
                source=source.name,
                category=source.category,
                weight=source.weight,
                published=(dt or datetime.now(timezone.utc)).isoformat(),
            )
        )
    return source, items, ""


# Mots vides : ils gonflent la similarité sans rien dire du sujet.
_STOP = {
    "dans", "avec", "pour", "sans", "sous", "leur", "leurs", "cette", "cettes",
    "elle", "elles", "nous", "vous", "plus", "moins", "mais", "donc", "chez",
    "tout", "tous", "toute", "toutes", "apres", "avant", "entre", "contre",
    "depuis", "selon", "encore", "aussi", "meme", "être", "etre", "avoir",
    "fait", "faire", "vers", "pendant", "alors", "quand", "comme", "dont",
    "the", "and", "for", "with", "that", "this", "from", "have", "has",
}


def _tokens(title: str) -> frozenset[str]:
    """Sac de mots significatifs, sans accents ni casse."""
    text = unicodedata.normalize("NFKD", title.lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return frozenset(
        w for w in re.findall(r"[a-z0-9]+", text)
        if len(w) > 3 and w not in _STOP
    )


def _similar(a: frozenset[str], b: frozenset[str], threshold: float) -> bool:
    """Deux titres parlent du même sujet si leurs mots-clés se recouvrent.

    On utilise le recouvrement relatif au plus petit des deux ensembles
    (Szymkiewicz–Simpson) plutôt que Jaccard : un titre court et un titre
    long sur le même sujet doivent se rejoindre.
    """
    if not a or not b:
        return False
    common = len(a & b)
    return common / min(len(a), len(b)) >= threshold


def collect(cfg: Config, now: datetime | None = None,
            verbose: bool = True) -> tuple[list[Item], list[str]]:
    """Récupère tous les flux en parallèle et renvoie (items, avertissements)."""
    now = now or datetime.now(timezone.utc)
    hours = cfg.lookback_hours(now.weekday())
    cutoff = now - timedelta(hours=hours)

    items: list[Item] = []
    warnings: list[str] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(_fetch_one, s, cutoff) for s in cfg.sources]
        for future in concurrent.futures.as_completed(futures):
            source, got, err = future.result()
            if err:
                warnings.append(f"{source.name} — {err}")
            elif not got:
                warnings.append(f"{source.name} — 0 article sur {hours} h")
            items.extend(got)
            if verbose:
                status = "!!" if err else "ok"
                print(f"  [{status}] {source.name:28} {len(got):3} articles")

    deduped = dedupe(items, threshold=float(
        cfg.brief.get("dedupe_threshold", 0.6)))
    return deduped, warnings


def dedupe(items: list[Item], threshold: float = 0.6) -> list[Item]:
    """Regroupe les articles qui parlent du même sujet.

    Un sujet repris par cinq médias ne doit compter qu'une fois — mais le
    nombre de reprises est justement le meilleur signal d'importance dont on
    dispose. On garde donc le meilleur représentant, et on transforme les
    reprises en bonus de poids.
    """
    clusters: list[tuple[frozenset[str], Item, int]] = []
    # Les sources les plus fiables passent d'abord : elles deviennent
    # le représentant de leur cluster.
    for item in sorted(items, key=lambda i: (-i.weight, i.published)):
        toks = _tokens(item.title)
        for idx, (ctoks, rep, count) in enumerate(clusters):
            if _similar(toks, ctoks, threshold):
                # On enrichit le cluster : union des mots-clés, +1 reprise.
                clusters[idx] = (ctoks | toks, rep, count + 1)
                break
        else:
            clusters.append((toks, item, 1))

    result: list[Item] = []
    for _, rep, count in clusters:
        rep.weight += count - 1
        result.append(rep)

    result.sort(key=lambda i: (-i.weight, i.published))
    return result


def check_feeds(cfg: Config) -> int:
    """Commande de diagnostic : valide chaque flux, renvoie le nb de flux morts."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=72)
    dead = 0
    print(f"Test de {len(cfg.sources)} flux (fenêtre 72 h)\n")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda s: _fetch_one(s, cutoff), cfg.sources))
    for source, got, err in results:
        if err or not got:
            dead += 1
            print(f"  ✗ {source.name:30} {err or 'aucun article récent'}")
            print(f"     {source.url}")
        else:
            print(f"  ✓ {source.name:30} {len(got):3} articles  | ex. « {got[0].title[:60]} »")
    print(f"\n{len(cfg.sources) - dead}/{len(cfg.sources)} flux opérationnels.")
    if dead:
        print("Retire ou remplace les flux en échec dans config.yaml.")
    return dead
