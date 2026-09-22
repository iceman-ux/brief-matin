"""Génération du flux RSS podcast (compatible Apple Podcasts / Pocket Casts /
Overcast) et rétention des épisodes."""

from __future__ import annotations

import json
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

    items = []
    for ep in episodes:
        url = f"{base}/episodes/{ep['filename']}"
        notes = ep["summary"]
        if ep.get("topics"):
            lines = "\n".join(f"• {t.get('title', '')}" for t in ep["topics"])
            notes = f"{notes}\n\nAu sommaire :\n{lines}"
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
    <description>{escape(pod['description'].strip())}</description>
    <language>{escape(pod['language'])}</language>
    <lastBuildDate>{last_build}</lastBuildDate>
    <itunes:author>{escape(pod['author'])}</itunes:author>
    <itunes:subtitle>{escape(pod['subtitle'])}</itunes:subtitle>
    <itunes:summary>{escape(pod['description'].strip())}</itunes:summary>
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
  </main>
</body>
</html>
"""
    (DOCS / "index.html").write_text(html, encoding="utf-8")
