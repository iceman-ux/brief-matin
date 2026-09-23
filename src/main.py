"""Brief Matin — point d'entrée.

    python -m src.main run              # pipeline complet
    python -m src.main run --dry-run    # tout sauf les appels API payants
    python -m src.main run --no-audio   # script écrit, pas de TTS
    python -m src.main say [AAAA-MM-JJ] # resynthèse d'un script existant
    python -m src.main check-feeds      # diagnostic des sources RSS
    python -m src.main rebuild-feed     # régénère feed.xml depuis l'index
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from . import feed as feed_mod
from . import sources as sources_mod
from . import tts as tts_mod
from . import writer as writer_mod
from .config import ROOT, load_config, test_api_key
from .memory import load_memory
from .retry import RETRYABLE, quota_details, status_code


def _now(cfg) -> datetime:
    return datetime.now(ZoneInfo(cfg.brief["timezone"]))


def _fake_script(cfg) -> dict:
    """Script factice pour --dry-run : valide tout le pipeline sans API."""
    a = cfg.speakers[0].name
    b = cfg.speakers[1].name if len(cfg.speakers) > 1 else a
    return {
        "topics": [
            {"slug": "exemple-un", "title": "Premier sujet de test",
             "category": "france", "sources": ["Test"]},
            {"slug": "exemple-deux", "title": "Deuxième sujet de test",
             "category": "monde", "sources": ["Test"]},
        ],
        "script": [
            {"speaker": a, "text": "Ceci est un brief de test. Le pipeline "
                                   "fonctionne de bout en bout."},
            {"speaker": b, "text": "Aucun appel payant n'a été effectué."},
            {"speaker": a, "text": "À demain."},
        ],
    }


def cmd_run(args) -> int:
    cfg = load_config(args.config)
    now = _now(cfg)
    date = now.strftime("%Y-%m-%d")
    print(f"\n▌ Brief Matin — {date} ({now.strftime('%H:%M %Z')})\n")

    # Seul un run qui publie réellement a besoin d'une URL valide :
    # --dry-run et --no-audio s'arrêtent avant le flux RSS.
    publishing = not (args.dry_run or args.no_audio)
    if publishing and not _base_url_ready(cfg):
        return 2

    # Plusieurs créneaux de cron se relaient chaque nuit pour rattraper les
    # runs abandonnés par GitHub : sans cette garde, le deuxième et le
    # troisième repaieraient un brief déjà publié.
    if publishing and not args.force and feed_mod.find_episode(date):
        print(f"✓ Épisode du {date} déjà publié, rien à générer — "
              "utilise --force pour regénérer.\n")
        return 0

    # 1 ─ Sources
    print("1. Agrégation des flux")
    items, warnings = sources_mod.collect(cfg, now.astimezone(timezone.utc))
    print(f"   → {len(items)} articles uniques sur "
          f"{cfg.lookback_hours(now.weekday())} h")
    if warnings:
        print(f"   ⚠ {len(warnings)} source(s) en difficulté :")
        for w in warnings:
            print(f"     · {w}")
    if not items and not args.dry_run:
        print("✗ Aucun article récupéré — brief annulé, rien n'est publié.",
              file=sys.stderr)
        return 1

    # 2 ─ Mémoire
    memory = load_memory(cfg)
    recent = memory.recent()
    print(f"\n2. Mémoire : {len(recent)} sujets déjà traités sur "
          f"{cfg.memory['lookback_days']} jours")

    # 3 ─ Rédaction
    print("\n3. Rédaction du script")
    if args.dry_run:
        print("   (dry-run : script factice, aucun appel API)")
        data = writer_mod.validate(cfg, _fake_script(cfg))
    else:
        data = writer_mod.write_script(cfg, items, memory, now)
    script = data["script"]
    words = writer_mod.word_count(script)
    minutes = words / cfg.brief["words_per_minute"]
    print(f"   → {len(data['topics'])} sujets, {len(script)} répliques, "
          f"{words} mots (~{minutes:.1f} min)")
    for topic in data["topics"]:
        print(f"     · [{topic.get('category', '?')}] {topic.get('title', '')}")

    # Un dry-run n'écrase pas le script réel du jour : c'est lui que « say »
    # relit, et le perdre coûterait un vrai appel au modèle pour le refaire.
    script_path = (ROOT / "data" / "dry-run.txt" if args.dry_run
                   else ROOT / "data" / "scripts" / f"{date}.txt")
    script_path.parent.mkdir(parents=True, exist_ok=True)
    script_path.write_text(
        writer_mod.script_to_text(cfg, script, with_names=True), encoding="utf-8")
    print(f"   → script écrit : {script_path.relative_to(ROOT)}")

    if args.no_audio:
        print("\n--no-audio : on s'arrête là.")
        return 0

    # 4 ─ Synthèse vocale
    print("\n4. Synthèse vocale")
    mp3_name = f"brief-{date}.mp3"

    if args.dry_run:
        # Un dry-run ne laisse rien dans docs/ : le silence part dans data/,
        # jamais parmi les épisodes publiés. Pour exercer la génération du
        # flux, la commande « rebuild-feed » est là pour ça.
        mp3_path = ROOT / "data" / "dry-run.mp3"
        print("   (dry-run : silence local, hors des épisodes publiés)")
        _write_silence(cfg, mp3_path, seconds=max(int(minutes * 60), 5))
    else:
        mp3_path = feed_mod.EPISODES_DIR / mp3_name
        _print_voices(cfg)
        tts_mod.warn_if_batch_requested(cfg)
        tts_mod.synthesize(cfg, script, mp3_path)

    duration = tts_mod.audio_duration_seconds(mp3_path)
    size = mp3_path.stat().st_size
    print(f"   → {mp3_path.name} · {duration // 60}:{duration % 60:02d} · "
          f"{size / 1024:.0f} Ko · {_cost_label(cfg, duration)}")

    if args.dry_run:
        print("\n5-6. Publication et mémoire ignorées en dry-run.")
        print("\n✓ Terminé (dry-run). Rien n'a été publié.\n")
        return 0

    # 5 ─ Publication
    print("\n5. Flux podcast")
    title, summary = _episode_texts(date, data["topics"])
    episodes = feed_mod.register_episode(
        cfg, date=date, filename=mp3_name, title=title, summary=summary,
        duration=duration, size=size, topics=data["topics"])
    feed_path = feed_mod.build_feed(cfg, episodes)
    print(f"   → {len(episodes)} épisodes en ligne, "
          f"{feed_path.relative_to(ROOT)} régénéré")

    # 6 ─ Mémoire
    memory.add(date, data["topics"])
    memory.save()
    print(f"\n6. Mémoire mise à jour (+{len(data['topics'])} sujets)")

    print(f"\n✓ Terminé. Flux : {cfg.base_url}/feed.xml\n")
    return 0


def cmd_say(args) -> int:
    cfg = load_config(args.config)
    date = args.date or _now(cfg).strftime("%Y-%m-%d")
    print(f"\n▌ Brief Matin — resynthèse du {date}\n")

    script_path = ROOT / "data" / "scripts" / f"{date}.txt"
    if not script_path.exists():
        print(f"✗ Aucun script pour le {date} : "
              f"{script_path.relative_to(ROOT)} introuvable.", file=sys.stderr)
        return 2
    # Avec --out, rien n'est publié : l'URL du flux n'est pas nécessaire.
    if not args.out and not _base_url_ready(cfg):
        return 2
    if args.out:
        # Un essai ne doit jamais consommer le quota gratuit de la production.
        try:
            test_api_key()
        except RuntimeError as exc:
            print(f"✗ {exc}", file=sys.stderr)
            return 2
        cfg.use_test_key = True
    if args.tts_model:
        # En mémoire seulement : config.yaml et la production restent intacts.
        cfg.models["tts"] = args.tts_model
    if args.max_words:
        cfg.audio["max_words_per_chunk"] = args.max_words

    try:
        script = writer_mod.text_to_script(
            cfg, script_path.read_text(encoding="utf-8"))
    except ValueError as exc:
        print(f"✗ {script_path.relative_to(ROOT)} illisible, {exc}",
              file=sys.stderr)
        return 2
    script = writer_mod.validate(cfg, {"script": script})["script"]
    words = writer_mod.word_count(script)
    print(f"1. Script relu : {len(script)} répliques, {words} mots")

    # Le fichier texte ne garde pas les sujets : on les reprend de l'épisode
    # déjà publié, sinon de la mémoire, qui les a enregistrés ce jour-là.
    existing = feed_mod.find_episode(date)
    if existing:
        topics = existing.get("topics", [])
    else:
        topics = [{"slug": e.slug, "title": e.headline}
                  for e in load_memory(cfg).entries if e.date == date]

    print("\n2. Synthèse vocale")
    mp3_name = f"brief-{date}.mp3"
    mp3_path = (Path(args.out).resolve() if args.out
                else feed_mod.EPISODES_DIR / mp3_name)
    print(f"   modèle : {cfg.models['tts']}")
    _print_voices(cfg)
    tts_mod.warn_if_batch_requested(cfg)
    tts_mod.synthesize(cfg, script, mp3_path)
    duration = tts_mod.audio_duration_seconds(mp3_path)
    size = mp3_path.stat().st_size
    print(f"   → {mp3_path.name} · {duration // 60}:{duration % 60:02d} · "
          f"{size / 1024:.0f} Ko · {_cost_label(cfg, duration)}")

    if args.out:
        print(f"\n✓ Terminé. Écrit dans {mp3_path} — rien n'a été publié.\n")
        return 0

    print("\n3. Flux podcast")
    title, summary = _episode_texts(date, topics)
    episodes = feed_mod.register_episode(
        cfg, date=date, filename=mp3_name, title=title, summary=summary,
        duration=duration, size=size, topics=topics)
    feed_path = feed_mod.build_feed(cfg, episodes)
    print(f"   → {len(episodes)} épisodes en ligne, "
          f"{feed_path.relative_to(ROOT)} régénéré")

    print(f"\n✓ Terminé. Flux : {cfg.base_url}/feed.xml\n")
    return 0


def _cost_label(cfg, seconds: float) -> str:
    cost = tts_mod.estimate_cost_usd(cfg, seconds)
    if cost is None:
        return f"coût inconnu (tarif de {cfg.models['tts']} absent de la grille)"
    return f"~{cost:.3f} $ de TTS"


def _print_voices(cfg) -> None:
    voices = " + ".join(f"{s.name}/{s.voice}"
                        for s in tts_mod.active_speakers(cfg))
    print(f"   voix : {voices}")


def _base_url_ready(cfg) -> bool:
    if cfg.base_url.startswith("https://CHANGE-ME"):
        print("✗ config.yaml : remplace podcast.base_url par l'URL de ta "
              "GitHub Page avant de publier.", file=sys.stderr)
        return False
    return True


def _episode_texts(date: str, topics: list[dict]) -> tuple[str, str]:
    day = datetime.strptime(date, "%Y-%m-%d").strftime("%d/%m")
    title = f"{day} — " + (
        topics[0].get("title", "Brief du jour") if topics else "Brief du jour")
    summary = f"Brief du {date}. " + " · ".join(
        t.get("title", "") for t in topics)
    return title, summary


def _positive_int(value: str) -> int:
    try:
        number = int(value)
    except ValueError:
        number = 0
    if number < 1:
        raise argparse.ArgumentTypeError(
            f"« {value} » : un entier strictement positif est attendu")
    return number


def _iso_date(value: str) -> str:
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"date invalide « {value} », format attendu AAAA-MM-JJ") from None


def _write_silence(cfg, path: Path, seconds: int) -> None:
    import subprocess
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-f", "lavfi", "-i", f"anullsrc=r={cfg.audio['sample_rate']}:cl=mono",
         "-t", str(seconds), "-codec:a", "libmp3lame",
         "-b:a", str(cfg.audio["bitrate"]), str(path)],
        check=True,
    )


def cmd_check_feeds(args) -> int:
    cfg = load_config(args.config)
    return 1 if sources_mod.check_feeds(cfg) else 0


def cmd_rebuild_feed(args) -> int:
    cfg = load_config(args.config)
    path = feed_mod.build_feed(cfg)
    print(f"✓ {path.relative_to(ROOT)} régénéré.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="brief-matin", description=__doc__)
    parser.add_argument("--config", default=None, help="chemin d'un autre config.yaml")
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="génère et publie le brief du jour")
    run.add_argument("--dry-run", action="store_true",
                     help="aucun appel API payant, audio silencieux")
    run.add_argument("--no-audio", action="store_true",
                     help="écrit le script mais ne synthétise pas")
    run.add_argument("--force", action="store_true",
                     help="regénère même si un épisode existe déjà pour "
                          "aujourd'hui")
    run.set_defaults(func=cmd_run)

    say = sub.add_parser("say", help="resynthétise un script déjà écrit, "
                                     "sans appeler le modèle de rédaction")
    say.add_argument("date", nargs="?", type=_iso_date, default=None,
                     help="AAAA-MM-JJ (par défaut : aujourd'hui)")
    say.add_argument("--tts-model", default=None,
                     help="remplace models.tts pour cet appel seulement")
    say.add_argument("--out", default=None,
                     help="chemin du mp3 ; dans ce cas rien n'est publié "
                          "(ni docs/episodes, ni flux) et la synthèse utilise "
                          "GEMINI_API_KEY_TEST, jamais la clé de production")
    say.add_argument("--max-words", type=_positive_int, default=None,
                     help="remplace audio.max_words_per_chunk pour cet appel "
                          "seulement")
    say.set_defaults(func=cmd_say)

    check = sub.add_parser("check-feeds", help="teste toutes les sources RSS")
    check.set_defaults(func=cmd_check_feeds)

    rebuild = sub.add_parser("rebuild-feed", help="régénère feed.xml et index.html")
    rebuild.set_defaults(func=cmd_rebuild_feed)

    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except KeyboardInterrupt:
        print("\nInterrompu.", file=sys.stderr)
        return 130
    except Exception as exc:
        code = status_code(exc)
        if code not in RETRYABLE:
            raise
        # Arrivé ici, call_with_retry a déjà épuisé ses tentatives : un
        # traceback n'apprendrait rien, seule la saturation compte.
        print(f"\n✗ API saturée (erreur {code}) malgré les réessais — rien "
              "n'a été publié. Les trois créneaux de nuit (2 h 30, 3 h 30 "
              "et 4 h 30 UTC) visent justement à éviter ces pics : le "
              "suivant retentera, sinon relance plus tard.", file=sys.stderr)
        if code == 429:
            print(f"  Détail : {quota_details(exc)}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
