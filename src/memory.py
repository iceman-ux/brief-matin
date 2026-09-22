"""Mémoire des sujets déjà traités — c'est ce qui évite de rejouer mardi
ce qui a été dit lundi. Simple fichier JSON versionné dans le repo."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .config import ROOT, Config


@dataclass
class CoveredTopic:
    date: str      # AAAA-MM-JJ
    slug: str      # identifiant court et stable du sujet
    headline: str  # comment le brief l'a formulé ce jour-là


class Memory:
    def __init__(self, path: Path, lookback_days: int) -> None:
        self.path = path
        self.lookback_days = lookback_days
        self.entries: list[CoveredTopic] = []
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return
        self.entries = [CoveredTopic(**e) for e in data.get("covered", [])]

    def recent(self) -> list[CoveredTopic]:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=self.lookback_days)).date()
        return [e for e in self.entries if _as_date(e.date) >= cutoff]

    def as_prompt_block(self) -> str:
        """Bloc texte injecté dans le prompt du rédacteur."""
        recent = self.recent()
        if not recent:
            return "(aucun — c'est le premier brief)"
        by_day: dict[str, list[str]] = {}
        for entry in sorted(recent, key=lambda e: e.date, reverse=True):
            by_day.setdefault(entry.date, []).append(f"[{entry.slug}] {entry.headline}")
        lines = []
        for day, heads in by_day.items():
            lines.append(f"- {day} :")
            lines.extend(f"    • {h}" for h in heads)
        return "\n".join(lines)

    def add(self, date: str, topics: list[dict]) -> None:
        for topic in topics:
            slug = (topic.get("slug") or "").strip()
            if not slug:
                continue
            self.entries.append(
                CoveredTopic(date=date, slug=slug,
                             headline=(topic.get("title") or "").strip())
            )

    def save(self) -> None:
        # On purge au-delà de 60 jours : le fichier reste lisible à la main.
        cutoff = (datetime.now(timezone.utc) - timedelta(days=60)).date()
        kept = [e for e in self.entries if _as_date(e.date) >= cutoff]
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps({"covered": [e.__dict__ for e in kept]},
                       ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


def _as_date(value: str):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return datetime.now(timezone.utc).date()


def load_memory(cfg: Config) -> Memory:
    return Memory(ROOT / cfg.memory["path"], int(cfg.memory["lookback_days"]))
