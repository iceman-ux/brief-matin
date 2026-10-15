"""Tire l'extrait de la page d'installation d'un épisode publié, hors pipeline.

    py tools/extrait.py 2026-10-15
    py -m src.main rebuild-feed

Garde l'ouverture et les premiers sujets (onboarding.excerpt.topics), coupés
au début du sujet suivant d'après les chapitres de l'épisode, avec un court
fondu de fin. Écrit docs/<excerpt.file> et, à côté, un .json avec sa date et
sa durée, que la page lit à sa prochaine génération. Le run quotidien n'y
touche jamais : l'extrait ne change que si on relance cette commande.

ffmpeg seul, comme le pipeline : aucune dépendance en plus.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src import feed as feed_mod  # noqa: E402
from src.config import load_config  # noqa: E402


def _source_mp3(cfg, episode: dict, tmp: Path) -> Path:
    """L'épisode en local : docs/episodes/ s'il y est, sinon téléchargé."""
    local = feed_mod.DOCS / "episodes" / episode["filename"]
    if local.exists():
        return local
    path = tmp / episode["filename"]
    with urllib.request.urlopen(feed_mod._audio_url(cfg, episode)) as resp:
        path.write_bytes(resp.read())
    return path


def _pause_around(cfg, path: Path, at: float) -> tuple[float, float] | None:
    """(début, fin) de la pause qui contient l'instant donné, ou None.

    Même seuil que le rabotage des silences du pipeline : sous lui, plus de
    voix, et un fondu pris là ne touche aucune syllabe.
    """
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af",
         f"silencedetect=n={cfg.audio['trim_threshold_db']}dB:d=0.05",
         "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace")
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", proc.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", proc.stderr)]
    return next(((s, e) for s, e in zip(starts, ends) if s <= at <= e), None)


def _duration(path: Path) -> float:
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True)
    return float(proc.stdout.strip())


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    day = argv[0]
    cfg = load_config()
    excerpt = cfg.raw["onboarding"]["excerpt"]
    episode = feed_mod.find_episode(day)
    if not episode:
        print(f"✗ Aucun épisode du {day} dans docs/episodes.json.", file=sys.stderr)
        return 1
    chapters_path = (feed_mod.DOCS / cfg.raw["topics"]["chapters_dir"]
                     / f"brief-{day}.json")
    if not chapters_path.exists():
        print(f"✗ Pas de chapitres pour le {day} : impossible de situer la "
              "fin du sujet.", file=sys.stderr)
        return 1
    chapters = json.loads(chapters_path.read_text(encoding="utf-8"))["chapters"]
    # Le chapitre 0 est l'ouverture : la coupe tombe au début du chapitre
    # qui suit le dernier sujet gardé.
    keep = int(excerpt["topics"])
    if len(chapters) <= keep + 1:
        print(f"✗ L'épisode du {day} n'a pas de sujet après les {keep} "
              "gardés : rien pour placer la coupe.", file=sys.stderr)
        return 1
    chapter = float(chapters[keep + 1]["startTime"])
    fade_max = int(excerpt["fade_out_ms"]) / 1000
    margin = int(cfg.audio["trim_margin_ms"]) / 1000
    out = feed_mod.DOCS / excerpt["file"]

    with tempfile.TemporaryDirectory() as tmp:
        src = _source_mp3(cfg, episode, Path(tmp))
        pause = _pause_around(cfg, src, chapter)
        if pause:
            # Coupe juste avant la voix suivante, fondu tenu dans la pause :
            # entre deux sujets, elle ne dure parfois que 0,3 s.
            cut = pause[1] - margin
            fade = max(0.0, min(fade_max, cut - pause[0]))
        else:
            print(f"⚠ Pas de pause nette autour de {chapter:.1f} s : coupe au "
                  "début du chapitre, le fondu peut toucher la voix.")
            cut, fade = chapter, fade_max
        proc = subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
             "-i", str(src), "-t", f"{cut:.3f}",
             "-af", f"afade=t=out:st={cut - fade:.3f}:d={fade:.3f}",
             "-codec:a", "libmp3lame", "-b:a", str(cfg.audio["bitrate"]),
             "-ac", "1",
             "-ar", str(cfg.audio.get("output_sample_rate")
                        or cfg.audio["sample_rate"]),
             str(out)],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        print(f"✗ ffmpeg a échoué :\n{proc.stderr}", file=sys.stderr)
        return 1

    duration = _duration(out)
    out.with_suffix(".json").write_text(json.dumps(
        {"date": day, "duration": round(duration, 1),
         "topics": [c["title"] for c in chapters[1:keep + 1]]},
        ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✓ docs/{out.name} : {duration:.1f} s, {out.stat().st_size // 1024} Ko,"
          f" du {day}. Puis : py -m src.main rebuild-feed")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
