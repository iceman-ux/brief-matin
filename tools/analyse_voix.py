"""Mesure objective d'un brief audio : séparation des voix, dérive, pauses.

    py tools\\analyse_voix.py tests\\01-kore-puck.mp3 tests\\02-kore-charon.mp3

Ne remplace pas l'écoute — aucune de ces mesures ne dit si le ton colle au
sujet. Sert à répondre à deux questions précises, que l'oreille juge mal :
les deux voix sont-elles vraiment distinctes, et dérivent-elles au fil du brief.

Dépendances : numpy, scipy, et ffmpeg dans le PATH.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import scipy.io.wavfile as wav

SR = 16000
FRAME = int(0.040 * SR)   # fenêtre d'analyse : 40 ms
HOP = int(0.020 * SR)     # pas : 20 ms
FMIN, FMAX = 70, 330      # plage plausible d'une voix parlée, en Hz
SEUIL_VOISE = 0.30        # hauteur minimale du pic d'autocorrélation
MIN_SILENCE = 0.35        # durée qui sépare deux segments de parole, en s


def _decode(path: Path) -> tuple[np.ndarray, float]:
    """mp3 -> signal mono 16 kHz, via ffmpeg."""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "a.wav"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(path),
             "-ar", str(SR), "-ac", "1", str(out)],
            check=True,
        )
        _, y = wav.read(out)
    y = y.astype(np.float64) / 32768.0
    return y, len(y) / SR


def _f0(frame: np.ndarray) -> float | None:
    """Fréquence fondamentale par autocorrélation. None si non voisé."""
    frame = frame - frame.mean()
    if np.sqrt((frame ** 2).mean()) < 0.008:
        return None
    r = np.correlate(frame, frame, mode="full")[len(frame) - 1:]
    if r[0] <= 0:
        return None
    lo, hi = SR // FMAX, min(SR // FMIN, len(r) - 1)
    seg = r[lo:hi]
    if len(seg) == 0:
        return None
    k = int(np.argmax(seg)) + lo
    # Un pic d'autocorrélation trop plat signale du bruit, pas une voix.
    return SR / k if r[k] / r[0] >= SEUIL_VOISE else None


def _segments(times, rms, seuil):
    """Tranches de parole séparées par des silences."""
    segs, debut, dernier = [], None, None
    for t, p in zip(times, rms > seuil):
        if p:
            debut = t if debut is None else debut
            dernier = t
        elif debut is not None and t - dernier > MIN_SILENCE:
            segs.append((debut, dernier))
            debut = None
    if debut is not None:
        segs.append((debut, dernier))
    return segs


def _kmeans2(vals: list[float], iters: int = 60):
    """Deux groupes de hauteur : une voix grave, une voix aiguë.

    C'est un proxy, pas une identification de locuteur. Une répartition très
    déséquilibrée entre les deux groupes signale que la séparation est douteuse
    et que les chiffres qui en découlent sont à prendre avec précaution.
    """
    v = np.asarray(vals, dtype=float)
    c = np.array([np.percentile(v, 20), np.percentile(v, 80)])
    lab = np.zeros(len(v), dtype=int)
    for _ in range(iters):
        lab = np.argmin(np.abs(v[:, None] - c[None, :]), axis=1)
        for j in (0, 1):
            if (lab == j).any():
                c[j] = v[lab == j].mean()
    ordre = np.argsort(c)
    return c[ordre], np.where(lab == ordre[0], 0, 1)


def analyse(path: Path) -> dict:
    y, duree = _decode(path)
    times, f0s, rms = [], [], []
    for i in range(0, len(y) - FRAME, HOP):
        fr = y[i:i + FRAME]
        times.append(i / SR)
        rms.append(float(np.sqrt((fr ** 2).mean())))
        f0s.append(_f0(fr))
    times, rms = np.array(times), np.array(rms)

    segs = _segments(times, rms, np.percentile(rms, 35) * 2.0)
    mesures = []
    for a, b in segs:
        sel = [f for t, f in zip(times, f0s) if f and a <= t <= b]
        if len(sel) > 8:
            mesures.append((a, float(np.median(sel))))
    if len(mesures) < 4:
        return {"fichier": path.name, "erreur": "trop peu de segments voisés"}

    centres, lab = _kmeans2([m for _, m in mesures])
    ecart = 12 * np.log2(centres[1] / centres[0])

    derives = []
    for j in (0, 1):
        pts = [(t, f) for (t, f), l in zip(mesures, lab) if l == j]
        if len(pts) >= 3:
            pente = np.polyfit([p[0] for p in pts], [p[1] for p in pts], 1)[0]
            derives.append(round(12 * np.log2((centres[j] + pente * duree) / centres[j]), 2))
        else:
            derives.append(None)

    pauses = [round(segs[i + 1][0] - segs[i][1], 2) for i in range(len(segs) - 1)]
    return {
        "fichier": path.name,
        "duree_s": round(duree, 1),
        "segments": len(segs),
        "voix_grave_hz": round(centres[0], 1),
        "voix_aigue_hz": round(centres[1], 1),
        "ecart_demitons": round(ecart, 2),
        "derive_demitons": derives,
        "repartition_segments": [int((lab == 0).sum()), int((lab == 1).sum())],
        "pause_mediane_s": round(float(np.median(pauses)), 2) if pauses else None,
        "pauses_les_plus_longues": sorted(pauses, reverse=True)[:5],
    }


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    resultats = []
    for arg in argv:
        p = Path(arg)
        if not p.exists():
            print(f"✗ introuvable : {p}", file=sys.stderr)
            return 2
        resultats.append(analyse(p))
    print(json.dumps(resultats, indent=2, ensure_ascii=False))

    print("\nLecture des chiffres :")
    print("  ecart_demitons        — au-dessus de 4, les deux voix sont nettement")
    print("                          distinctes à l'oreille ; en dessous de 2, on")
    print("                          ne sait plus qui parle.")
    print("  derive_demitons       — de combien chaque voix monte (+) ou descend (-)")
    print("                          du début à la fin. Au-delà de 1, ça s'entend.")
    print("  repartition_segments  — très déséquilibrée = séparation peu fiable,")
    print("                          les autres chiffres du fichier sont douteux.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
