"""Génération du flux RSS podcast (compatible Apple Podcasts / Pocket Casts /
Overcast) et rétention des épisodes."""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape

from .config import ROOT, Config

DOCS = ROOT / "docs"
EPISODES_DIR = DOCS / "episodes"
INDEX = DOCS / "episodes.json"


def _load_index() -> list[dict]:
    if not INDEX.exists():
        return []
    try:
        return json.loads(INDEX.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def _save_index(episodes: list[dict]) -> None:
    INDEX.parent.mkdir(parents=True, exist_ok=True)
    INDEX.write_text(json.dumps(episodes, ensure_ascii=False, indent=2),
                     encoding="utf-8")


def find_episode(date: str) -> dict | None:
    return next((e for e in _load_index() if e["date"] == date), None)


def register_episode(cfg: Config, *, date: str, filename: str, title: str,
                     summary: str, duration: int, size: int,
                     topics: list[dict]) -> list[dict]:
    """Ajoute (ou remplace) l'épisode du jour, applique la rétention."""
    episodes = [e for e in _load_index() if e["date"] != date]
    episodes.append({
        "date": date,
        "filename": filename,
        "title": title,
        "summary": summary,
        "duration": duration,
        "size": size,
        "topics": topics,
        "pub_date": datetime.now(timezone.utc).isoformat(),
    })
    episodes.sort(key=lambda e: e["date"], reverse=True)

    keep = int(cfg.podcast["retention_days"])
    dropped = episodes[keep:]
    episodes = episodes[:keep]
    for old in dropped:
        mp3 = EPISODES_DIR / old["filename"]
        if mp3.exists():
            mp3.unlink()

    _save_index(episodes)
    return episodes


def _fmt_duration(seconds: int) -> str:
    h, rem = divmod(max(seconds, 0), 3600)
    m, s = divmod(rem, 60)
    return f"{h:d}:{m:02d}:{s:02d}" if h else f"{m:d}:{s:02d}"


def _pub_datetime(episode: dict) -> datetime:
    try:
        return datetime.fromisoformat(episode["pub_date"])
    except (KeyError, ValueError):
        return datetime.strptime(episode["date"], "%Y-%m-%d").replace(
            tzinfo=timezone.utc)


def build_feed(cfg: Config, episodes: list[dict] | None = None) -> Path:
    episodes = episodes if episodes is not None else _load_index()
    pod = cfg.podcast
    base = cfg.base_url
    disclosure = (pod.get("ai_disclosure") or "").strip()
    channel_desc = pod["description"].strip()
    if disclosure:
        channel_desc = f"{channel_desc}\n\n{disclosure}"

    items = []
    for ep in episodes:
        url = f"{base}/episodes/{ep['filename']}"
        notes = ep["summary"]
        if ep.get("topics"):
            lines = "\n".join(f"• {t.get('title', '')}" for t in ep["topics"])
            notes = f"{notes}\n\nAu sommaire :\n{lines}"
        if disclosure:
            notes = f"{notes}\n\n{disclosure}"
        # Le préfixe du guid reste « brief-matin » malgré le nom Lora : le
        # changer ferait réapparaître tous les épisodes comme nouveaux.
        items.append(f"""    <item>
      <title>{escape(ep['title'])}</title>
      <description>{escape(notes)}</description>
      <itunes:summary>{escape(notes)}</itunes:summary>
      <pubDate>{format_datetime(_pub_datetime(ep))}</pubDate>
      <guid isPermaLink="false">brief-matin-{ep['date']}</guid>
      <enclosure url="{escape(url)}" length="{ep['size']}" type="audio/mpeg"/>
      <itunes:duration>{_fmt_duration(ep['duration'])}</itunes:duration>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:explicit>false</itunes:explicit>
    </item>""")

    last_build = format_datetime(datetime.now(timezone.utc))
    image = ""
    if pod.get("cover_image"):
        cover = f"{base}/{pod['cover_image']}"
        image = (f'    <itunes:image href="{escape(cover)}"/>\n'
                 f"    <image><url>{escape(cover)}</url>"
                 f"<title>{escape(pod['title'])}</title>"
                 f"<link>{escape(base)}</link></image>")

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>{escape(pod['title'])}</title>
    <link>{escape(base)}</link>
    <atom:link href="{escape(base)}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>{escape(channel_desc)}</description>
    <language>{escape(pod['language'])}</language>
    <lastBuildDate>{last_build}</lastBuildDate>
    <itunes:author>{escape(pod['author'])}</itunes:author>
    <itunes:subtitle>{escape(pod['subtitle'])}</itunes:subtitle>
    <itunes:summary>{escape(channel_desc)}</itunes:summary>
    <itunes:owner>
      <itunes:name>{escape(pod['author'])}</itunes:name>
      <itunes:email>{escape(pod['email'])}</itunes:email>
    </itunes:owner>
    <itunes:category text="{escape(pod['category'])}"/>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
{image}
{chr(10).join(items)}
  </channel>
</rss>
"""
    DOCS.mkdir(parents=True, exist_ok=True)
    out = DOCS / "feed.xml"
    out.write_text(xml, encoding="utf-8")
    _write_landing(cfg, episodes)
    return out


def _write_landing(cfg: Config, episodes: list[dict]) -> None:
    """Petite page d'accueil : pratique pour copier l'URL du flux sur iPhone."""
    base = cfg.base_url
    rows = "\n".join(
        f'      <li><span class="d">{e["date"]}</span> '
        f'<a href="episodes/{e["filename"]}">{escape(e["title"])}</a> '
        f'<span class="m">{_fmt_duration(e["duration"])}</span></li>'
        for e in episodes[:15]
    ) or "      <li>Aucun épisode pour l'instant.</li>"

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(cfg.podcast['title'])}</title>
<style>
  :root {{ color-scheme: light dark; --bg:#fbfbfa; --fg:#1a1a18; --mut:#6b6b66; --line:#e4e4e0; --acc:#b4541f; }}
  @media (prefers-color-scheme: dark) {{
    :root {{ --bg:#16161a; --fg:#ececeb; --mut:#93938d; --line:#2c2c31; --acc:#e08a52; }}
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--fg); padding:48px 16px;
         font:16px/1.6 ui-sans-serif,-apple-system,"Segoe UI",system-ui,sans-serif; }}
  main {{ max-width: 620px; margin: 0 auto; }}
  h1 {{ font-size: 1.7rem; margin: 0 0 4px; letter-spacing: -.02em; }}
  p.sub {{ color: var(--mut); margin: 0 0 32px; }}
  .feed {{ border:1px solid var(--line); border-radius:10px; padding:16px; margin-bottom:36px; }}
  .feed b {{ display:block; font-size:.78rem; text-transform:uppercase;
             letter-spacing:.07em; color:var(--mut); margin-bottom:8px; }}
  code {{ display:block; word-break:break-all; font-size:.86rem;
          background:transparent; color:var(--acc); }}
  ul {{ list-style:none; padding:0; margin:0; }}
  li {{ padding:10px 0; border-bottom:1px solid var(--line); display:flex;
        gap:12px; align-items:baseline; flex-wrap:wrap; }}
  .d {{ color:var(--mut); font-variant-numeric:tabular-nums; font-size:.85rem; min-width:88px; }}
  .m {{ color:var(--mut); font-size:.85rem; margin-left:auto; }}
  a {{ color:inherit; text-decoration:none; border-bottom:1px solid var(--line); }}
  a:hover {{ border-color:var(--acc); }}
</style>
</head>
<body>
  <main>
    <h1>{escape(cfg.podcast['title'])}</h1>
    <p class="sub">{escape(cfg.podcast['subtitle'])}</p>
    <div class="feed">
      <b>Flux à coller dans Pocket Casts ou Overcast</b>
      <code>{escape(base)}/feed.xml</code>
    </div>
    <ul>
{rows}
    </ul>
    <p class="sub" style="margin-top:28px;font-size:.85rem">
      <a href="installer.html">Installer le brief sur un téléphone</a>
    </p>
  </main>
</body>
</html>
"""
    (DOCS / "index.html").write_text(html, encoding="utf-8")
    _write_installer(cfg)


# Liens d'abonnement, au format documenté par chaque appli. Apple Podcasts
# n'en documente aucun (seulement « Ajouter une émission par URL » à la main,
# podcasters.apple.com/support/3993) : pas de bouton, pas de format deviné.
# Pocket Casts — support.pocketcasts.com/knowledge-base/third-party-integration :
# l'URL du flux suit « subscribe/ », sans le préfixe http(s)://.
POCKETCASTS_SUBSCRIBE = "pktc://subscribe/{feed_without_scheme}"
# Overcast — overcast.fm/podcasterinfo : paramètre url encodé.
OVERCAST_SUBSCRIBE = "overcast://x-callback-url/add?url={feed_encoded}"
# Bibliothèque de QR code chargée par le navigateur : aucune dépendance Python.
# Version fixée, avec l'empreinte publiée par cdnjs pour ce fichier.
QRCODE_JS = ("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/"
             "qrcode.min.js")
QRCODE_JS_SRI = ("sha512-CNgIRecGo7nphbeZ04Sc13ka07paqdeTu0WR1IM4kNcpmBAUSHSQX0"
                 "FslNhTDadL4O5SAGapGt4FodqL8My0mA==")


def subscribe_links(feed_url: str) -> dict[str, str]:
    """Liens d'abonnement par appli, pour le flux donné."""
    from urllib.parse import quote
    return {
        "Pocket Casts": POCKETCASTS_SUBSCRIBE.format(
            feed_without_scheme=re.sub(r"^https?://", "", feed_url)),
        "Overcast": OVERCAST_SUBSCRIBE.format(
            feed_encoded=quote(feed_url, safe="")),
    }


def _write_installer(cfg: Config) -> None:
    """Page d'installation : un testeur abonné et réveillé par le brief en
    moins de deux minutes, sans aide."""
    base = cfg.base_url
    pod = cfg.podcast
    feed_url = f"{base}/feed.xml"
    page_url = f"{base}/installer.html"
    onboarding = cfg.raw.get("onboarding") or {}
    shortcut_url = (onboarding.get("shortcut_url") or "").strip()
    # Le raccourci partagé garde son propre nom, distinct du podcast.
    shortcut_name = (onboarding.get("shortcut_name") or "").strip() or pod["title"]
    disclosure = (pod.get("ai_disclosure") or "").strip()
    title = pod["title"]

    def attr(value: str) -> str:
        return escape(value, {'"': "&quot;"})

    buttons = "\n".join(
        f'        <a class="btn" href="{attr(url)}">Ouvrir dans {escape(app)}</a>'
        for app, url in subscribe_links(feed_url).items())
    if shortcut_url:
        shortcut = (f'<a class="btn" href="{attr(shortcut_url)}">'
                    "Ajouter le raccourci</a>")
    else:
        shortcut = ('<span class="btn off" aria-disabled="true">'
                    "Ajouter le raccourci — bientôt disponible</span>")

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Installer {escape(title)}</title>
<style>
  :root {{ color-scheme: light dark; --bg:#fbfbfa; --fg:#1a1a18; --mut:#6b6b66; --line:#e4e4e0; --acc:#b4541f; --on:#ffffff; }}
  @media (prefers-color-scheme: dark) {{
    :root {{ --bg:#16161a; --fg:#ececeb; --mut:#93938d; --line:#2c2c31; --acc:#e08a52; --on:#16161a; }}
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--fg); padding:40px 16px 56px;
         font:16px/1.6 ui-sans-serif,-apple-system,"Segoe UI",system-ui,sans-serif; }}
  main {{ max-width: 560px; margin: 0 auto; }}
  h1 {{ font-size: 1.6rem; margin: 0 0 8px; letter-spacing: -.02em; }}
  h2 {{ font-size: 1.05rem; margin: 36px 0 12px; }}
  p {{ margin: 0 0 12px; }}
  .mut {{ color: var(--mut); font-size: .9rem; }}
  .btns {{ display:flex; flex-direction:column; gap:10px; margin: 0 0 16px; }}
  .btn {{ display:block; text-align:center; padding:13px 16px; border-radius:10px;
          background:var(--acc); color:var(--on); text-decoration:none; font-weight:600; }}
  .btn.off {{ background:transparent; color:var(--mut); border:1px dashed var(--line); font-weight:500; }}
  .copy {{ display:flex; gap:8px; align-items:stretch; }}
  .copy code {{ flex:1; min-width:0; word-break:break-all; font-size:.84rem; padding:10px 12px;
                border:1px solid var(--line); border-radius:8px; }}
  .copy button {{ font:inherit; font-size:.9rem; padding:0 14px; border-radius:8px; cursor:pointer;
                  border:1px solid var(--line); background:transparent; color:var(--fg); }}
  ol {{ padding-left: 1.3em; margin: 12px 0; }}
  li {{ margin: 4px 0; }}
  .qr {{ display:flex; gap:16px; align-items:center; }}
  .qr div {{ background:#fff; padding:8px; border-radius:8px; line-height:0; flex:none; }}
  hr {{ border:0; border-top:1px solid var(--line); margin:36px 0 0; }}
</style>
</head>
<body>
  <main>
    <h1>{escape(title)}</h1>
    <p>Quelques minutes d'actu chaque matin, lancées par ton réveil.</p>
    <p class="mut">{escape(disclosure)}</p>

    <h2>Étape 1 — S'abonner</h2>
    <div class="btns">
{buttons}
    </div>
    <p class="mut">Apple Podcasts ne propose pas de lien d'abonnement direct :
      Bibliothèque → « … » → Ajouter une émission par URL, puis colle
      l'adresse ci-dessous. Même adresse pour toute autre appli, et pour
      Android.</p>
    <div class="copy">
      <code id="feed">{escape(feed_url)}</code>
      <button type="button" id="copy">Copier</button>
    </div>
    <p class="mut" style="margin-top:12px">Dans l'appli de podcast, active le
      téléchargement automatique : l'épisode sera là même sans réseau au
      réveil.</p>

    <h2>Étape 2 — Lancer le brief au réveil</h2>
    <div class="btns">
      {shortcut}
    </div>
    <ol>
      <li>Ouvre Raccourcis, onglet Automatisation, puis touche +.</li>
      <li>Choisis Réveil, puis « Est arrêté », et Exécuter immédiatement.</li>
      <li>Choisis le raccourci « {escape(shortcut_name)} ».</li>
    </ol>
    <p class="mut">Les libellés exacts peuvent varier selon la version d'iOS.</p>

    <hr>
    <h2>Depuis un ordinateur</h2>
    <div class="qr">
      <div id="qr"></div>
      <p class="mut">Scanne ce code avec l'appareil photo du téléphone pour
        ouvrir cette page dessus.</p>
    </div>
  </main>
  <script src="{QRCODE_JS}" integrity="{QRCODE_JS_SRI}"
          crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <script>
    (function () {{
      var feed = {json.dumps(feed_url)};
      var btn = document.getElementById("copy");
      btn.addEventListener("click", function () {{
        function done() {{ btn.textContent = "Copié"; }}
        if (navigator.clipboard && window.isSecureContext) {{
          navigator.clipboard.writeText(feed).then(done);
        }} else {{
          var r = document.createRange();
          r.selectNodeContents(document.getElementById("feed"));
          var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
          try {{ document.execCommand("copy"); done(); }} catch (e) {{}}
        }}
      }});
      if (window.QRCode) {{
        new QRCode(document.getElementById("qr"), {{
          text: {json.dumps(page_url)}, width: 132, height: 132,
          colorDark: "#000000", colorLight: "#ffffff"
        }});
      }}
    }})();
  </script>
</body>
</html>
"""
    (DOCS / "installer.html").write_text(html, encoding="utf-8")
