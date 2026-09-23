"""Réessais avec attente exponentielle.

Les API de modèles renvoient régulièrement des 503 (surcharge) ou des 429
(quota). Ce sont des échecs temporaires : le run tourne sans personne devant
l'écran, il doit savoir attendre plutôt qu'abandonner.
"""

from __future__ import annotations

import random
import time
from typing import Callable, TypeVar

T = TypeVar("T")

# 429 quota, 500 erreur interne, 502/503/504 surcharge côté serveur.
RETRYABLE = {429, 500, 502, 503, 504}


def status_code(exc: Exception) -> int | None:
    for attr in ("code", "status_code"):
        value = getattr(exc, attr, None)
        if isinstance(value, int):
            return value
    return None


def quota_details(exc: Exception) -> str:
    """Résumé lisible d'un 429 : quel quota, quelle limite, quel délai.

    Sans ce détail, impossible de distinguer une limite par minute, qui se
    lève seule, d'un quota journalier, qui fera échouer tous les créneaux.
    Seuls des champs choisis sont extraits, jamais le corps brut, et toute
    clé connue est masquée au cas où l'API la renverrait.
    """
    import os

    body = getattr(exc, "details", None)
    error = body.get("error", body) if isinstance(body, dict) else None
    if not isinstance(error, dict):
        return "aucun détail renvoyé par l'API"

    parts: list[str] = []
    for item in error.get("details") or []:
        if not isinstance(item, dict):
            continue
        for v in item.get("violations") or []:
            dims = v.get("quotaDimensions") or {}
            where = ", ".join(f"{k}={val}" for k, val in dims.items())
            parts.append(f"quota {v.get('quotaId', '?')}"
                         f"{f' ({where})' if where else ''}"
                         f", limite {v.get('quotaValue', '?')}")
        if item.get("retryDelay"):
            parts.append(f"réessai conseillé dans {item['retryDelay']}")
    text = " ; ".join(parts) or str(error.get("message", "aucun détail"))

    for var in ("GEMINI_API_KEY", "GEMINI_API_KEY_TEST", "GOOGLE_API_KEY"):
        key = os.environ.get(var, "").strip()
        if key:
            text = text.replace(key, "***")
    return text


def call_with_retry(fn: Callable[[], T], *, attempts: int = 5,
                    base_delay: float = 4.0, label: str = "appel API",
                    verbose: bool = True) -> T:
    """Rappelle `fn` jusqu'à `attempts` fois sur erreur temporaire.

    Attente : 4 s, 8 s, 16 s, 32 s, avec ±30 % de jitter pour éviter que
    plusieurs réessais ne retombent au même instant.
    """
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception as exc:
            code = status_code(exc)
            if code not in RETRYABLE or attempt == attempts:
                # Le message final doit dire s'il y a eu des réessais ou non.
                exc.attempts_made = attempt
                raise
            delay = base_delay * (2 ** (attempt - 1)) * (0.7 + 0.6 * random.random())
            if verbose:
                print(f"   ⚠ {label} : erreur {code}, nouvelle tentative "
                      f"dans {delay:.0f} s ({attempt}/{attempts - 1})")
                if code == 429:
                    print(f"     {quota_details(exc)}")
            time.sleep(delay)
    raise RuntimeError("unreachable")
