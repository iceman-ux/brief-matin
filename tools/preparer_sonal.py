"""Prépare le sonal au format des fichiers de marque, hors pipeline.

    py tools/preparer_sonal.py assets/brand/sources/sonal-adam.wav assets/brand/sonal.wav

Mono (moyenne des deux canaux), 24 kHz, queue coupée avec 20 ms de marge en
fondu, puis un gain fixe vers −17 LUFS, comme les signatures. Pas de
limiteur : si −17 LUFS ferait passer le true peak au-dessus de −3 dBFS, le
gain s'arrête à −3 dBTP et le sonal reste un peu sous −17 LUFS.
Affiche aussi l'instant où le sonal est retombé de 15 dB sous son maximum,
point de départ de la voix pour un montage en chevauchement.

numpy et scipy, hors requirements.txt : le run n'en a pas besoin.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import scipy.io.wavfile as wav

RATE = 24000
TARGET_LUFS = -17.0
MAX_TRUE_PEAK = -3.0
MARGIN_MS = 20
# Fin du sonal : dernière fenêtre de 10 ms à moins de 30 dB sous la plus
# forte. La source n'a pas de vrai silence final : sa réverbération descend
# en continu jusqu'à −33 dB sous le maximum, et ses derniers dixièmes de
# seconde ne sont plus qu'un souffle.
TAIL_BELOW_MAX_DB = 30
# Chute sous le maximum de l'enveloppe à laquelle la voix peut entrer.
OVERLAP_DROP_DB = 15
# Enveloppe lissée sur 100 ms, par pas de 10 ms : assez longue pour ignorer
# une note isolée, assez courte pour suivre la décroissance.
ENVELOPE_MS = 100


def _decode(path: Path) -> np.ndarray:
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path),
         "-af", f"pan=mono|c0=0.5*c0+0.5*c1,aresample={RATE}:resampler=soxr",
         "-f", "f32le", "pipe:1"], capture_output=True, check=True)
    return np.frombuffer(proc.stdout, dtype=np.float32).copy()


def _ebur128(path: Path) -> tuple[float, float]:
    """(loudness intégrée en LUFS, true peak en dBFS), mesurés par ffmpeg."""
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
         "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace")
    summary = proc.stderr[proc.stderr.rfind("Summary:"):]
    loudness = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
    peak = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary).group(1))
    return loudness, peak


def envelope_db(samples: np.ndarray, step_ms: int = 10) -> tuple[np.ndarray, np.ndarray]:
    step = RATE * step_ms // 1000
    width = RATE * ENVELOPE_MS // 1000
    starts = np.arange(0, max(len(samples) - width, 1), step)
    rms = np.array([np.sqrt(np.mean(samples[s:s + width] ** 2) + 1e-12)
                    for s in starts])
    return (starts + width / 2) / RATE, 20 * np.log10(rms)


def _write(path: Path, samples: np.ndarray) -> None:
    pcm = np.clip(np.round(samples * 32767), -32768, 32767).astype(np.int16)
    wav.write(path, RATE, pcm)


def main(argv: list[str]) -> int:
    src, out = Path(argv[0]), Path(argv[1])
    samples = _decode(src)

    window = RATE // 100
    frames = samples[:len(samples) // window * window].reshape(-1, window)
    rms_db = 20 * np.log10(np.sqrt(np.mean(frames ** 2, axis=1)) + 1e-12)
    last = int(np.nonzero(rms_db > rms_db.max() - TAIL_BELOW_MAX_DB)[0][-1])
    margin = RATE * MARGIN_MS // 1000
    end = min((last + 1) * window + margin, len(samples))
    samples = samples[:end]
    fade = end - (last + 1) * window
    if fade > 0:
        samples[-fade:] *= np.linspace(1, 0, fade, endpoint=False)

    out.parent.mkdir(parents=True, exist_ok=True)
    _write(out, samples)
    loudness, peak = _ebur128(out)
    wanted = TARGET_LUFS - loudness
    gain_db = min(wanted, MAX_TRUE_PEAK - peak)
    samples *= 10 ** (gain_db / 20)
    _write(out, samples)
    loudness, peak = _ebur128(out)

    times, env = envelope_db(samples)
    top = int(env.argmax())
    after = np.nonzero(env[top:] <= env[top] - OVERLAP_DROP_DB)[0]
    drop = float(times[top + after[0]]) if len(after) else None

    print(f"durée {len(samples) / RATE:.3f} s (queue coupée à "
          f"{(last + 1) * window / RATE:.3f} s + {MARGIN_MS} ms)")
    print(f"gain +{gain_db:.2f} dB → {loudness:.1f} LUFS, true peak {peak:.1f} dBFS")
    if gain_db < wanted:
        print(f"⚠ gain plafonné par le true peak : −17 LUFS demanderait "
              f"+{wanted:.2f} dB, soit un limiteur.")
    print(f"maximum de l'enveloppe à {times[top]:.2f} s ; −{OVERLAP_DROP_DB} dB "
          f"atteint à {drop:.2f} s" if drop else "pas de chute de 15 dB")
    if peak > MAX_TRUE_PEAK:
        print(f"✗ true peak au-dessus de {MAX_TRUE_PEAK} dBFS : il faudrait un "
              "limiteur.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
