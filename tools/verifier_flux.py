"""Vérifie dans le flux en ligne que l'épisode d'un jour est bien écoutable.

    py tools/verifier_flux.py [AAAA-MM-JJ]

Sans date : le jour de Paris. Lit le feed.xml publié (pas celui de docs/,
qui peut être en avance sur GitHub Pages), cherche l'épisode par son guid
et demande son enclosure en suivant la redirection de la Release : il faut
un 200 au bout. Code de sortie 1 si l'épisode manque ou ne répond pas.

Lancé par le workflow check.yml ; ne dépend que de PyYAML.
"""

from __future__ import annotations

import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date as date_cls
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

ROOT = Path(__file__).resolve().parent.parent


def _fetch(url: str, timeout: float):
    req = urllib.request.Request(url, headers={"User-Agent": "lora-controle"})
    return urllib.request.urlopen(req, timeout=timeout)


def main(argv: list[str]) -> int:
    # La console Windows en cp1252 n'a ni ✓ ni ✗.
    sys.stdout.reconfigure(encoding="utf-8")
    cfg = yaml.safe_load((ROOT / "config.yaml").read_text(encoding="utf-8"))
    timeout = cfg["controle"]["timeout_seconds"]
    if len(argv) > 1 and argv[1]:
        day = date_cls.fromisoformat(argv[1]).isoformat()
    else:
        day = datetime.now(ZoneInfo(cfg["brief"]["timezone"])).date().isoformat()

    # Paramètre jetable : le cache de GitHub Pages servirait sinon un flux
    # vieux de dix minutes, d'avant la publication.
    feed_url = f"{cfg['podcast']['base_url'].rstrip('/')}/feed.xml?t={int(time.time())}"
    with _fetch(feed_url, timeout) as resp:
        root = ET.fromstring(resp.read())

    # Préfixe figé du guid : voir feed.py.
    guid = f"brief-matin-{day}"
    item = next((it for it in root.iter("item")
                 if (it.findtext("guid") or "").strip() == guid), None)
    if item is None:
        print(f"✗ Pas d'épisode du {day} dans le flux en ligne.")
        return 1
    enclosure = item.find("enclosure")
    url = enclosure.get("url") if enclosure is not None else None
    if not url:
        print(f"✗ L'épisode du {day} n'a pas d'enclosure.")
        return 1

    # Le corps n'est pas lu : les en-têtes suffisent pour avoir le statut.
    try:
        with _fetch(url, timeout) as resp:
            status = resp.status
    except urllib.error.HTTPError as e:
        status = e.code
    if status != 200:
        print(f"✗ L'enclosure du {day} répond {status} : {url}")
        return 1
    print(f"✓ Épisode du {day} en ligne, enclosure 200 : {url}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
