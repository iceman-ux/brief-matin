"""Garde-fou de fidélité aux sources, entre la rédaction et la synthèse.

Deux défauts se paient cher une fois le podcast public, et aucun ne
s'entend à l'écoute :
- la reprise mot pour mot d'un titre ou d'un chapô (droit voisin de la
  presse) : contrôlée ici sans appel API ;
- le fait inventé (chiffre, nom, date, citation) : un appel au modèle de
  rédaction le cherche, un second corrige les seules répliques en cause.

Le garde-fou ne bloque jamais l'épisode : une panne, une API saturée ou une
réponse illisible laissent passer le script tel quel, avec un avertissement.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from .brand import spoken_date
from .config import ROOT, Config, api_key, test_api_key
from .sources import Item

_WORD = re.compile(r"[^\W_]+")
_QUOTE = re.compile(r"«\s*(.+?)\s*»|“\s*(.+?)\s*”", re.S)


def settings(cfg: Config) -> dict[str, Any]:
    return cfg.raw.get("fidelite") or {}


# ─── Sources du jour ────────────────────────────────────────────────────

def sources_path(cfg: Config, day: str) -> Path:
    return ROOT / settings(cfg)["sources_dir"] / f"{day}.json"


def report_path(cfg: Config, day: str) -> Path:
    return ROOT / settings(cfg)["reports_dir"] / f"{day}.json"


def save_sources(cfg: Config, items: list[Item], day: str) -> Path:
    """Garde les articles envoyés au rédacteur : sans eux, impossible de
    rejouer le contrôle d'un épisode après coup."""
    path = sources_path(cfg, day)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps([i.to_dict() for i in items], ensure_ascii=False,
                               indent=1), encoding="utf-8")
    return path


def load_sources(path: Path) -> list[Item]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [Item(**entry) for entry in data]


def prune_sources(cfg: Config, day: str) -> int:
    """Même rétention que les épisodes : on ne rejoue que ce qu'on diffuse."""
    cutoff = (datetime.strptime(day, "%Y-%m-%d")
              - timedelta(days=int(cfg.podcast["retention_days"]))
              ).strftime("%Y-%m-%d")
    removed = 0
    for path in (ROOT / settings(cfg)["sources_dir"]).glob("*.json"):
        if path.stem <= cutoff:
            path.unlink()
            removed += 1
    return removed


# ─── Contrôle de reprise, sans API ──────────────────────────────────────

def normalize_word(word: str) -> str:
    text = unicodedata.normalize("NFKD", word.casefold())
    return "".join(c for c in text if not unicodedata.combining(c))


def words(text: str) -> list[tuple[str, re.Match]]:
    """(mot normalisé, position d'origine) : la ponctuation, la casse et les
    accents ne doivent ni masquer ni fabriquer une reprise."""
    return [(normalize_word(m.group()), m) for m in _WORD.finditer(text)]


def split_quotes(text: str, max_words: int) -> tuple[list[str], list[str]]:
    """Sépare les citations courtes du reste. Une citation de personne se
    reprend forcément mot pour mot ; au-delà de max_words, ce n'est plus une
    citation mais un passage recopié, et il est contrôlé comme le reste."""
    segments: list[str] = []
    quotes: list[str] = []
    last = 0
    for match in _QUOTE.finditer(text):
        quote = match.group(1) or match.group(2)
        if len(_WORD.findall(quote)) > max_words:
            continue
        segments.append(text[last:match.start()])
        quotes.append(quote)
        last = match.end()
    segments.append(text[last:])
    return segments, quotes


@dataclass
class SourceIndex:
    ngrams: dict[tuple[str, ...], tuple[int, str]]
    items: list[Item]
    size: int


def index_sources(items: list[Item], size: int) -> SourceIndex:
    ngrams: dict[tuple[str, ...], tuple[int, str]] = {}
    for idx, item in enumerate(items):
        # Titre et chapô séparément : une suite à cheval sur les deux n'a
        # jamais été écrite comme telle.
        for field, text in (("titre", item.title), ("chapô", item.summary)):
            tokens = [n for n, _ in words(text)]
            for start in range(len(tokens) - size + 1):
                ngrams.setdefault(tuple(tokens[start:start + size]), (idx, field))
    return SourceIndex(ngrams, items, size)


def find_copies(index: SourceIndex, segments: list[str]) -> list[dict]:
    """Suites d'au moins index.size mots consécutifs présentes telles quelles
    dans une source, fusionnées quand elles se chevauchent."""
    found: list[dict] = []
    for segment in segments:
        tokens = words(segment)
        normalized = [n for n, _ in tokens]
        start = 0
        while start <= len(tokens) - index.size:
            hit = index.ngrams.get(tuple(normalized[start:start + index.size]))
            if not hit:
                start += 1
                continue
            end = start + index.size
            while end < len(tokens) and tuple(
                    normalized[end - index.size + 1:end + 1]) in index.ngrams:
                end += 1
            item = index.items[hit[0]]
            found.append({
                "mots": end - start,
                "texte": segment[tokens[start][1].start():tokens[end - 1][1].end()],
                "source": item.source,
                "champ": hit[1],
                "titre_source": item.title,
            })
            start = end
    return found


def check_copies(cfg: Config, units: list[dict],
                 index: SourceIndex) -> tuple[list[dict], list[dict]]:
    """Renvoie (reprises, citations) pour les répliques numérotées."""
    max_quote = int(settings(cfg)["quote_max_words"])
    copies: list[dict] = []
    quotes: list[dict] = []
    for unit in units:
        segments, found_quotes = split_quotes(unit["text"], max_quote)
        quotes.extend({"replique": unit["id"], "texte": q} for q in found_quotes)
        copies.extend({"replique": unit["id"], **c}
                      for c in find_copies(index, segments))
    return copies, quotes


# ─── Répliques contrôlées ───────────────────────────────────────────────

def spoken_units(cfg: Config, script: list[dict], day: date) -> list[dict]:
    """Répliques numérotées à partir de 1, sans la date posée par le code :
    « Et aujourd'hui, samedi 26 septembre. » n'est pas à vérifier."""
    prefix = f"{cfg.brand['date_lead']} {spoken_date(day)}"
    units = []
    for number, line in enumerate(script, 1):
        text, lead = line["text"], ""
        if number == 1 and text.startswith(prefix):
            lead, text = prefix, text[len(prefix):].strip()
        if text:
            units.append({"id": number, "speaker": line["speaker"],
                          "text": text, "lead": lead})
    return units


def _script_block(units: list[dict]) -> str:
    return "\n".join(f"[{u['id']}] {u['speaker']} : {u['text']}" for u in units)


# ─── Appels au modèle ───────────────────────────────────────────────────

def _ask(cfg: Config, prompt: str, thinking: str, label: str) -> tuple[dict, dict]:
    """Un appel JSON au modèle de rédaction, sans repli : le garde-fou a un
    budget d'appels fixe, et un modèle saturé le fait simplement sauter."""
    from google import genai
    from google.genai import types

    from .retry import call_with_retry
    from .writer import _extract_json

    model = cfg.models["writer"]
    key = test_api_key() if cfg.use_test_key else api_key()
    client = genai.Client(api_key=key)
    extra = {}
    if thinking:
        extra["thinking_config"] = types.ThinkingConfig(
            thinking_level=thinking.upper())
    response = call_with_retry(
        lambda: client.models.generate_content(
            model=model, contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(
                    disable=True),
                **extra)),
        attempts=int(settings(cfg)["retry_attempts"]), label=label)
    meta = response.usage_metadata
    usage = {
        "model": model,
        "input": (meta and meta.prompt_token_count) or 0,
        "output": (meta and meta.candidates_token_count) or 0,
        "thinking": (meta and meta.thoughts_token_count) or 0,
    }
    return _extract_json(response.text), usage


def _fill(template: str, values: dict[str, str]) -> str:
    text = (ROOT / "prompts" / template).read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)
    return text


def check_facts(cfg: Config, units: list[dict], items: list[Item],
                day: date) -> tuple[list[dict], dict]:
    from .writer import _date_longue, articles_block

    prompt = _fill("fidelite_fr.md", {
        "DATE_LONG": _date_longue(datetime(day.year, day.month, day.day)),
        "SOURCES": articles_block(items),
        "SCRIPT": _script_block(units),
    })
    data, usage = _ask(cfg, prompt, settings(cfg)["thinking"], "contrôle des faits")
    high = set(settings(cfg)["high_severity_types"])
    known = {u["id"] for u in units}
    problems = []
    for entry in data.get("problemes") or []:
        try:
            line = int(entry.get("replique"))
        except (TypeError, ValueError):
            continue
        if line not in known:
            continue
        kind = str(entry.get("type") or "autre").strip().lower()
        # La gravité découle du type, pas du jugement du modèle : c'est elle
        # qui déclenche une correction, elle doit être prévisible.
        problems.append({
            "replique": line,
            "extrait": str(entry.get("extrait") or "").strip(),
            "type": kind,
            "gravite": "haute" if kind in high else "basse",
            "explication": str(entry.get("explication") or "").strip(),
        })
    return problems, usage


def fix_lines(cfg: Config, units: list[dict], items: list[Item],
              copies: list[dict], problems: list[dict]) -> tuple[dict[int, str], dict]:
    """Réécrit les répliques en cause ; {numéro: nouveau texte}, vide pour
    retirer la réplique."""
    from .writer import articles_block

    by_line: dict[int, list[str]] = {}
    for c in copies:
        by_line.setdefault(c["replique"], []).append(
            f"reprise mot pour mot de {c['source']} : « {c['texte']} »")
    for p in problems:
        by_line.setdefault(p["replique"], []).append(
            f"{p['type']} non sourcé : « {p['extrait']} » — {p['explication']}")
    lookup = {u["id"]: u for u in units}
    to_fix = "\n\n".join(
        f"[{n}] {lookup[n]['speaker']} : {lookup[n]['text']}\n"
        + "\n".join(f"   - {reason}" for reason in reasons)
        for n, reasons in sorted(by_line.items()))
    prompt = _fill("correction_fr.md", {
        "SOURCES": articles_block(items),
        "SCRIPT": _script_block(units),
        "TO_FIX": to_fix,
    })
    data, usage = _ask(cfg, prompt, settings(cfg)["fix_thinking"], "correction")
    fixed: dict[int, str] = {}
    for entry in data.get("repliques") or []:
        try:
            line = int(entry.get("replique"))
        except (TypeError, ValueError):
            continue
        if line in by_line:
            fixed[line] = str(entry.get("text") or "").strip()
    missing = sorted(set(by_line) - set(fixed))
    if missing:
        raise ValueError(f"réplique(s) {missing} absente(s) de la correction")
    return fixed, usage


def apply_fixes(script: list[dict], units: list[dict],
                fixed: dict[int, str]) -> list[dict]:
    """Remplace les répliques corrigées. La date posée par le code reste en
    tête de la première, même si son accroche est retirée."""
    leads = {u["id"]: u["lead"] for u in units}
    result = []
    for number, line in enumerate(script, 1):
        if number not in fixed:
            result.append(line)
            continue
        text = " ".join(p for p in (leads.get(number, ""), fixed[number]) if p)
        if text:
            result.append({**line, "text": text})
    return result


# ─── Orchestration ──────────────────────────────────────────────────────

def _cost(cfg: Config, usages: list[dict]) -> float | None:
    from .writer import estimate_cost_usd

    costs = [estimate_cost_usd(cfg, u) for u in usages]
    if any(c is None for c in costs):
        return None
    return sum(costs)


def guard(cfg: Config, script: list[dict], items: list[Item], day: date, *,
          use_api: bool = True, fix: bool | None = None,
          report: Path | None = None) -> tuple[list[dict], dict]:
    """Contrôle le script et renvoie (script éventuellement corrigé, trace).

    N'échoue jamais : toute exception laisse le script d'origine.
    """
    conf = settings(cfg)
    trace: dict[str, Any] = {"date": day.isoformat(), "reprises": [],
                             "citations": [], "problemes": [], "corrections": [],
                             "reprises_apres": [], "appels": 0, "cout_usd": 0.0,
                             "erreurs": []}
    if not conf.get("enabled"):
        return script, trace
    fix = conf.get("fix") if fix is None else fix
    usages: list[dict] = []
    result = script
    try:
        index = index_sources(items, int(conf["copy_min_words"]))
        units = spoken_units(cfg, script, day)
        trace["reprises"], trace["citations"] = check_copies(cfg, units, index)

        if use_api and conf.get("check_facts"):
            try:
                trace["appels"] += 1
                problems, usage = check_facts(cfg, units, items, day)
                usages.append(usage)
                trace["problemes"] = problems
            except Exception as exc:  # noqa: BLE001 - ne bloque jamais
                trace["erreurs"].append(f"contrôle des faits : {_describe(exc)}")

        high = [p for p in trace["problemes"] if p["gravite"] == "haute"]
        if use_api and fix and (trace["reprises"] or high):
            try:
                trace["appels"] += 1
                fixed, usage = fix_lines(cfg, units, items, trace["reprises"], high)
                usages.append(usage)
                before = {u["id"]: u["text"] for u in units}
                result = apply_fixes(script, units, fixed)
                if len(result) < len(script) / 2:
                    raise ValueError("la correction retire plus de la moitié "
                                     "des répliques")
                trace["corrections"] = [
                    {"replique": n, "avant": before[n], "apres": text}
                    for n, text in sorted(fixed.items())]
                trace["reprises_apres"], _ = check_copies(
                    cfg, spoken_units(cfg, result, day), index)
            except Exception as exc:  # noqa: BLE001 - ne bloque jamais
                result = script
                trace["corrections"] = []
                trace["erreurs"].append(f"correction : {_describe(exc)} — "
                                        "script d'origine gardé")
    except Exception as exc:  # noqa: BLE001 - ne bloque jamais
        result = script
        trace["erreurs"].append(f"garde-fou : {_describe(exc)}")

    cost = _cost(cfg, usages)
    trace["cout_usd"] = round(cost, 4) if cost is not None else None
    trace["usage"] = usages
    if report is not None:
        try:
            report.parent.mkdir(parents=True, exist_ok=True)
            report.write_text(json.dumps(trace, ensure_ascii=False, indent=1),
                              encoding="utf-8")
        except OSError as exc:
            trace["erreurs"].append(f"trace non écrite : {exc}")
    _print_summary(trace)
    return result, trace


def _describe(exc: Exception) -> str:
    from .retry import status_code

    code = status_code(exc)
    return f"erreur {code}" if code else f"{exc.__class__.__name__}: {exc}"[:300]


def _print_summary(trace: dict) -> None:
    high = sum(p["gravite"] == "haute" for p in trace["problemes"])
    cost = trace["cout_usd"]
    cost_label = ("" if not trace["appels"] else
                  f" · ~{cost:.3f} $ de contrôle" if cost is not None
                  else " · coût du contrôle inconnu")
    print(f"   → fidélité : {len(trace['reprises'])} reprise(s), "
          f"{len(trace['citations'])} citation(s), "
          f"{len(trace['problemes'])} problème(s) dont {high} grave(s), "
          f"{len(trace['corrections'])} réplique(s) corrigée(s), "
          f"{trace['appels']} appel(s){cost_label}")
    for copy in trace["reprises_apres"]:
        print(f"   ⚠ reprise restante après correction ({copy['source']}) : "
              f"« {copy['texte']} »")
    for error in trace["erreurs"]:
        print(f"   ⚠⚠ GARDE-FOU DE FIDÉLITÉ EN ÉCHEC — {error}. L'épisode "
              "sort sans ce contrôle.")
