// Lecture du flux podcast de Lora. Aucune dépendance : le flux est produit par
// src/feed.py, sa forme est connue et stable, un parseur XML complet serait
// plus lourd que le besoin.
//
// Un épisode est une liste de pistes jouées à la suite. Aujourd'hui le flux
// n'en donne qu'une (l'enclosure) ; demain, un segment par rubrique, que l'app
// filtrera selon les rubriques choisies.

export type Track = {
  url: string;
  title: string;
  durationSec: number | null;
  sizeBytes: number | null;
};

export type Episode = {
  guid: string;
  title: string;
  pubDate: Date;
  tracks: Track[];
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tagText(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${escapeRegExp(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRegExp(tag)}>`));
  if (!m) return null;
  const cdata = m[1].match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return (cdata ? cdata[1] : decodeEntities(m[1])).trim();
}

function tagAttributes(xml: string, tag: string): Record<string, string> | null {
  const m = xml.match(new RegExp(`<${escapeRegExp(tag)}\\s([^>]*?)/?>`));
  if (!m) return null;
  const attrs: Record<string, string> = {};
  for (const a of m[1].matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    attrs[a[1]] = decodeEntities(a[3] ?? a[4]);
  }
  return attrs;
}

/** « 3:19 », « 1:02:03 » ou « 199 » → secondes. */
export function parseDuration(text: string | null): number | null {
  if (!text) return null;
  const parts = text.trim().split(':').map(Number);
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !Number.isFinite(p))) return null;
  return parts.reduce((total, p) => total * 60 + p, 0);
}

function parseItem(itemXml: string): Episode | null {
  const enclosure = tagAttributes(itemXml, 'enclosure');
  const pubDate = new Date(tagText(itemXml, 'pubDate') ?? '');
  if (!enclosure?.url || Number.isNaN(pubDate.getTime())) return null;
  const title = tagText(itemXml, 'title') ?? '';
  const size = Number(enclosure.length);
  return {
    guid: tagText(itemXml, 'guid') ?? enclosure.url,
    title,
    pubDate,
    tracks: [
      {
        url: enclosure.url,
        title,
        durationSec: parseDuration(tagText(itemXml, 'itunes:duration')),
        sizeBytes: Number.isFinite(size) && size > 0 ? size : null,
      },
    ],
  };
}

/** Tous les épisodes valides du flux, du plus récent au plus ancien. */
export function parseFeed(xml: string): Episode[] {
  const episodes: Episode[] = [];
  for (const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)) {
    const episode = parseItem(m[1]);
    if (episode) episodes.push(episode);
  }
  return episodes.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

export function latestEpisode(xml: string): Episode | null {
  return parseFeed(xml)[0] ?? null;
}

export async function fetchLatestEpisode(feedUrl: string): Promise<Episode | null> {
  // GitHub Pages met le flux en cache 10 min : sans ce paramètre, l'app
  // ouverte juste après la publication peut recevoir la version de la veille.
  const url = `${feedUrl}${feedUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (!response.ok) {
    throw new Error(`Flux indisponible (HTTP ${response.status})`);
  }
  return latestEpisode(await response.text());
}
