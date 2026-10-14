"""Génération du flux RSS podcast (compatible Apple Podcasts / Pocket Casts /
Overcast) et rétention des épisodes."""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape

from . import release as release_mod
from . import topics as topics_mod
from .config import ROOT, Config

DOCS = ROOT / "docs"
EPISODES_DIR = DOCS / "episodes"
INDEX = DOCS / "episodes.json"


def load_index() -> list[dict]:
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
    return next((e for e in load_index() if e["date"] == date), None)


def episode_url(cfg: Config, filename: str) -> str:
    return f"{cfg.base_url}/episodes/{filename}"


def publish_audio(cfg: Config, mp3_path: Path) -> tuple[str, str]:
    """Met le mp3 en ligne selon audio.storage ; renvoie (url, stockage).

    Un envoi à la Release qui échoue ne bloque jamais l'épisode : il reste
    dans docs/episodes/, servi par GitHub Pages comme avant."""
    if cfg.audio["storage"] == "releases":
        try:
            url = release_mod.upload(cfg, mp3_path)
        except release_mod.ReleaseError as exc:
            print(f"   ⚠⚠ ENVOI À LA RELEASE ÉCHOUÉ — {exc}\n"
                  f"   ⚠⚠ Repli : l'épisode est servi depuis "
                  f"docs/episodes/{mp3_path.name} (GitHub Pages).",
                  file=sys.stderr)
        else:
            # Plus rien à committer : le fichier vit dans la Release. Un
            # épisode du même jour déjà suivi par Git part avec lui.
            mp3_path.unlink()
            print(f"   → envoyé à la Release « {cfg.audio['release_tag']} »")
            return url, "releases"
    return episode_url(cfg, mp3_path.name), "pages"


def register_episode(cfg: Config, *, date: str, filename: str, url: str,
                     storage: str, title: str, summary: str, duration: int,
                     size: int, topics: list[dict],
                     hook: str = "") -> list[dict]:
    """Ajoute (ou remplace) l'épisode du jour, applique la rétention."""
    episodes = [e for e in load_index() if e["date"] != date]
    entry = {
        "date": date,
        "filename": filename,
        # Mémorisée à la publication : le flux ne la recalcule pas, sinon
        # changer audio.storage déplacerait les épisodes déjà publiés.
        "url": url,
        "storage": storage,
        "title": title,
        "summary": summary,
        "duration": duration,
        "size": size,
        "topics": topics,
        "pub_date": datetime.now(timezone.utc).isoformat(),
    }
    # L'accroche dite par Marc : absente des épisodes d'avant, et des runs
    # qui n'en ont pas, plutôt que vide.
    if hook:
        entry["hook"] = hook
    episodes.append(entry)
    episodes.sort(key=lambda e: e["date"], reverse=True)

    # Coupe à la date, pas au nombre d'épisodes : avec des runs sautés, les
    # 30 derniers épisodes remonteraient à plus de 30 jours. Les dates ISO se
    # comparent comme des chaînes.
    cutoff = (datetime.strptime(date, "%Y-%m-%d")
              - timedelta(days=int(cfg.podcast["retention_days"]))
              ).strftime("%Y-%m-%d")
    dropped = [e for e in episodes if e["date"] <= cutoff]
    episodes = [e for e in episodes if e["date"] > cutoff]
    for old in dropped:
        mp3 = EPISODES_DIR / old["filename"]
        if mp3.exists():
            mp3.unlink()
    if (cfg.audio["storage"] == "releases"
            or any(e.get("storage") == "releases" for e in dropped)):
        _prune_release(cfg, cutoff)

    _save_index(episodes)
    return episodes


def _prune_release(cfg: Config, cutoff: str) -> None:
    # Un nettoyage raté ne coûte que de la place : l'épisode du jour sort
    # quand même, et le run suivant rebalaiera toute la Release.
    try:
        removed = release_mod.prune(cfg, cutoff)
    except release_mod.ReleaseError as exc:
        print(f"   ⚠ Rétention de la Release non appliquée — {exc}",
              file=sys.stderr)
        return
    if removed:
        print(f"   → {len(removed)} épisode(s) expiré(s) retiré(s) de la "
              "Release")


def _audio_url(cfg: Config, episode: dict) -> str:
    # Les épisodes publiés avant l'URL mémorisée étaient tous dans docs/.
    return episode.get("url") or episode_url(cfg, episode["filename"])


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


def _cdata(text: str) -> str:
    # « ]]> » fermerait la section : on la coupe en deux.
    return "<![CDATA[" + text.replace("]]>", "]]]]><![CDATA[>") + "]]>"


def chapters_url(cfg: Config, date: str) -> str:
    return f"{cfg.base_url}/{cfg.raw['topics']['chapters_dir']}/brief-{date}.json"


def _write_chapters(cfg: Config, episodes: list[dict]) -> set[str]:
    """Un fichier de chapitres par épisode dont tous les débuts sont connus ;
    les fichiers d'épisodes retirés du flux sont effacés. Renvoie les dates
    qui ont des chapitres."""
    folder = DOCS / cfg.raw["topics"]["chapters_dir"]
    written = set()
    for ep in episodes:
        doc = topics_mod.chapters(cfg, ep.get("topics") or [])
        if doc is None:
            continue
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f"brief-{ep['date']}.json").write_text(
            json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
        written.add(ep["date"])
    if folder.exists():
        for old in folder.glob("brief-*.json"):
            if old.stem.removeprefix("brief-") not in written:
                old.unlink()
    return written


def item_extensions(cfg: Config, ep: dict, has_chapters: bool) -> str:
    """Éléments ajoutés à un <item> : accroche, chapitres, sujets pour l'app."""
    extra = ""
    if ep.get("hook"):
        extra += f"\n      <itunes:subtitle>{escape(ep['hook'])}</itunes:subtitle>"
    if has_chapters:
        extra += (f'\n      <podcast:chapters url="{escape(chapters_url(cfg, ep["date"]))}"'
                  ' type="application/json+chapters"/>')
    # Sujets détaillés pour l'app (app/src/topics.ts), en JSON.
    app_topics = topics_mod.app_topics(ep.get("topics") or [])
    if app_topics:
        extra += ("\n      <lora:topics>"
                  + _cdata(json.dumps(app_topics, ensure_ascii=False))
                  + "</lora:topics>")
    return extra


def build_feed(cfg: Config, episodes: list[dict] | None = None) -> Path:
    episodes = episodes if episodes is not None else load_index()
    with_chapters = _write_chapters(cfg, episodes)
    pod = cfg.podcast
    base = cfg.base_url
    disclosure = (pod.get("ai_disclosure") or "").strip()
    channel_desc = pod["description"].strip()
    if disclosure:
        channel_desc = f"{channel_desc}\n\n{disclosure}"

    items = []
    for ep in episodes:
        url = _audio_url(cfg, ep)
        notes = ep["summary"]
        if ep.get("topics"):
            lines = "\n".join(f"• {t.get('title', '')}" for t in ep["topics"])
            notes = f"{notes}\n\nAu sommaire :\n{lines}"
        if disclosure:
            notes = f"{notes}\n\n{disclosure}"
        extra = item_extensions(cfg, ep, ep["date"] in with_chapters)
        # Le préfixe du guid reste « brief-matin » malgré le nom Lora : le
        # changer ferait réapparaître tous les épisodes comme nouveaux.
        items.append(f"""    <item>
      <title>{escape(ep['title'])}</title>
      <description>{escape(notes)}</description>{extra}
      <itunes:summary>{escape(notes)}</itunes:summary>
      <pubDate>{format_datetime(_pub_datetime(ep))}</pubDate>
      <guid isPermaLink="false">brief-matin-{ep['date']}</guid>
      <enclosure url="{escape(url)}" length="{ep['size']}" type="audio/mpeg"/>
      <itunes:duration>{_fmt_duration(ep['duration'])}</itunes:duration>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:explicit>false</itunes:explicit>
    </item>""")

    subcategory = (pod.get("subcategory") or "").strip()
    if subcategory:
        category = (f'<itunes:category text="{escape(pod["category"])}">'
                    f'<itunes:category text="{escape(subcategory)}"/>'
                    "</itunes:category>")
    else:
        category = f'<itunes:category text="{escape(pod["category"])}"/>'

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
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:podcast="https://podcastindex.org/namespace/1.0"
     xmlns:lora="{escape(cfg.raw['topics']['namespace'])}">
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
    {category}
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


def _short_date(day: str) -> str:
    """« Lun. 12 oct. », comme l'écran Réveil de l'app."""
    from .brand import JOURS, MOIS

    d = datetime.strptime(day, "%Y-%m-%d")
    month = MOIS[d.month]
    month = month if len(month) <= 4 else f"{month[:3]}."
    return f"{JOURS[d.weekday()][:3].capitalize()}. {d.day} {month}"


def _minutes(seconds: int) -> str:
    """« 3 min 04 »."""
    m, s = divmod(max(int(seconds), 0), 60)
    return f"{m} min {s:02d}"


def _sources_label(topic: dict) -> str:
    count = len(topic.get("sources") or [])
    if not count:
        return ""
    return f"{count} source{'s' if count > 1 else ''}"


# Feuille de style commune aux deux pages : direction artistique V11 de
# l'app, skin chrome (app/src/skins/chrome.ts). Les teintes --t1 à --t6
# sont celles des sujets, dans l'ordre.
V11_CSS = """
  @font-face { font-family: "DSEG7"; src: url("dseg7-bold.woff2") format("woff2"); font-weight: 700; font-display: swap; }
  :root {
    color-scheme: dark;
    --bg:#0A0B0F; --surface:#111318; --surface2:#1B1E25; --text:#EEF0F4; --text2:#A3AAB6; --text3:#8A919E; --text4:#7A818E;
    --line:rgba(255,255,255,.07); --line2:rgba(255,255,255,.14); --ghost:rgba(255,255,255,.045);
    --accent:#FF6A13; --accentGlow:rgba(255,106,19,.45); --onKnob:#141822; --lcd:#39FF6A; --lcdGlow:rgba(57,255,106,.55);
    --glass:linear-gradient(180deg,#06080B 0%,#0B0E12 100%); --track:rgba(255,255,255,.1);
    --rim:linear-gradient(180deg,#F4F6F9 0%,#A3ABB8 30%,#3E4450 52%,#8E96A4 75%,#D6DAE1 100%);
    --knob:radial-gradient(circle at 34% 28%,#FFFFFF 0%,#D9DEE6 26%,#9098A8 62%,#4B5262 100%);
    --brand:linear-gradient(180deg,#FFFFFF 0%,#DCE1E9 42%,#7A8394 56%,#EEF1F5 100%);
    --t1:#F5C542; --t2:#FF6B9A; --t3:#A98BFF; --t4:#5CC8FF; --t5:#3DD6C6; --t6:#E2C9A4;
    --ui:"Schibsted Grotesk", -apple-system, system-ui, sans-serif; --mono:"Geist Mono", ui-monospace, monospace;
  }
  * { box-sizing: border-box; }
  html { background: var(--bg); }
  body { margin: 0; background: var(--bg); color: var(--text); font: 400 16px/1.5 var(--ui); -webkit-font-smoothing: antialiased;
         padding: max(28px, env(safe-area-inset-top)) 0 max(40px, env(safe-area-inset-bottom)); }
  a { color: inherit; }
  .wrap { max-width: 480px; margin: 0 auto; padding: 0 20px; }
  .label { font: 500 12px/1.3 var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--text3); margin: 0; }
  .brand { font-family: Michroma, sans-serif; letter-spacing: .28em; line-height: 1; background: var(--brand);
           -webkit-background-clip: text; background-clip: text; color: transparent; }
  .rim { padding: 1.5px; border-radius: 24px; background: var(--rim); box-shadow: 0 18px 40px rgba(0,0,0,.55); }
  .glass { border-radius: 22.5px; background: var(--glass); box-shadow: inset 0 1px 0 rgba(255,255,255,.07), inset 0 12px 30px rgba(0,0,0,.7); }
  .lcd { font-family: "DSEG7", var(--mono); font-weight: 700; color: var(--lcd); text-shadow: 0 0 8px var(--lcdGlow); line-height: 1; }
  [hidden] { display: none !important; }
  :focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
  header { display: flex; justify-content: space-between; align-items: center; height: 40px; }
  header .brand { font-size: 16px; }
  section { margin-top: 48px; }
  .head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; }
  .btn { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 56px; margin-top: 16px; border-radius: 28px;
         font: 700 17px/1.2 var(--ui); text-decoration: none; cursor: pointer; border: 0; }
  .btn:active { transform: scale(.97); }
  .btn.primary { background: var(--accent); color: #140A04; box-shadow: 0 10px 30px rgba(255,106,19,.35), inset 0 1px 0 rgba(255,255,255,.35); }
  .btn.ghost { background: var(--ghost); color: var(--text); border: 1px solid var(--line2); min-height: 52px; font-size: 16px; }
  .btn.off { background: transparent; color: var(--text3); border: 1px solid var(--line2); cursor: default; }
  .copie { display: flex; gap: 8px; }
  .copie code { flex: 1; min-width: 0; padding: 12px; border-radius: 12px; font: 400 12px/1.4 var(--mono); word-break: break-all;
                color: var(--text2); background: #07090C; border: 1px solid var(--line); }
  .copie button { flex: none; min-height: 44px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--line2); background: var(--ghost);
                  color: var(--text); font: 600 14px var(--ui); cursor: pointer; }
  footer { margin-top: 56px; text-align: center; }
  .ia { margin: 14px auto 0; max-width: 26em; font-size: 13px; color: var(--text4); }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
"""

FONTS_LINK = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
              '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
              '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
              'family=Schibsted+Grotesk:wght@400;500;600;700;800'
              '&amp;family=Geist+Mono:wght@400;500&amp;family=Michroma&amp;display=swap">')

# Copie du presse-papiers, partagée par les deux pages. Refusée, le lien
# reste au moins sélectionné, prêt à copier à la main.
COPY_JS = """
  (function () {
    var btn = document.getElementById("copy"), box = document.getElementById("feed");
    if (!btn || !box) return;
    btn.addEventListener("click", function () {
      function done() { btn.textContent = "Copié"; }
      function select() {
        var r = document.createRange(); r.selectNodeContents(box);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        try { if (document.execCommand("copy")) done(); } catch (e) {}
      }
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(box.textContent).then(done, select); else select();
    });
  })();
"""


def _attr(value: str) -> str:
    return escape(value, {'"': "&quot;"})


def _write_landing(cfg: Config, episodes: list[dict]) -> None:
    """Liste des épisodes : pratique pour copier l'URL du flux, ou réécouter."""
    base = cfg.base_url
    name = cfg.brand["name"]
    rows = "\n".join(
        f'      <li><span class="d">{escape(_short_date(e["date"]))}</span>'
        f'<a class="t" href="{_attr(_audio_url(cfg, e))}">{escape(e["title"])}</a>'
        f'<span class="m">{_fmt_duration(e["duration"])}</span></li>'
        for e in episodes[:15]
    ) or '      <li class="vide">Aucun épisode pour l\'instant.</li>'

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0A0B0F">
<title>{escape(cfg.podcast['title'])} — épisodes</title>
{FONTS_LINK}
<style>{V11_CSS}
  h1 {{ margin: 32px 0 0; font: 800 38px/1.02 var(--ui); letter-spacing: -.025em; }}
  .sub {{ margin: 12px 0 0; color: var(--text2); }}
  ul {{ list-style: none; margin: 0; padding: 0 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; }}
  li {{ display: flex; align-items: baseline; gap: 12px; min-height: 52px; padding: 14px 0; border-top: 1px solid var(--line); }}
  li:first-child {{ border-top: 0; }}
  .d {{ flex: none; width: 92px; font: 400 12px var(--mono); color: var(--text3); text-transform: uppercase; }}
  .t {{ flex: 1; text-decoration: none; font-size: 15px; }}
  .t:hover {{ color: var(--accent); }}
  .m {{ flex: none; font: 400 12px var(--mono); color: var(--text4); }}
  .vide {{ color: var(--text3); }}
  .install {{ margin-top: 24px; }}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <span class="brand" role="heading" aria-level="1" aria-label="{_attr(name)}">{escape(name.upper())}</span>
    <p class="label">{escape(cfg.raw['onboarding']['kicker'])}</p>
  </header>
  <h1>{escape(cfg.podcast['subtitle'])}</h1>
  <a class="btn primary install" href="installer.html">Installer {escape(name)} sur un téléphone</a>

  <section aria-labelledby="flux">
    <div class="head"><h2 id="flux" class="label">Adresse du flux</h2></div>
    <div class="copie"><code id="feed">{escape(base)}/feed.xml</code><button type="button" id="copy">Copier</button></div>
  </section>

  <section aria-labelledby="episodes">
    <div class="head"><h2 id="episodes" class="label">Épisodes</h2></div>
    <ul>
{rows}
    </ul>
  </section>

  <footer><p class="ia">{escape((cfg.podcast.get('ai_disclosure') or '').strip())}</p></footer>
</div>
<script>{COPY_JS}</script>
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


# Teintes des sujets disponibles dans la feuille de style (--t1 à --t6) :
# au-delà, elles reviennent.
TOPIC_TINTS = 6


def _player(cfg: Config, latest: dict) -> str:
    """Lecteur du dernier épisode et liste de ses sujets."""
    topics = "\n".join(
        f'      <li><span class="dot" style="background:var(--t{i % TOPIC_TINTS + 1})"></span>'
        f'<span class="t">{escape(t.get("title", ""))}</span>'
        f'<span class="s">{escape(_sources_label(t))}</span></li>'
        for i, t in enumerate(latest.get("topics") or []))
    topics_list = f'\n    <ul class="topics">\n{topics}\n    </ul>' if topics else ""
    duration = int(latest["duration"])
    return f"""
  <section aria-labelledby="ecoute">
    <div class="head"><h2 id="ecoute" class="label">Le brief d’aujourd’hui</h2><p class="label">{escape(_short_date(latest["date"]))}</p></div>
    <div class="player rim"><div class="glass">
      <div class="row">
        <span class="lcd" id="t">00:00</span>
        <span class="label" id="reste">{escape(_minutes(duration))}</span>
        <button class="knob" id="play" type="button" aria-label="Écouter le brief d’aujourd’hui">
          <svg id="i-play" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="margin-left:3px"><path d="M7 4.5v15l13-7.5z"/></svg>
          <svg id="i-pause" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" hidden><rect x="6" y="4.5" width="4.2" height="15" rx="1"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1"/></svg>
        </button>
      </div>
      <div class="bar" id="bar" role="slider" aria-label="Position dans le brief" aria-valuemin="0" aria-valuemax="{duration}" aria-valuenow="0" tabindex="0"><span class="fill" id="fill"></span></div>
    </div></div>
    <audio id="audio" preload="none" src="{_attr(_audio_url(cfg, latest))}"></audio>{topics_list}
  </section>
  <script>
  (function () {{
    var a = document.getElementById("audio"), play = document.getElementById("play"),
        ip = document.getElementById("i-play"), ipa = document.getElementById("i-pause"),
        t = document.getElementById("t"), reste = document.getElementById("reste"),
        fill = document.getElementById("fill"), bar = document.getElementById("bar");
    var total = {duration};
    function mmss(s) {{ s = Math.max(0, Math.floor(s)); var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r; }}
    function render() {{
      var d = a.duration || total, c = a.currentTime || 0;
      t.textContent = mmss(c); reste.textContent = "-" + mmss(d - c);
      fill.style.width = (100 * c / d) + "%"; bar.setAttribute("aria-valuenow", Math.floor(c));
    }}
    play.addEventListener("click", function () {{ a.paused ? a.play() : a.pause(); }});
    a.addEventListener("play", function () {{ ip.hidden = true; ipa.hidden = false; play.setAttribute("aria-label", "Pause"); }});
    a.addEventListener("pause", function () {{ ip.hidden = false; ipa.hidden = true; play.setAttribute("aria-label", "Reprendre le brief"); }});
    a.addEventListener("timeupdate", render);
    function seek(x) {{ var r = bar.getBoundingClientRect(); a.currentTime = Math.min(1, Math.max(0, (x - r.left) / r.width)) * (a.duration || total); render(); }}
    bar.addEventListener("click", function (e) {{ seek(e.clientX); }});
    bar.addEventListener("keydown", function (e) {{
      if (e.key === "ArrowRight") {{ a.currentTime += 15; render(); }}
      if (e.key === "ArrowLeft") {{ a.currentTime -= 15; render(); }}
    }});
  }})();
  </script>"""


def _write_installer(cfg: Config, episodes: list[dict]) -> None:
    """Page d'installation : un testeur abonné et réveillé par le brief en
    moins de deux minutes, sans aide. Sans épisode, pas de lecteur : les
    étapes seules."""
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
    headline = onboarding["headline"]
    page_title = f"{name} — {headline.rstrip('.')[:1].lower()}{headline.rstrip('.')[1:]}"
    signature = " ".join(brand["closing_display"])
    player_app_url = (onboarding.get("player_app_url") or "").strip()
    video = (onboarding.get("automation_video") or "").strip()
    spotify_url = (onboarding.get("spotify_url") or "").strip()
    cover = f"{base}/{pod['cover_image']}" if pod.get("cover_image") else ""

    # Sur iPhone, le raccourci abonne lui-même : ces boutons ne servent plus
    # qu'aux autres applis et à Android, repliés en bas de page.
    apps = subscribe_links(feed_url)
    if spotify_url:
        apps["Spotify"] = spotify_url
    buttons = "\n".join(
        f'        <a class="btn ghost" href="{_attr(url)}">{escape(app)}</a>'
        for app, url in apps.items())
    if shortcut_url:
        shortcut = f'<a class="btn primary" href="{_attr(shortcut_url)}">Ajouter {escape(name)}</a>'
    else:
        shortcut = (f'<span class="btn off" aria-disabled="true">Ajouter '
                    f'{escape(name)} — bientôt disponible</span>')
    store = (f'\n        <a class="btn ghost" href="{_attr(player_app_url)}">Ouvrir l’App Store</a>'
             if player_app_url else "")
    video_tag = (f'\n        <video playsinline muted controls preload="none" '
                 f'src="{_attr(base + "/" + video.lstrip("/"))}"></video>'
                 if video else "")
    og_image = f'\n<meta property="og:image" content="{_attr(cover)}">' if cover else ""

    latest = max(episodes, key=lambda e: e["date"]) if episodes else None
    player = _player(cfg, latest) if latest else ""
    footer_note = f'\n    <p class="ia">{escape(disclosure)}</p>' if disclosure else ""

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0A0B0F">
<title>{escape(page_title)}</title>
<meta name="description" content="{_attr(onboarding['page_description'])}">
<meta property="og:title" content="{_attr(page_title)}">
<meta property="og:description" content="{_attr(onboarding['page_description'])}">{og_image}
{FONTS_LINK}
<style>{V11_CSS}
  .knob {{ border: 0; cursor: pointer; background: var(--knob); color: var(--onKnob); display: grid; place-items: center; border-radius: 50%;
          box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent), 0 0 24px var(--accentGlow), inset 0 -3px 6px rgba(0,0,0,.3); }}
  .knob:active {{ transform: scale(.97); }}
  .hero {{ margin-top: 28px; }}
  .clock {{ height: 132px; display: grid; place-items: center; align-content: center; gap: 12px;
           background-image: radial-gradient(80% 70% at 50% 35%, rgba(57,255,106,.08), transparent 70%), var(--glass); }}
  .clock .lcd {{ font-size: 68px; }}
  .clock .label {{ color: var(--lcd); opacity: .8; }}
  h1 {{ margin: 32px 0 0; font: 800 40px/1.02 var(--ui); letter-spacing: -.025em; }}
  .pitch {{ margin: 14px 0 0; font-size: 17px; line-height: 1.5; color: var(--text2); max-width: 30em; }}
  .player .glass {{ padding: 16px 16px 14px 20px; display: grid; gap: 14px; }}
  .row {{ display: flex; align-items: center; gap: 16px; }}
  .row .lcd {{ font-size: 34px; flex: 1; }}
  .row .label {{ color: var(--lcd); opacity: .75; }}
  .player .knob {{ width: 64px; height: 64px; flex: none; }}
  .bar {{ position: relative; height: 16px; cursor: pointer; }}
  .bar::before {{ content: ""; position: absolute; left: 0; right: 0; top: 7px; height: 2px; border-radius: 1px; background: var(--track); }}
  .fill {{ position: absolute; left: 0; top: 7px; height: 2px; width: 0; border-radius: 1px; background: var(--accent); box-shadow: 0 0 6px rgba(255,106,19,.8); }}
  .topics {{ list-style: none; margin: 18px 0 0; padding: 0; }}
  .topics li {{ display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 8px 0; border-top: 1px solid var(--line); }}
  .topics li:first-child {{ border-top: 0; }}
  .dot {{ width: 7px; height: 7px; border-radius: 4px; flex: none; }}
  .topics .t {{ flex: 1; font-size: 15px; color: #D7DBE2; }}
  .topics .s {{ font: 400 12px var(--mono); color: var(--text4); white-space: nowrap; }}
  .steps {{ display: grid; gap: 12px; }}
  .step {{ background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 20px; }}
  .step h3 {{ display: flex; align-items: center; gap: 12px; margin: 0; font: 700 19px/1.25 var(--ui); }}
  .num {{ width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 50%;
         border: 1px solid var(--line2); font: 500 13px var(--mono); color: var(--text2); }}
  .step p {{ margin: 12px 0 0; color: var(--text2); font-size: 15px; }}
  .step video {{ display: block; width: 100%; height: auto; margin-top: 14px; border-radius: 12px; border: 1px solid var(--line); }}
  .tag {{ font: 500 11px var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--text3);
         border: 1px solid var(--line2); border-radius: 10px; padding: 3px 8px; margin-left: auto; }}
  ol.gestes {{ margin: 14px 0 0; padding: 0; list-style: none; display: grid; gap: 10px; counter-reset: g; }}
  ol.gestes li {{ counter-increment: g; display: grid; grid-template-columns: 24px 1fr; gap: 8px; font-size: 15px; color: var(--text2); }}
  ol.gestes li::before {{ content: counter(g); font: 500 13px/1.6 var(--mono); color: var(--accent); }}
  .fort {{ color: var(--text); font-weight: 600; }}
  .note {{ font-size: 13px !important; color: var(--text4) !important; }}
  details {{ margin-top: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 0 20px; }}
  summary {{ cursor: pointer; list-style: none; min-height: 56px; display: flex; align-items: center; justify-content: space-between; font: 600 16px var(--ui); }}
  summary::-webkit-details-marker {{ display: none; }}
  summary::after {{ content: "+"; font: 400 20px var(--mono); color: var(--text3); }}
  details[open] summary::after {{ content: "–"; }}
  details p {{ margin: 0 0 12px; color: var(--text2); font-size: 15px; }}
  details .btns {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }}
  details .btn {{ margin-top: 0; }}
  details .copie {{ margin-bottom: 20px; }}
  .signature {{ margin: 0; font: 800 22px/1.2 var(--ui); letter-spacing: -.02em; }}
  .qr {{ display: none; }}
  @media (min-width: 820px) and (hover: hover) {{
    .qr {{ display: flex; gap: 18px; align-items: center; justify-content: center; margin: 28px 0 0; text-align: left; font-size: 15px; color: var(--text2); }}
    .qr #qr {{ background: #fff; padding: 8px; border-radius: 12px; line-height: 0; }}
  }}
</style>
</head>
<body>
<div class="wrap">

  <header>
    <span class="brand" aria-label="{_attr(name)}">{escape(name.upper())}</span>
    <p class="label">{escape(onboarding["kicker"])}</p>
  </header>

  <div class="hero">
    <div class="rim"><div class="glass clock" aria-hidden="true">
      <span class="lcd">{escape(onboarding["display_time"])}</span>
      <p class="label">{escape(brand["opening_display"])}</p>
    </div></div>
    <h1>{escape(headline)}</h1>
    <p class="pitch">{escape(onboarding["pitch"])}</p>
  </div>
{player}
  <section aria-labelledby="installer">
    <div class="head"><h2 id="installer" class="label">L’installer · 1 minute</h2></div>
    <div class="steps">
      <div class="step">
        <h3><span class="num">1</span>Installe Pocket Casts</h3>
        <p>L’appli de podcast gratuite dans laquelle {escape(name)} arrive chaque matin.</p>{store}
      </div>
      <div class="step">
        <h3><span class="num">2</span>Ajoute {escape(name)}</h3>
        <p>Touche une fois : tu es abonné, et le brief du jour se lance.</p>
        {shortcut}
        <p class="note">Dans Pocket Casts, active le téléchargement automatique : le brief t’attendra même sans réseau.</p>
      </div>
      <div class="step">
        <h3><span class="num">3</span>{escape(name)} au réveil<span class="tag">Conseillé</span></h3>
        <p>Le brief démarre quand tu coupes ton réveil. À faire une fois.</p>{video_tag}
        <ol class="gestes">
          <li><span>Raccourcis → <span class="fort">Automatisation</span> → <span class="fort">+</span></span></li>
          <li><span><span class="fort">Réveil</span> → « Est arrêté » → <span class="fort">Exécuter immédiatement</span></span></li>
          <li><span>Choisis le raccourci <span class="fort">« {escape(shortcut_name)} »</span></span></li>
        </ol>
        <p class="note">Les libellés peuvent varier selon la version d’iOS.</p>
      </div>
    </div>

    <details>
      <summary>Autre appli ou Android ?</summary>
      <p>Abonne-toi directement :</p>
      <div class="btns">
{buttons}
      </div>
      <p>Ailleurs (Apple Podcasts, Android) : « Ajouter une émission par URL », puis colle ce lien.</p>
      <div class="copie"><code id="feed">{escape(feed_url)}</code><button type="button" id="copy">Copier</button></div>
    </details>
  </section>

  <footer>
    <p class="signature">{escape(signature)}</p>
    <div class="qr"><div id="qr"></div><p>Sur ordinateur ?<br>Scanne avec ton téléphone.</p></div>{footer_note}
  </footer>

</div>
<script src="{QRCODE_JS}" integrity="{QRCODE_JS_SRI}"
        crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script>{COPY_JS}
  if (window.QRCode && window.matchMedia("(min-width: 820px) and (hover: hover)").matches) {{
    new QRCode(document.getElementById("qr"), {{ text: {json.dumps(page_url)}, width: 120, height: 120, colorDark: "#000000", colorLight: "#ffffff" }});
  }}
</script>
</body>
</html>
"""
    (DOCS / "installer.html").write_text(html, encoding="utf-8")
