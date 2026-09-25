"""Signatures de la marque : ouverture et clôture fixes, jours fériés.

Le modèle n'écrit que le corps du brief, l'accroche et l'éventuel clin
d'œil : les formules fixes sont posées ici, parce qu'un modèle finit
toujours par dévier d'une phrase censée rester immuable.
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any

from .config import DAY_NAMES, Config

JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
MOIS = ["", "janvier", "février", "mars", "avril", "mai", "juin", "juillet",
        "août", "septembre", "octobre", "novembre", "décembre"]

_SENTENCE_END = re.compile(r"(?<=[.!?…])\s+")


def easter_sunday(year: int) -> date:
    """Dimanche de Pâques grégorien, algorithme de Meeus/Butcher."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return date(year, month, day + 1)


def occasion(cfg: Config, day: date) -> str | None:
    """Nom du jour férié ou symbolique, None un jour ordinaire."""
    brand = cfg.brand
    fixed = brand.get("fixed_days") or {}
    name = fixed.get(f"{day.month:02d}-{day.day:02d}")
    if name:
        return name
    offset = (day - easter_sunday(day.year)).days
    return (brand.get("easter_offsets") or {}).get(offset)


def spoken_date(day: date) -> str:
    """« Mardi 29 septembre. » : sans l'année, qu'on n'entend pas au réveil."""
    number = "1er" if day.day == 1 else str(day.day)
    return f"{JOURS[day.weekday()].capitalize()} {number} {MOIS[day.month]}."


def closing_text(cfg: Config, day: date) -> str:
    brand = cfg.brand
    table = brand["closing_by_day"]
    wish = table.get(DAY_NAMES[day.weekday()], table["default"])
    return f"{brand['closing_prefix']} {wish}"


def signature_speaker(cfg: Config) -> str:
    wanted = cfg.brand.get("speaker")
    known = [s.name for s in cfg.speakers]
    return wanted if wanted in known else known[0]


def hook_warnings(cfg: Config, hook: str) -> list[str]:
    brand = cfg.brand
    if not hook:
        return ["le modèle n'a pas fourni d'accroche : l'ouverture s'arrête "
                "à la date."]
    problems = []
    if not hook.startswith(brand["hook_prefix"]):
        problems.append(f"ne commence pas par « {brand['hook_prefix']} »")
    words = len(hook.split())
    if words > brand["hook_max_words"]:
        problems.append(f"compte {words} mots, pour "
                        f"{brand['hook_max_words']} au plus")
    if "!" in hook or "?" in hook:
        problems.append("contient « ! » ou « ? »")
    if not problems:
        return []
    return [f"accroche gardée telle quelle, mais elle {', '.join(problems)} : "
            f"« {hook} »"]


def _normalize(text: str) -> str:
    return text.replace("’", "'").casefold()


def _starts_with_any(sentence: str, prefixes: list[str]) -> bool:
    sentence = _normalize(sentence)
    return any(sentence.startswith(_normalize(p)) for p in prefixes)


def strip_signatures(cfg: Config, script: list[dict]) -> tuple[list[dict], list[str]]:
    """Retire une salutation en tête et une clôture en fin de script, si le
    modèle en a écrit malgré la consigne : le code pose les siennes."""
    brand = cfg.brand
    script = [dict(line) for line in script]
    removed: list[str] = []

    def trim(index: int, prefixes: list[str], from_start: bool) -> None:
        while script:
            line = script[index]
            sentences = _SENTENCE_END.split(line["text"].strip())
            candidate = sentences[0] if from_start else sentences[-1]
            if not _starts_with_any(candidate, prefixes):
                return
            removed.append(candidate)
            kept = sentences[1:] if from_start else sentences[:-1]
            if kept:
                line["text"] = " ".join(kept)
            else:
                script.pop(index)

    trim(0, brand.get("strip_opening") or [], from_start=True)
    trim(-1, brand.get("strip_closing") or [], from_start=False)
    warnings = [f"retiré du script, déjà assuré par la marque : « {s} »"
                for s in removed]
    return script, warnings


def assemble(cfg: Config, data: dict[str, Any], day: date) -> dict[str, Any]:
    """Encadre le corps écrit par le modèle des signatures fixes.

    Les écarts du modèle sont signalés, jamais bloquants : un brief à
    l'accroche trop longue vaut mieux que pas de brief.
    """
    brand = cfg.brand
    hook = str(data.get("accroche") or "").strip()
    wink = str(data.get("clin_oeil") or "").strip()
    warnings = hook_warnings(cfg, hook)

    today = occasion(cfg, day)
    if wink and not today:
        warnings.append(f"clin d'œil retiré, aujourd'hui n'est pas un jour "
                        f"férié : « {wink} »")
        wink = ""
    elif today and not wink:
        warnings.append(f"pas de clin d'œil pour {today}.")
    elif wink and "!" in wink:
        warnings.append(f"clin d'œil gardé tel quel, mais il contient "
                        f"« ! » : « {wink} »")

    body, stripped = strip_signatures(cfg, data["script"])
    warnings.extend(stripped)
    if not body:
        raise ValueError("Script vide une fois salutation et clôture retirées.")

    speaker = signature_speaker(cfg)
    opening = " ".join(part for part in
                       (brand["opening"], spoken_date(day), wink, hook) if part)
    data["script"] = [{"speaker": speaker, "text": opening}, *body,
                      {"speaker": speaker, "text": closing_text(cfg, day)}]
    for warning in warnings:
        print(f"   ⚠ {warning}")
    return data
