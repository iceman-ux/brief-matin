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
    _write_installer(cfg, episodes)


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


# Décor fixe de la page d'installation, servi depuis docs/ : l'affiche (ville
# à gradins, soleil levant) et le soleil à rayons des intertitres.
INSTALLER_SCENE = "lora-scene.svg"
INSTALLER_SYMBOL = "lora-rayons.svg"


def _write_installer(cfg: Config, episodes: list[dict]) -> None:
    """Page d'installation : un testeur abonné et réveillé par le brief en
    moins de deux minutes, sans aide."""
    base = cfg.base_url
    pod = cfg.podcast
    brand = cfg.brand
    feed_url = f"{base}/feed.xml"
    page_url = f"{base}/installer.html"
    onboarding = cfg.raw.get("onboarding") or {}
    shortcut_url = (onboarding.get("shortcut_url") or "").strip()
    # Le raccourci partagé garde son propre nom, distinct du podcast.
    shortcut_name = (onboarding.get("shortcut_name") or "").strip() or pod["title"]
    disclosure = (pod.get("ai_disclosure") or "").strip()
    name = brand["name"]
    closing_name, closing_wish = brand["closing_display"]
    signature = (f'{escape(closing_name)}'
                 '<span class="losange" aria-hidden="true"></span>'
                 f'{escape(closing_wish)}')

    def attr(value: str) -> str:
        return escape(value, {'"': "&quot;"})

    buttons = "\n".join(
        f'        <a class="btn{"" if i == 0 else " ghost"}" '
        f'href="{attr(url)}">{escape(app)}</a>'
        for i, (app, url) in enumerate(subscribe_links(feed_url).items()))
    if shortcut_url:
        shortcut = (f'<a class="btn" href="{attr(shortcut_url)}">'
                    "Ajouter le raccourci</a>")
    else:
        shortcut = ('<span class="btn off" aria-disabled="true">'
                    "Ajouter le raccourci — bientôt disponible</span>")

    latest = max(episodes, key=lambda e: e["date"]) if episodes else None
    if latest:
        note = f'{onboarding["pitch"]} {onboarding["listen_prompt"]}'
        player = (f'\n      <audio controls preload="none" src="'
                  f'{attr(base + "/episodes/" + latest["filename"])}"></audio>')
    else:
        note = f'{onboarding["pitch"]} {onboarding["install_prompt"]}'
        player = ""
    footer_note = f"\n    <p>{escape(disclosure)}</p>" if disclosure else ""

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0B0E2A">
<title>Installer {escape(name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Limelight&family=Josefin+Sans:wght@400;600;700&family=Bodoni+Moda:ital,opsz,wght@1,6..96,400&display=swap">
<style>
  :root {{
    color-scheme: dark;
    --nuit: #0B0E2A; --indigo: #1B2466; --ambre: #F2A33A; --laiton: #C9953C; --velours: #8E1426;
    --ivoire: #EFE8D8; --sourd: #B9B2A2; --panneau: #0e1235;
    --display: "Limelight", "Didot", Georgia, serif;
    --ui: "Josefin Sans", ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif;
    --accroche: "Bodoni Moda", "Didot", Georgia, serif;
  }}
  * {{ box-sizing: border-box; }}
  html {{ background: var(--nuit); }}
  body {{ margin: 0; color: var(--ivoire); background: var(--nuit); font: 400 20px/1.5 var(--ui);
         padding-bottom: max(40px, env(safe-area-inset-bottom)); }}

  /* Affiche */
  .hero {{ position: relative; max-width: 560px; margin: 0 auto; overflow: hidden; }}
  .scene {{ display: block; width: 100%; height: auto; }}
  .hero::after {{ content: ""; position: absolute; inset: 12px; pointer-events: none;
    border: 1px solid var(--laiton); outline: 1px solid rgba(201,149,60,.4); outline-offset: 4px; }}
  .titre {{ position: absolute; left: 0; right: 0; top: max(46px, calc(env(safe-area-inset-top) + 20px));
           text-align: center; padding: 0 24px; }}
  .surtitre {{ margin: 0; font: 600 13px/1 var(--ui); letter-spacing: .4em; text-transform: uppercase; color: var(--laiton); }}
  h1 {{ margin: 14px 0 0; font: 400 clamp(72px, 24vw, 120px)/.9 var(--display); color: #E8B55A;
       letter-spacing: .05em; text-transform: uppercase; text-shadow: 0 3px 22px rgba(11,14,42,.7); }}
  .accroche {{ margin: 14px 0 0; font: italic 400 clamp(17px, 4.9vw, 21px)/1.3 var(--accroche); white-space: nowrap; color: var(--ivoire);
              display: flex; align-items: center; justify-content: center; gap: 12px; }}
  .accroche::before, .accroche::after {{ content: ""; flex: none; width: 22px; height: 1px; background: var(--laiton); }}

  main {{ max-width: 520px; margin: 0 auto; padding: 30px 18px 0; display: grid; gap: 26px; }}

  /* Écoute */
  .ecoute {{ text-align: center; }}
  .formule {{ margin: 0; font: italic 400 30px/1.2 var(--accroche); color: #E8B55A; }}
  .formule-note {{ margin: 8px 0 16px; color: var(--sourd); font-size: 18px; }}
  audio {{ width: 100%; height: 44px; }}

  /* Intertitre Art déco */
  .intertitre {{ display: grid; justify-items: center; gap: 10px; margin: 6px 0 0; text-align: center; }}
  .symbole {{ width: 64px; height: 40px; }}
  .intertitre h2 {{ margin: 0; font: 600 15px/1.2 var(--ui); letter-spacing: .32em; text-transform: uppercase; color: var(--laiton);
                   display: flex; align-items: center; gap: 12px; }}
  .intertitre h2::before, .intertitre h2::after {{ content: ""; width: 30px; height: 1px; background: var(--laiton); }}

  /* Étapes */
  .etape {{ position: relative; background: linear-gradient(180deg, var(--panneau), #0b0f2e);
           border: 1px solid rgba(201,149,60,.5); padding: 26px 20px 24px; }}
  .etape::before, .etape::after {{ content: ""; position: absolute; width: 18px; height: 18px; border: 2px solid var(--laiton); }}
  .etape::before {{ top: -5px; left: -5px; border-right: 0; border-bottom: 0; }}
  .etape::after {{ bottom: -5px; right: -5px; border-left: 0; border-top: 0; }}
  .etape h3 {{ display: flex; align-items: center; gap: 14px; margin: 0 0 18px; font: 700 24px/1.2 var(--ui); }}
  .num {{ flex: none; width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--laiton);
         outline: 1px solid rgba(201,149,60,.35); outline-offset: 3px; border-radius: 50%;
         font: 400 22px/1 var(--display); color: var(--ambre); padding-top: 3px; }}
  .choix {{ margin: 0 0 12px; color: var(--sourd); font-size: 18px; }}
  .btns {{ display: grid; gap: 12px; }}
  .btn {{ display: flex; align-items: center; justify-content: center; text-align: center; min-height: 58px; padding: 4px 18px 0;
         background: var(--ambre); color: var(--nuit); text-decoration: none; border: 0;
         font: 700 18px/1.2 var(--ui); letter-spacing: .08em; text-transform: uppercase;
         box-shadow: 0 0 0 1px var(--laiton), 0 8px 26px rgba(242,163,58,.22); }}
  .btn:active {{ transform: translateY(1px); }}
  .btn.ghost {{ background: transparent; color: var(--ivoire); box-shadow: inset 0 0 0 1px var(--laiton); }}
  .btn.off {{ background: transparent; color: var(--sourd); box-shadow: inset 0 0 0 1px rgba(201,149,60,.35); }}
  .astuce {{ margin: 14px 0 0; color: var(--sourd); font-size: 18px; }}
  details {{ margin-top: 16px; border-top: 1px solid rgba(201,149,60,.3); padding-top: 12px; }}
  summary {{ cursor: pointer; list-style: none; color: var(--ivoire); font-size: 18px; font-weight: 600; }}
  summary::-webkit-details-marker {{ display: none; }}
  summary::after {{ content: " +"; color: var(--ambre); }}
  details[open] summary::after {{ content: " –"; }}
  details p {{ margin: 10px 0; color: var(--sourd); font-size: 18px; }}
  .copie {{ display: flex; gap: 8px; }}
  .copie code {{ flex: 1; min-width: 0; padding: 12px; font-size: 14px; word-break: break-all; color: var(--ivoire);
                background: rgba(0,0,0,.35); border: 1px solid rgba(201,149,60,.35); }}
  .copie button {{ flex: none; padding: 4px 16px 0; cursor: pointer; border: 0; font: 700 15px var(--ui);
                  letter-spacing: .1em; text-transform: uppercase; background: var(--ambre); color: var(--nuit); }}
  ol.gestes {{ margin: 0; padding: 0; list-style: none; display: grid; gap: 12px; counter-reset: g; }}
  ol.gestes li {{ counter-increment: g; display: grid; grid-template-columns: 30px 1fr; gap: 8px; }}
  ol.gestes li::before {{ content: counter(g); font: 400 20px/1.5 var(--display); color: var(--ambre); }}
  .fort {{ font-weight: 700; }}
  .note {{ margin: 14px 0 0; color: var(--sourd); font-size: 16px; }}
  a:focus-visible, button:focus-visible, summary:focus-visible {{ outline: 3px solid var(--ambre); outline-offset: 3px; }}

  footer {{ max-width: 520px; margin: 34px auto 0; padding: 0 18px; text-align: center; color: var(--sourd); font-size: 15px; }}
  footer .symbole {{ display: block; margin: 0 auto 14px; width: 48px; height: 30px; }}
  .signature {{ margin: 0 0 14px; font: italic 400 19px/1.3 var(--accroche); color: var(--ivoire); }}
  .losange {{ display: inline-block; width: 7px; height: 7px; margin: 0 10px 2px; background: var(--velours); transform: rotate(45deg); }}
  .qr {{ display: none; }}
  @media (min-width: 820px) and (hover: hover) {{
    .qr {{ display: flex; gap: 18px; align-items: center; justify-content: center; margin-bottom: 18px; text-align: left; font-size: 17px; color: var(--ivoire); }}
    .qr #qr {{ background: #fff; padding: 8px; line-height: 0; }}
  }}
</style>
</head>
<body>
  <header class="hero">
    <img class="scene" src="{INSTALLER_SCENE}" width="400" height="600"
         alt="Ville Art déco à l'aube, soleil levant entre les tours">
    <div class="titre">
      <p class="surtitre">{escape(onboarding["kicker"])}</p>
      <h1>{escape(name)}</h1>
      <p class="accroche">{escape(onboarding["tagline"])}</p>
    </div>
  </header>

  <main>
    <section class="ecoute" aria-label="Écouter le brief du jour">
      <p class="formule">« {escape(brand["opening_display"])} »</p>
      <p class="formule-note">{escape(note)}</p>{player}
    </section>

    <div class="intertitre">
      <img class="symbole" src="{INSTALLER_SYMBOL}" alt="">
      <h2>Trois gestes</h2>
    </div>

    <section class="etape" aria-labelledby="e1">
      <h3 id="e1"><span class="num">1</span>Abonne-toi</h3>
      <p class="choix">Dans ton appli de podcast :</p>
      <div class="btns">
{buttons}
      </div>
      <p class="astuce">Active le téléchargement automatique : l'épisode t'attendra même sans réseau.</p>
      <details>
        <summary>Apple Podcasts ou une autre appli</summary>
        <p>Dans Apple Podcasts : Bibliothèque → « … » → Ajouter une émission par URL, puis colle ce lien.</p>
        <div class="copie"><code id="feed">{escape(feed_url)}</code><button type="button" id="copy">Copier</button></div>
      </details>
    </section>

    <section class="etape" aria-labelledby="e2">
      <h3 id="e2"><span class="num">2</span>Ajoute le raccourci</h3>
      <div class="btns">{shortcut}</div>
    </section>

    <section class="etape" aria-labelledby="e3">
      <h3 id="e3"><span class="num">3</span>Relie-le à ton réveil</h3>
      <ol class="gestes">
        <li><span>Raccourcis → <span class="fort">Automatisation</span> → <span class="fort">+</span></span></li>
        <li><span><span class="fort">Réveil</span> → « Est arrêté » → <span class="fort">Exécuter immédiatement</span></span></li>
        <li><span>Choisis le raccourci <span class="fort">« {escape(shortcut_name)} »</span></span></li>
      </ol>
      <p class="note">Les libellés peuvent varier selon la version d'iOS.</p>
    </section>
  </main>

  <footer>
    <img class="symbole" src="{INSTALLER_SYMBOL}" alt="">
    <p class="signature">{signature}</p>
    <div class="qr"><div id="qr"></div><p>Sur ordinateur ?<br>Scanne avec ton téléphone.</p></div>{footer_note}
  </footer>

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
      if (window.QRCode && window.matchMedia("(min-width: 820px) and (hover: hover)").matches) {{
        new QRCode(document.getElementById("qr"), {{ text: {json.dumps(page_url)}, width: 120, height: 120, colorDark: "#000000", colorLight: "#ffffff" }});
      }}
    }})();
  </script>
</body>
</html>
"""
    (DOCS / "installer.html").write_text(html, encoding="utf-8")
