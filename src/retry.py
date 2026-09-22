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
                raise
            delay = base_delay * (2 ** (attempt - 1)) * (0.7 + 0.6 * random.random())
            if verbose:
                print(f"   ⚠ {label} : erreur {code}, nouvelle tentative "
                      f"dans {delay:.0f} s ({attempt}/{attempts - 1})")
            time.sleep(delay)
    raise RuntimeError("unreachable")
