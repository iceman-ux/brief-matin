"""Synthèse vocale (Gemini ; ElevenLabs essayé, hors production), finition
audio et encodage mp3.

Le modèle renvoie du PCM brut 24 kHz 16 bits mono (les modèles 3.8 un WAV,
dont on retire l'en-tête pour revenir au PCM). Deux conséquences utiles :
- on peut concaténer plusieurs morceaux en collant simplement les octets ;
- tout le traitement ffmpeg (finition, montage des signatures, mp3) se fait
  à la fin, sur l'audio entier, avec un seul encodage mp3.
"""

from __future__ import annotations

import array
import io
import math
import os
import subprocess
import tempfile
import wave
from datetime import date
from pathlib import Path

from .config import Config, api_key, test_api_key

# Le modèle multi-locuteurs n'accepte que deux voix.
MAX_SPEAKERS = 2
# Au-delà, on découpe : les modèles TTS ont une limite de contexte en sortie.
DEFAULT_MAX_WORDS_PER_CHUNK = 900


def _client(cfg: Config):
    from google import genai
    key = test_api_key() if cfg.use_test_key else api_key()
    return genai.Client(api_key=key)


def _chunk_script(script: list[dict], max_words: int) -> list[list[dict]]:
    """Découpe en préservant les répliques entières."""
    chunks: list[list[dict]] = []
    current: list[dict] = []
    count = 0
    for line in script:
        words = len(line["text"].split())
        if current and count + words > max_words:
            chunks.append(current)
            current, count = [], 0
        current.append(line)
        count += words
    if current:
        chunks.append(current)
    return chunks


def _render_chunk_text(cfg: Config, chunk: list[dict], multi: bool) -> str:
    header = cfg.direction
    if multi:
        # Un morceau découpé peut ne contenir qu'une seule voix : annoncer
        # une conversation à deux serait faux et brouille la consigne.
        presents = list(dict.fromkeys(l["speaker"] for l in chunk))
        if len(presents) >= 2:
            header += (f"\n\nLis la conversation suivante entre "
                       f"{presents[0]} et {presents[1]} :")
        else:
            header += f"\n\nLis le passage suivant, dit par {presents[0]} :"
        body = "\n".join(f"{l['speaker']}: {l['text']}" for l in chunk)
    else:
        header += "\n\nLis le texte suivant :"
        body = "\n\n".join(l["text"] for l in chunk)
    return f"{header}\n\n{body}"


def _is_multi(cfg: Config) -> bool:
    return cfg.two_voices and len(cfg.speakers) >= MAX_SPEAKERS


def active_speakers(cfg: Config) -> list:
    """Voix réellement envoyées au TTS, dans l'ordre de la config."""
    return cfg.speakers[:MAX_SPEAKERS] if _is_multi(cfg) else cfg.speakers[:1]


def _speech_config(cfg: Config, multi: bool):
    from google.genai import types

    if multi:
        return types.SpeechConfig(
            multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                speaker_voice_configs=[
                    types.SpeakerVoiceConfig(
                        speaker=s.name,
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=s.voice
                            )
                        ),
                    )
                    for s in active_speakers(cfg)
                ]
            )
        )
    return types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                voice_name=active_speakers(cfg)[0].voice
            )
        )
    )


def _synth_pcm(cfg: Config, text: str, multi: bool) -> bytes:
    from google.genai import types

    from .retry import call_with_retry

    client = _client(cfg)
    response = call_with_retry(
        lambda: client.models.generate_content(
            model=cfg.models["tts"],
            contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=_speech_config(cfg, multi),
            ),
        ),
        label="synthèse vocale",
    )
    try:
        part = response.candidates[0].content.parts[0]
        data = part.inline_data.data
    except (AttributeError, IndexError, TypeError) as exc:
        raise RuntimeError(
            f"Réponse TTS inattendue — le modèle a peut-être refusé le texte.\n{response}"
        ) from exc
    if not data:
        raise RuntimeError("Le modèle TTS a renvoyé un audio vide.")
    return data


def uses_interactions(cfg: Config) -> bool:
    # Les modèles 3.8 refusent generate_content en multi-locuteurs : ils
    # exigent un locuteur attaché à chaque réplique, via l'API interactions.
    return cfg.models["tts"].startswith("gemini-3.8-")


def _synth_pcm_interactions(cfg: Config, chunk: list[dict]) -> bytes:
    """Chemin des modèles 3.8 : une entrée annotée par réplique.

    Ces modèles lisent le texte mot pour mot : ni cfg.direction ni consigne
    de lecture, sinon elles seraient prononcées. Seules les répliques partent,
    avec leur intention de jeu éventuelle (clé « style ») en métadonnée.
    """
    import base64

    from .retry import call_with_retry

    if not _is_multi(cfg):
        raise RuntimeError("Chemin gemini-3.8 : seul le dialogue à deux voix "
                           "est pris en charge.")
    client = _client(cfg)
    interaction = call_with_retry(
        lambda: client.interactions.create(
            model=cfg.models["tts"],
            input=[{"type": "user_input", "content": [
                {"type": "text", "text": line["text"],
                 "annotations": [_speech_metadata(line)]}
                for line in chunk
            ]}],
            response_format={"type": "audio"},
            generation_config={"speech_config": {
                "mode": "conversational",
                "speakers": [{"speaker": s.name, "voice": s.voice}
                             for s in active_speakers(cfg)],
            }},
        ),
        label="synthèse vocale",
    )
    try:
        data = interaction.output_audio.data
    except AttributeError as exc:
        raise RuntimeError(
            f"Réponse TTS inattendue — le modèle a peut-être refusé le texte.\n{interaction}"
        ) from exc
    audio = base64.b64decode(data) if isinstance(data, str) else bytes(data)
    if not audio.startswith(b"RIFF"):
        audio = base64.b64decode(audio)
    return _wav_to_pcm(audio, int(cfg.audio["sample_rate"]))


def _speech_metadata(line: dict) -> dict:
    meta = {"type": "speech_metadata", "speaker": line["speaker"]}
    if line.get("style"):
        meta["style"] = line["style"]
    return meta


def _dialogue_text(line: dict) -> str:
    # Eleven v3 lit les balises entre crochets comme des indications de jeu,
    # pas comme du texte : c'est son équivalent de speech_metadata.style.
    tag = line.get("audio_tag")
    return f"{tag} {line['text']}" if tag else line["text"]


def _chunk_by_chars(script: list[dict], max_chars: int) -> list[list[dict]]:
    """Découpe en préservant les répliques entières. Une réplique plus
    longue que max_chars part seule : la couper casserait son intonation."""
    chunks: list[list[dict]] = []
    current: list[dict] = []
    count = 0
    for line in script:
        size = len(_dialogue_text(line))
        if current and count + size > max_chars:
            chunks.append(current)
            current, count = [], 0
        current.append(line)
        count += size
    if current:
        chunks.append(current)
    return chunks


def _synth_pcm_elevenlabs(cfg: Config, chunk: list[dict]) -> bytes:
    """Text to Dialogue d'ElevenLabs : une entrée par réplique, voix par
    locuteur. Bibliothèque standard seulement, pas de SDK à ajouter."""
    import json
    import urllib.error
    import urllib.parse
    import urllib.request

    from .config import elevenlabs_api_key
    from .retry import call_with_retry

    el = cfg.elevenlabs
    expected = f"pcm_{int(cfg.audio['sample_rate'])}"
    if el["output_format"] != expected:
        raise RuntimeError(
            f"elevenlabs.output_format vaut {el['output_format']}, attendu "
            f"{expected} : les octets sont recollés tels quels, sans décodage.")
    voices = {s.name: s.voice for s in active_speakers(cfg)}
    missing = sorted({l["speaker"] for l in chunk} - {n for n, v in voices.items() if v})
    if missing:
        raise RuntimeError("config.yaml : elevenlabs.speakers n'a pas de voix "
                           f"pour {', '.join(missing)}.")
    key = elevenlabs_api_key()
    body = json.dumps({
        "inputs": [{"text": _dialogue_text(l), "voice_id": voices[l["speaker"]]}
                   for l in chunk],
        "model_id": el["model_id"],
        "language_code": el["language_code"],
        "seed": int(el["seed"]),
    }).encode("utf-8")
    url = f"{el['api_url']}?{urllib.parse.urlencode({'output_format': el['output_format']})}"

    def post() -> bytes:
        request = urllib.request.Request(url, data=body, method="POST", headers={
            "xi-api-key": key, "Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=float(el["timeout_s"])) as resp:
            return resp.read()

    try:
        pcm = call_with_retry(post, label="synthèse vocale ElevenLabs")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace").replace(key, "***")
        raise RuntimeError(f"ElevenLabs a refusé la requête ({exc.code}) : "
                           f"{detail[:500]}") from exc
    if not pcm:
        raise RuntimeError("ElevenLabs a renvoyé un audio vide.")
    return pcm


def _wav_to_pcm(wav_bytes: bytes, sample_rate: int) -> bytes:
    """Retire l'en-tête RIFF : collé tel quel entre deux morceaux, il
    s'entendrait comme un clic à chaque raccord."""
    with wave.open(io.BytesIO(wav_bytes), "rb") as wav:
        params = (wav.getnchannels(), wav.getsampwidth(), wav.getframerate())
        if params != (1, 2, sample_rate):
            raise RuntimeError(
                f"WAV inattendu (canaux, octets, Hz) = {params}, attendu "
                f"(1, 2, {sample_rate}) : la concaténation serait fausse.")
        return wav.readframes(wav.getnframes())


def _pcm_to_wav(pcm: bytes, sample_rate: int) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)  # 16 bits
        wav.setframerate(sample_rate)
        wav.writeframes(pcm)
    return buffer.getvalue()


def _encode(wav_bytes: bytes, out_path: Path, cfg: Config,
            codec: list[str]) -> None:
    audio = cfg.audio
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", "pipe:0", *codec,
        "-ac", "1", "-ar", str(audio["sample_rate"]),
        str(out_path),
    ]
    proc = subprocess.run(cmd, input=wav_bytes, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg a échoué :\n{proc.stderr.decode(errors='replace')}")


def _decode_pcm(path: Path, sample_rate: int) -> bytes:
    """N'importe quel fichier audio -> PCM 16 bits mono au format du TTS."""
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path),
         "-f", "s16le", "-ac", "1", "-ar", str(sample_rate), "pipe:1"],
        capture_output=True)
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError(proc.stderr.decode(errors="replace").strip()
                           or "audio vide")
    return proc.stdout


def _trim(cfg: Config, pcm: bytes,
          keep_tail: bool = False) -> tuple[bytes, int, int]:
    """Coupe le silence de tête et de queue, en gardant une marge autour de
    la voix. Renvoie aussi la marge réellement gardée de chaque côté, en
    échantillons, pour que les écarts du montage se comptent de voix à voix.

    La marge est passée en fondu : sans lui, la coupe tombe dans la chute
    d'un mot, encore audible sous le seuil, et claque. keep_tail laisse la
    queue intacte, pour la clôture qui finit l'épisode sur sa chute
    naturelle. Seuls les bords sont parcourus : le cœur n'est jamais lu.
    """
    audio = cfg.audio
    rate = int(audio["sample_rate"])
    samples = array.array("h")
    samples.frombytes(pcm)
    window = rate // 100
    count = len(samples) // window
    limit = 32768 * 10 ** (float(audio["trim_threshold_db"]) / 20)

    def voiced(index: int) -> bool:
        chunk = samples[index * window:(index + 1) * window]
        return math.sqrt(sum(v * v for v in chunk) / len(chunk)) > limit

    first = next((i for i in range(count) if voiced(i)), None)
    if first is None:
        return pcm, 0, 0
    last = next(i for i in range(count - 1, -1, -1) if voiced(i))
    margin = int(rate * float(audio["trim_margin_ms"]) / 1000)
    voice_start, voice_end = first * window, (last + 1) * window
    start = max(voice_start - margin, 0)
    end = len(samples) if keep_tail else min(voice_end + margin, len(samples))
    head, tail = voice_start - start, end - voice_end
    kept = samples[start:end]
    for i in range(head):
        kept[i] = int(kept[i] * i / head)
    if not keep_tail:
        for i in range(tail):
            kept[-1 - i] = int(kept[-1 - i] * i / tail)
    return kept.tobytes(), head, tail


def _silence(samples: int) -> bytes:
    return b"\x00\x00" * max(samples, 0)


def _brand_pcm(cfg: Config, path: Path | None, label: str) -> bytes | None:
    if path is None:
        return None
    try:
        return _decode_pcm(path, int(cfg.audio["sample_rate"]))
    except RuntimeError as exc:
        print(f"   ⚠⚠ {label} illisible ({path.name}) : l'épisode sort SANS "
              f"cette signature. {exc}")
        return None


def frame(cfg: Config, body: bytes, day: date) -> bytes:
    """[sonal] → tête → ouverture → écart → corps → écart → clôture du jour.

    Tout reste en PCM : les fichiers de marque, déjà à niveau, ne repassent
    pas par la finition, et l'épisode n'est encodé qu'une fois. Un fichier
    manquant ou illisible est sauté, jamais bloquant.
    """
    from . import brand as brand_mod

    rate = int(cfg.audio["sample_rate"])
    gaps = cfg.brand["gaps_ms"]

    def ms(value: float) -> int:
        return int(rate * float(value) / 1000)

    sonal = _brand_pcm(cfg, brand_mod.sonal_file(cfg), "sonal")
    opening = _brand_pcm(cfg, brand_mod.opening_file(cfg), "ouverture")
    closing = _brand_pcm(cfg, brand_mod.closing_file(cfg, day), "clôture")

    # Le sonal n'est pas rogné : sa fin musicale (réverbération, fondu) passe
    # sous le seuil de coupe de la voix et serait tronquée.
    parts: list[bytes] = [sonal] if sonal else []
    body, body_head, body_tail = _trim(cfg, body)
    if opening:
        opening, head, tail = _trim(cfg, opening)
        parts += [_silence(ms(gaps["head"]) - head), opening,
                  _silence(ms(gaps["after_opening"]) - tail - body_head)]
    else:
        parts.append(_silence(ms(gaps["head"]) - body_head))
    parts.append(body)
    if closing:
        closing, head, _ = _trim(cfg, closing, keep_tail=True)
        parts += [_silence(ms(gaps["before_closing"]) - body_tail - head),
                  closing]
    return b"".join(parts)


def synthesize(cfg: Config, script: list[dict], out_path: Path,
               verbose: bool = True, day: date | None = None) -> Path:
    """Script -> mp3. Retourne le chemin du fichier écrit.

    Avec day, l'épisode est encadré des signatures enregistrées de ce jour.
    """
    from .brand import strip_brand_name

    # Dernier rempart, y compris pour « say » qui relit un script ancien.
    script, removed = strip_brand_name(script)
    for warning in removed:
        print(f"   ⚠ {warning}")
    if not script:
        raise ValueError("Script vide une fois retirées les phrases avec "
                         "« Lora ».")
    multi = _is_multi(cfg)
    elevenlabs = cfg.tts_provider == "elevenlabs"
    if elevenlabs:
        chunks = _chunk_by_chars(script, int(cfg.elevenlabs["max_chars_per_request"]))
    else:
        max_words = int(cfg.audio.get("max_words_per_chunk", DEFAULT_MAX_WORDS_PER_CHUNK))
        chunks = _chunk_script(script, max_words)

    interactions = uses_interactions(cfg)
    pcm = bytearray()
    for idx, chunk in enumerate(chunks, 1):
        if verbose:
            words = sum(len(l["text"].split()) for l in chunk)
            print(f"  synthèse {idx}/{len(chunks)} ({words} mots)…")
        if elevenlabs:
            pcm += _synth_pcm_elevenlabs(cfg, chunk)
        elif interactions:
            pcm += _synth_pcm_interactions(cfg, chunk)
        else:
            pcm += _synth_pcm(cfg, _render_chunk_text(cfg, chunk, multi), multi)

    return finalize(cfg, bytes(pcm), out_path, verbose, day)


def _mp3_codec(cfg: Config) -> list[str]:
    return ["-codec:a", "libmp3lame", "-b:a", str(cfg.audio["bitrate"])]


def finishing_enabled(cfg: Config) -> bool:
    return bool(cfg.raw["finishing"].get("enabled", True))


def finalize(cfg: Config, pcm: bytes, out_path: Path,
             verbose: bool = True, day: date | None = None) -> Path:
    """PCM brut -> mp3 du flux : finition du corps, montage des signatures
    du jour si day est donné, puis un seul encodage mp3.

    Tout passe par des fichiers temporaires, remplacés d'un coup à la fin :
    un échec en route ne laisse ni mp3 tronqué ni audio non fini à la place
    de l'épisode, et un épisode déjà publié reste intact.
    """
    rate = int(cfg.audio["sample_rate"])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=out_path.parent) as tmp:
        final = Path(tmp) / out_path.name
        if finishing_enabled(cfg):
            # Intermédiaires sans perte : l'épisode n'est encodé en mp3
            # qu'une fois, après le montage.
            raw = Path(tmp) / f"{out_path.stem}-brut.wav"
            raw.write_bytes(_pcm_to_wav(pcm, rate))
            finished = Path(tmp) / f"{out_path.stem}-fini.wav"
            loudness = finish(cfg, raw, finished, ["-codec:a", "pcm_s16le"])
            if verbose:
                print(f"  finition : {loudness:.1f} LUFS")
            pcm = _wav_to_pcm(finished.read_bytes(), rate)
        if day is not None:
            pcm = frame(cfg, pcm, day)
        _encode(_pcm_to_wav(pcm, rate), final, cfg, _mp3_codec(cfg))
        os.replace(final, out_path)
    return out_path


def _loudnorm_report(stderr: str) -> dict:
    # loudnorm écrit son rapport JSON en dernier sur stderr, après le reste.
    import json
    start = stderr.rfind("{")
    if start < 0:
        raise RuntimeError(f"ffmpeg n'a pas rendu de mesure loudnorm :\n{stderr}")
    return json.loads(stderr[start:stderr.rfind("}") + 1])


def finish(cfg: Config, src: Path, out_path: Path,
           codec: list[str] | None = None) -> float:
    """Compression légère puis normalisation, encodée avec codec (mp3 du
    flux par défaut). Retourne la loudness intégrée du résultat, en LUFS.

    Deux passes : la première mesure, la seconde applique un gain linéaire.
    En une seule passe, loudnorm corrige à la volée et fait pomper le son.
    """
    fin = cfg.raw["finishing"]
    comp, loud = fin["compressor"], fin["loudness"]
    compressor = (f"acompressor=threshold={comp['threshold_db']}dB"
                  f":ratio={comp['ratio']}:attack={comp['attack_ms']}"
                  f":release={comp['release_ms']}")
    target = (f"loudnorm=I={loud['integrated_lufs']}"
              f":TP={loud['true_peak_db']}:LRA={loud['range_lu']}")

    def run(filters: str, output: list[str]) -> str:
        cmd = ["ffmpeg", "-hide_banner", "-nostats", "-y", "-i", str(src),
               "-af", filters, *output]
        proc = subprocess.run(cmd, capture_output=True)
        stderr = proc.stderr.decode(errors="replace")
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg a échoué sur {src.name} :\n{stderr}")
        return stderr

    measured = _loudnorm_report(
        run(f"{compressor},{target}:print_format=json", ["-f", "null", "-"]))
    # Un audio muet n'a pas de loudness mesurable (-inf) et ffmpeg refuse
    # la seconde passe : le dire plutôt que laisser son message cryptique.
    if float(measured["input_i"]) == float("-inf"):
        raise RuntimeError(f"{src.name} est silencieux : rien à normaliser. "
                           "Le TTS a peut-être rendu un audio vide.")
    second = (f"{compressor},{target}:linear=true:print_format=json"
              f":measured_I={measured['input_i']}"
              f":measured_TP={measured['input_tp']}"
              f":measured_LRA={measured['input_lra']}"
              f":measured_thresh={measured['input_thresh']}"
              f":offset={measured['target_offset']}")
    # loudnorm suréchantillonne en interne : on revient au format du flux,
    # le même pour tous les fichiers traités.
    report = _loudnorm_report(run(second, [
        *(codec or _mp3_codec(cfg)),
        "-ac", "1", "-ar", str(cfg.audio["sample_rate"]), str(out_path)]))
    return float(report["output_i"])


def audio_duration_seconds(path: Path) -> int:
    """Durée réelle du mp3, lue par ffprobe (nécessaire pour le flux RSS)."""
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True,
    )
    try:
        return int(float(proc.stdout.strip()))
    except ValueError:
        return 0


# Tarif standard en $ par million de tokens audio, valable jusqu'au
# 31/12/2026 : à revérifier sur la grille officielle passé cette date.
USD_PAR_MILLION_TOKENS = {
    "gemini-3.1-flash-tts-preview": 20.0,
    "gemini-3.8-flash-tts": 9.0,
    "gemini-3.8-flash-lite-tts": 6.0,
}
TOKENS_AUDIO_PAR_SECONDE = 25


def estimate_cost_usd(cfg: Config, seconds: float) -> float | None:
    """Coût TTS indicatif, facturé à la durée d'audio produite.

    Toujours au tarif standard : le mode batch, deux fois moins cher, n'est
    pas implémenté (_synth_pcm appelle generate_content en synchrone). Tant
    qu'il ne l'est pas, afficher un tarif réduit mentirait sur la facture.
    None pour un modèle absent de la grille, ou hors Gemini : mieux vaut
    « inconnu » qu'un chiffre emprunté à un autre modèle.
    """
    if cfg.tts_provider != "gemini":
        return None
    rate = USD_PAR_MILLION_TOKENS.get(cfg.models["tts"])
    if rate is None:
        return None
    return (seconds * TOKENS_AUDIO_PAR_SECONDE / 1_000_000) * rate


def warn_if_batch_requested(cfg: Config) -> None:
    """Le flag existe dans config.yaml mais ne fait rien : mieux vaut le dire."""
    if cfg.models.get("tts_batch"):
        print("   ⚠ tts_batch est à true mais le mode batch n'est pas "
              "implémenté : la synthèse reste synchrone, au tarif plein.")
