"""Hébergement des mp3 dans une Release GitHub, par la CLI gh.

gh lit son jeton dans GH_TOKEN (le GITHUB_TOKEN du workflow) ou dans sa
propre connexion locale : ce module ne manipule jamais de jeton, et il
n'affiche que le message d'erreur de gh, qui n'en contient pas.
"""

from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .config import Config

# Les dates se comparent comme des chaînes ISO, comme dans l'index.
EPISODE_ASSET = re.compile(r"^brief-(\d{4}-\d{2}-\d{2})\.mp3$")


class ReleaseError(RuntimeError):
    """Échec prévisible (gh absent, pas connecté, réseau, droits)."""


@dataclass
class Asset:
    name: str
    downloads: int
    created: str
    size: int


def asset_url(cfg: Config, filename: str) -> str:
    # Redirection 302 vers le stockage de GitHub, stable tant que le dépôt
    # et le tag ne changent pas.
    return (f"https://github.com/{cfg.audio['release_repo']}/releases/"
            f"download/{cfg.audio['release_tag']}/{filename}")


def _gh(cfg: Config, *args: str) -> str:
    cmd = ["gh", *args, "--repo", cfg.audio["release_repo"]]
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, encoding="utf-8",
            timeout=cfg.audio["release_timeout_seconds"])
    except FileNotFoundError:
        raise ReleaseError("la CLI gh est introuvable") from None
    except subprocess.TimeoutExpired:
        raise ReleaseError(f"gh {args[0]} {args[1]} : pas de réponse en "
                           f"{cfg.audio['release_timeout_seconds']} s") from None
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout).strip().splitlines()
        raise ReleaseError(f"gh {args[0]} {args[1]} : "
                           f"{detail[-1] if detail else 'échec sans message'}")
    return proc.stdout


def _ensure_release(cfg: Config) -> None:
    tag = cfg.audio["release_tag"]
    try:
        _gh(cfg, "release", "view", tag, "--json", "tagName")
    except ReleaseError:
        # Absente, ou gh en panne : dans ce second cas la création échoue à
        # son tour avec un message plus parlant.
        _gh(cfg, "release", "create", tag, "--title", "Épisodes",
            "--notes", "Les mp3 du podcast, attachés ici par le run de "
                       "chaque nuit. Ne pas supprimer : le flux pointe "
                       "vers ces fichiers.",
            "--latest=false")


def upload(cfg: Config, path: Path) -> str:
    """Attache le mp3 à la Release (en remplaçant un envoi du même jour) et
    renvoie son URL publique."""
    _ensure_release(cfg)
    _gh(cfg, "release", "upload", cfg.audio["release_tag"], str(path),
        "--clobber")
    return asset_url(cfg, path.name)


def list_assets(cfg: Config) -> list[Asset]:
    out = _gh(cfg, "release", "view", cfg.audio["release_tag"],
              "--json", "assets")
    return [Asset(name=a["name"], downloads=int(a.get("downloadCount", 0)),
                  created=a.get("createdAt", ""), size=int(a.get("size", 0)))
            for a in json.loads(out).get("assets", [])]


def prune(cfg: Config, cutoff: str) -> list[str]:
    """Supprime les épisodes datés du cutoff ou avant. Balaie toute la
    Release plutôt que la seule liste des épisodes expirés : un fichier
    oublié par un run précédent en échec part au suivant."""
    removed = []
    for asset in list_assets(cfg):
        match = EPISODE_ASSET.match(asset.name)
        if match and match.group(1) <= cutoff:
            _gh(cfg, "release", "delete-asset", cfg.audio["release_tag"],
                asset.name, "--yes")
            removed.append(asset.name)
    return removed
