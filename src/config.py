"""Chargement de la configuration et des variables d'environnement."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent

# Clés des réglages par jour de la semaine, dans l'ordre de weekday().
DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday",
             "friday", "saturday", "sunday"]


def _load_dotenv() -> None:
    """Charge un .env s'il existe, sans dépendance externe."""
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


@dataclass
class Source:
    name: str
    url: str
    category: str = "france"
    weight: int = 1


@dataclass
class Speaker:
    name: str
    voice: str
    role: str = ""


@dataclass
class Config:
    raw: dict[str, Any]
    sources: list[Source] = field(default_factory=list)
    speakers: list[Speaker] = field(default_factory=list)
    # Posé par « say --out » : la synthèse passe par la clé du projet de test.
    use_test_key: bool = False
    # Posé par « say --tts-provider » : la production reste sur Gemini.
    tts_provider: str = "gemini"

    # --- accès pratiques -------------------------------------------------
    @property
    def podcast(self) -> dict[str, Any]:
        return self.raw["podcast"]

    @property
    def brief(self) -> dict[str, Any]:
        return self.raw["brief"]

    @property
    def models(self) -> dict[str, Any]:
        return self.raw["models"]

    @property
    def audio(self) -> dict[str, Any]:
        return self.raw["audio"]

    @property
    def memory(self) -> dict[str, Any]:
        return self.raw["memory"]

    @property
    def brand(self) -> dict[str, Any]:
        return self.raw["brand"]

    @property
    def elevenlabs(self) -> dict[str, Any]:
        return self.raw["elevenlabs"]

    @property
    def two_voices(self) -> bool:
        return bool(self.raw["voices"].get("two_voices", False))

    @property
    def direction(self) -> str:
        return (self.raw["voices"].get("direction") or "").strip()

    @property
    def base_url(self) -> str:
        return self.podcast["base_url"].rstrip("/")

    @property
    def target_words(self) -> int:
        return int(self.brief["target_minutes"] * self.brief["words_per_minute"])

    def lookback_hours(self, weekday: int) -> int:
        table = self.brief["lookback_hours"]
        return int(table.get(DAY_NAMES[weekday], table["default"]))

    def wants_weekly_recap(self, weekday: int) -> bool:
        return DAY_NAMES[weekday] in self.brief.get("weekly_recap_on", [])


def load_config(path: str | Path | None = None) -> Config:
    _load_dotenv()
    cfg_path = Path(path) if path else ROOT / "config.yaml"
    raw = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))

    sources = [Source(**s) for s in raw.get("sources", [])]
    speakers = [Speaker(**s) for s in raw["voices"].get("speakers", [])]
    if not speakers:
        raise ValueError("config.yaml : au moins un speaker est requis.")
    return Config(raw=raw, sources=sources, speakers=speakers)


TEST_KEY_VAR = "GEMINI_API_KEY_TEST"


def test_api_key() -> str:
    """Clé du projet Google de test, pour les essais hors production.

    Jamais de repli sur GEMINI_API_KEY : un essai qui mangerait le quota
    gratuit de la production pourrait faire échouer le brief de la nuit.
    """
    _load_dotenv()
    key = os.environ.get(TEST_KEY_VAR, "").strip()
    if not key:
        raise RuntimeError(
            f"{TEST_KEY_VAR} absente ou vide dans .env : les essais (say "
            "--out) n'utilisent jamais la clé de production. Ajoute la clé "
            "du projet de test dans .env.")
    return key


ELEVENLABS_KEY_VAR = "ELEVENLABS_API_KEY"


def elevenlabs_api_key() -> str:
    _load_dotenv()
    key = os.environ.get(ELEVENLABS_KEY_VAR, "").strip()
    if not key:
        raise RuntimeError(f"{ELEVENLABS_KEY_VAR} absente ou vide dans .env.")
    # Piège réel : la page des clés affiche un identifiant de 64 caractères
    # qui ressemble à une clé, mais l'API le refuse.
    if not key.startswith("sk_"):
        raise RuntimeError(
            f"{ELEVENLABS_KEY_VAR} ne commence pas par « sk_ » : c'est "
            "probablement l'identifiant de la clé, pas la clé. Une clé ne "
            "s'affiche qu'à sa création : crée-en une nouvelle sur "
            "elevenlabs.io (Developers > API Keys).")
    return key


def api_key() -> str:
    # Idempotent : la fonction peut être appelée sans passer par load_config().
    _load_dotenv()
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError(
            "GEMINI_API_KEY absente. Mets-la dans .env en local, ou dans les "
            "secrets du repo GitHub (Settings > Secrets and variables > Actions)."
        )
    return key
