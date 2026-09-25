"""Signatures de la marque : réplique d'ouverture, fichiers figés, jours fériés.

Le modèle n'écrit que le corps du brief, l'accroche et l'éventuel clin
d'œil. L'ouverture et la clôture sont des enregistrements figés, montés par
tts.py : le TTS prononce mal « Lora », qui ne doit jamais lui être envoyé.
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from .config import DAY_NAMES, ROOT, Config

JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
MOIS = ["", "janvier", "février", "mars", "avril", "mai", "juin", "juillet",
        "août", "septembre", "octobre", "novembre", "décembre"]

_SENTENCE_END = re.compile(r"(?<=[.!?…])\s+")
_BRAND_NAME = re.compile(r"\blora\b", re.I)


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
    """« mardi 29 septembre. » : sans l'année, qu'on n'entend pas au réveil,
    en minuscules parce qu'elle suit « Et aujourd'hui, »."""
    number = "1er" if day.day == 1 else str(day.day)
    return f"{JOURS[day.weekday()]} {number} {MOIS[day.month]}."


def _asset(cfg: Config, relative: str | None, label: str) -> Path | None:
    """Chemin d'un fichier de marque, None s'il n'est pas configuré ou
    manque : l'épisode sort quand même, sans lui."""
    if not relative:
        return None
    path = ROOT / relative
    if not path.exists():
        print(f"   ⚠⚠ {label} introuvable ({relative}) : l'épisode sort "
              "SANS cette signature.")
        return None
    return path


def opening_file(cfg: Config) -> Path | None:
    return _asset(cfg, cfg.brand.get("opening_file"), "ouverture")


def closing_file(cfg: Config, day: date) -> Path | None:
    table = cfg.brand.get("closing_files") or {}
    relative = table.get(DAY_NAMES[day.weekday()], table.get("default"))
    return _asset(cfg, relative, "clôture")


def sonal_file(cfg: Config) -> Path | None:
    return _asset(cfg, cfg.brand.get("sonal_file"), "sonal")


def signature_speaker(cfg: Config) -> str:
    wanted = cfg.brand.get("speaker")
    known = [s.name for s in cfg.speakers]
    return wanted if wanted in known else known[0]


def clean_hook(cfg: Config, hook: str) -> tuple[str, list[str]]:
    """Retire un « Ce matin, » de tête : la réplique dit déjà « Et
    aujourd'hui, ». Signale les autres écarts sans y toucher."""
    brand = cfg.brand
    if not hook:
        return hook, ["le modèle n'a pas fourni d'accroche : la réplique "
                      "d'ouverture s'arrête à la date."]
    warnings = []
    for prefix in brand.get("hook_strip_prefixes") or []:
        if _normalize(hook).startswith(_normalize(prefix)):
            rest = hook[len(prefix):].lstrip()
            if rest:
                warnings.append(f"« {prefix} » retiré en tête de l'accroche : "
                                f"« {hook} »")
                hook = rest[0].upper() + rest[1:]
            break
    problems = []
    words = len(hook.split())
    if words > brand["hook_max_words"]:
        problems.append(f"compte {words} mots, pour "
                        f"{brand['hook_max_words']} au plus")
    if "!" in hook or "?" in hook:
        problems.append("contient « ! » ou « ? »")
    if problems:
        warnings.append(f"accroche gardée telle quelle, mais elle "
                        f"{', '.join(problems)} : « {hook} »")
    return hook, warnings


def strip_brand_name(script: list[dict]) -> tuple[list[dict], list[str]]:
    """Retire toute phrase qui contient « Lora » : le nom n'existe que dans
    les fichiers figés, le TTS le prononce mal une fois sur deux."""
    kept_lines: list[dict] = []
    removed: list[str] = []
    for line in script:
        sentences = _SENTENCE_END.split(line["text"].strip())
        kept = [s for s in sentences if not _BRAND_NAME.search(s)]
        removed.extend(s for s in sentences if _BRAND_NAME.search(s))
        if kept:
            kept_lines.append({**line, "text": " ".join(kept)})
    warnings = [f"phrase retirée, « Lora » ne passe jamais par le TTS : "
                f"« {s} »" for s in removed]
    return kept_lines, warnings


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
    """Fait précéder le corps écrit par le modèle de la réplique d'ouverture.

    Le script ne contient ni l'ouverture ni la clôture, qui sont des
    fichiers montés par tts.py. Les écarts du modèle sont signalés, jamais
    bloquants : un brief à l'accroche trop longue vaut mieux que pas de brief.
    """
    brand = cfg.brand
    hook, warnings = clean_hook(cfg, str(data.get("accroche") or "").strip())
    wink = str(data.get("clin_oeil") or "").strip()

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

    opening = " ".join(part for part in
                       (brand["date_lead"], spoken_date(day), wink, hook) if part)
    script, named = strip_brand_name(
        [{"speaker": signature_speaker(cfg), "text": opening}, *body])
    warnings.extend(named)
    data["script"] = script
    for warning in warnings:
        print(f"   ⚠ {warning}")
    return data
