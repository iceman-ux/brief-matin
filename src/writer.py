"""Rédaction du script par le LLM."""

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any, Callable, TypeVar

from .brand import JOURS, MOIS, occasion
from .config import ROOT, Config, api_key, test_api_key
from .memory import Memory
from .sources import Item

T = TypeVar("T")

_FORMAT_DIALOGUE = """\
Le brief est un **dialogue à deux voix**. C'est la règle qui fait toute la
différence à l'écoute : une seule voix qui déroule six sujets, c'est
soporifique quoi qu'on fasse.

{roles}

Comment on écrit un vrai dialogue, pas un faux. La plupart de ces
contraintes sont **chiffrées et vérifiables** : relis-toi et compte avant de
répondre.

- **Au moins deux sujets** sont portés par une seule voix du début à la fin,
  sans intervention de l'autre. Pas de découpage artificiel. Deux sujets
  consécutifs ne sont jamais portés en solo par la même voix : les voix
  alternent. En cas de conflit avec la limite de trois répliques
  consécutives, c'est cette limite qui prime.
- **Au moins un sujet** comporte trois échanges ou plus entre les deux voix.
- **Au moins trois répliques** du brief font moins de douze mots.
  « Même Fox News ? » est le bon calibre.
- **Une relance doit apporter quelque chose** : une information, une
  incertitude qui change la lecture du fait, ou une position contradictoire
  réellement exprimée par quelqu'un. S'il n'y a rien de tel sur un sujet,
  l'autre voix ne dit rien. Une relance creuse du type « on ignore si… » ou
  « reste à voir » est pire qu'un silence, et satisfaire un quota n'est
  jamais une raison d'en produire une.
- **Deux fonctions de relance, deux registres.** Une relance qui réagit à
  une information surprenante porte cette surprise : elle relève, s'étonne,
  souligne l'écart. Une relance qui referme un sujet est plate et posée :
  elle constate, elle n'ouvre rien, et ne prend jamais le ton de la
  surprise. Clore un sujet sur le registre de la réaction donne
  l'impression que la voix n'écoute pas l'autre et se contente de placer
  sa réplique. C'est le défaut à éviter.
- **Aucune des deux voix ne porte plus des deux tiers du texte**, en mots.
- **Jamais plus de trois répliques consécutives** par la même voix.
- **Une transition et le sujet qu'elle introduit forment une seule
  réplique** quand c'est la même voix qui les porte. Ne coupe jamais après
  « Autre dossier… » pour reprendre le sujet dans la réplique suivante.
  La seule séparation : quand une réaction au sujet précédent précède la
  transition, la réaction et la transition sont deux répliques distinctes,
  portées par des voix différentes.
- Si le brief alterne {first}-{second}-{first}-{second} sur plus de quatre
  répliques d'affilée, il est raté. Réécris-le.
- Personne ne prononce le prénom de l'autre plus d'une fois dans tout le brief.
- Aucune formule d'animateur : pas de « exactement », « tout à fait »,
  « oui, absolument », « absolument », « on en parle tout de suite »,
  « c'est là que ça devient intéressant »."""

_FORMAT_SOLO = """\
Le brief est lu par **une seule voix**, {first}, en narration continue.
Comme il n'y a pas de dialogue pour créer du relief, tout repose sur le
rythme : alterne délibérément phrases très courtes et phrases plus amples,
et marque chaque changement de sujet par une rupture nette."""


def _date_longue(dt: datetime) -> str:
    return f"{JOURS[dt.weekday()]} {dt.day} {MOIS[dt.month]} {dt.year}"


def prompt_items(cfg: Config, items: list[Item]) -> list[Item]:
    """Articles envoyés au rédacteur, les mieux classés d'abord : ce sont
    aussi les sources du jour pour le garde-fou de fidélité."""
    return items[:int(cfg.brief["prompt_articles"])]


def articles_block(items: list[Item]) -> str:
    lines = []
    for idx, item in enumerate(items, 1):
        lines.append(
            f"{idx}. [{item.category}] {item.title}\n"
            f"   source : {item.source} | {item.published[:16]}\n"
            f"   {item.summary}"
        )
    return "\n".join(lines)


def build_prompt(cfg: Config, items: list[Item], memory: Memory,
                 now: datetime) -> str:
    template = (ROOT / "prompts" / "brief_fr.md").read_text(encoding="utf-8")
    speakers = cfg.speakers

    if cfg.two_voices and len(speakers) >= 2:
        roles = "\n".join(f"- **{s.name}** : {s.role}" for s in speakers[:2])
        fmt = _FORMAT_DIALOGUE.format(
            roles=roles, first=speakers[0].name, second=speakers[1].name
        )
    else:
        fmt = _FORMAT_SOLO.format(first=speakers[0].name)

    mix = ", ".join(f"{k} ×{v}" for k, v in cfg.brief["mix"].items())

    weekly = ""
    if cfg.wants_weekly_recap(now.weekday()):
        weekly = ("- **Aujourd'hui, termine par une section « à retenir de la "
                  "semaine »** : trois lignes maximum, les fils qui se sont "
                  "vraiment déplacés depuis lundi. Pas une liste de rappels.")

    today = occasion(cfg, now.date())
    if today:
        wink = (f"- **Aujourd'hui, c'est {today}.** Fournis le champ "
                "`clin_oeil` : une seule phrase courte qui le salue, sans "
                "point d'exclamation.")
    else:
        wink = "- Jour ordinaire : pas de champ `clin_oeil`."

    replacements = {
        "{{TARGET_WORDS}}": str(cfg.target_words),
        "{{TARGET_MINUTES}}": str(cfg.brief["target_minutes"]),
        "{{TOPICS_MIN}}": str(cfg.brief["topics_min"]),
        "{{TOPICS_MAX}}": str(cfg.brief["topics_max"]),
        "{{FORMAT_BLOCK}}": fmt,
        "{{DATE_LONG}}": _date_longue(now),
        "{{LOOKBACK_HOURS}}": str(cfg.lookback_hours(now.weekday())),
        "{{MIX}}": mix,
        "{{WEEKLY_RECAP}}": weekly,
        "{{OCCASION}}": wink,
        "{{HOOK_MAX_WORDS}}": str(cfg.brand["hook_max_words"]),
        "{{MEMORY_BLOCK}}": memory.as_prompt_block(),
        "{{ARTICLES}}": articles_block(prompt_items(cfg, items)),
        "{{SPEAKER_NAMES}}": ", ".join(s.name for s in speakers),
    }
    for needle, value in replacements.items():
        template = template.replace(needle, value)
    return template


def _extract_json(text: str) -> dict[str, Any]:
    """Le modèle ajoute parfois un ```json autour. On récupère l'objet."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.+?)\s*```", text, re.S)
    if fence:
        text = fence.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"Aucun JSON dans la réponse du modèle :\n{text[:500]}")
    return json.loads(text[start:end + 1])


def write_script(cfg: Config, items: list[Item], memory: Memory,
                 now: datetime) -> dict[str, Any]:
    """Appelle le LLM et renvoie {"topics", "script", "accroche",
    "clin_oeil", "usage"} ; le script n'a pas encore ses signatures
    (brand.assemble). usage : modèle réellement utilisé et tokens facturés."""
    from google import genai
    from google.genai import types

    from .retry import call_with_retry, status_code

    prompt = build_prompt(cfg, items, memory, now)
    client = genai.Client(
        api_key=test_api_key() if cfg.use_test_key else api_key())
    thinking = writer_thinking(cfg)

    def generate(model: str, with_thinking: bool):
        extra = {}
        if with_thinking:
            extra["thinking_config"] = types.ThinkingConfig(
                thinking_level=thinking)
        return client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7,
                # Aucun outil n'est utilisé : on désactive l'appel de
                # fonction automatique, qui ne fait qu'émettre un avertissement.
                automatic_function_calling=types.AutomaticFunctionCallingConfig(
                    disable=True
                ),
                **extra,
            ),
        )

    def attempt(model: str):
        def call(with_thinking: bool):
            return call_with_retry(lambda: generate(model, with_thinking),
                                   label=f"rédaction ({model})")
        if not thinking:
            return model, call(False)
        try:
            return model, call(True)
        except Exception as exc:
            # Un repli d'une autre génération peut refuser thinking_level :
            # mieux vaut sa réflexion par défaut, plus chère, qu'un run raté.
            if status_code(exc) != 400:
                raise
            print(f"   ⚠ {model} refuse writer_thinking={thinking.lower()}, "
                  "rappel avec sa réflexion par défaut")
            return model, call(False)

    model, response = generate_with_fallbacks(writer_models(cfg), attempt)
    data = validate(cfg, _extract_json(response.text))
    meta = response.usage_metadata
    data["usage"] = {
        "model": model,
        "input": (meta and meta.prompt_token_count) or 0,
        "output": (meta and meta.candidates_token_count) or 0,
        "thinking": (meta and meta.thoughts_token_count) or 0,
    }
    return data


THINKING_LEVELS = ("MINIMAL", "LOW", "MEDIUM", "HIGH")


def writer_thinking(cfg: Config) -> str:
    """Niveau de models.writer_thinking pour l'API, vide pour le défaut."""
    level = str(cfg.models.get("writer_thinking") or "").strip().upper()
    if level and level not in THINKING_LEVELS:
        raise ValueError(
            f"models.writer_thinking = « {level.lower()} » : attendu vide ou "
            f"l'un de {', '.join(l.lower() for l in THINKING_LEVELS)}.")
    return level


def estimate_cost_usd(cfg: Config, usage: dict[str, Any]) -> float | None:
    """Coût indicatif de la rédaction ; la réflexion est payée comme la
    sortie. None pour un modèle absent de models.writer_prices."""
    price = (cfg.models.get("writer_prices") or {}).get(usage["model"])
    if not price:
        return None
    billed_output = usage["output"] + usage["thinking"]
    return (usage["input"] * price["input"]
            + billed_output * price["output"]) / 1_000_000


def writer_models(cfg: Config) -> list[str]:
    """Modèle principal puis modèles de repli, sans doublon ni vide."""
    fallbacks = cfg.models.get("writer_fallbacks") or []
    if isinstance(fallbacks, str):
        fallbacks = [fallbacks]
    models: list[str] = []
    for model in [cfg.models["writer"], *fallbacks]:
        if model and model not in models:
            models.append(model)
    return models


def generate_with_fallbacks(models: list[str], attempt: Callable[[str], T]) -> T:
    """Essaie chaque modèle dans l'ordre ; le dernier échec remonte tel quel.

    Un modèle n'est abandonné qu'après ses propres réessais : la bascule
    couvre une saturation qui dure, pas un 503 isolé.
    """
    for index, model in enumerate(models):
        try:
            return attempt(model)
        except Exception as exc:
            if index == len(models) - 1:
                raise
            print(f"   ⚠ {model} indisponible ({exc.__class__.__name__}), "
                  f"bascule sur {models[index + 1]}")
    raise ValueError("Aucun modèle de rédaction configuré (models.writer).")


def validate(cfg: Config, data: dict[str, Any]) -> dict[str, Any]:
    """Garde-fous : on préfère échouer ici que produire un mp3 cassé."""
    if not isinstance(data.get("script"), list) or not data["script"]:
        raise ValueError("Le modèle n'a pas renvoyé de script.")

    known = {s.name for s in cfg.speakers}
    default = cfg.speakers[0].name
    cleaned = []
    for line in data["script"]:
        speaker = str(line.get("speaker", "")).strip()
        text = str(line.get("text", "")).strip()
        if not text:
            continue
        if speaker not in known:
            speaker = default
        cleaned.append({"speaker": speaker, "text": text})
    if not cleaned:
        raise ValueError("Script vide après nettoyage.")
    data["script"] = cleaned
    data.setdefault("topics", [])
    data["accroche"] = str(data.get("accroche") or "").strip()
    data["clin_oeil"] = str(data.get("clin_oeil") or "").strip()
    return data


def script_to_text(cfg: Config, script: list[dict], with_names: bool) -> str:
    """Rend le script sous forme de texte prêt pour le TTS."""
    if with_names:
        return "\n".join(f"{line['speaker']}: {line['text']}" for line in script)
    return "\n\n".join(line["text"] for line in script)


def text_to_script(cfg: Config, text: str) -> list[dict]:
    """Inverse de script_to_text(with_names=True) : « Nom: texte » par ligne."""
    known = {s.name for s in cfg.speakers}
    script: list[dict] = []
    for number, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line:
            continue
        name, sep, rest = line.partition(":")
        # Seul un nom de voix connu ouvre une réplique : un « : » dans le
        # texte (« Chiffre clé : … ») ne doit pas être pris pour un locuteur.
        if sep and name.strip() in known:
            script.append({"speaker": name.strip(), "text": rest.strip()})
        elif script:
            # Ligne sans locuteur : suite de la réplique précédente, cas
            # d'un script retouché à la main.
            script[-1]["text"] = f"{script[-1]['text']} {line}".strip()
        else:
            raise ValueError(
                f"ligne {number} : aucun locuteur reconnu (attendu l'un de "
                f"{', '.join(sorted(known))}, suivi de « : »).")
    return script


def word_count(script: list[dict]) -> int:
    return sum(len(line["text"].split()) for line in script)
