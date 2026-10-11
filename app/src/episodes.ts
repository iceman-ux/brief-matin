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
  /** Premier titre du jour, tiré de la description ; null si absent. */
  hook: string | null;
  /** Lignes « Au sommaire » de la description, vide si absentes. */
  topics: string[];
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

// Forme des notes d'épisode écrites par src/feed.py : « Brief du AAAA-MM-JJ.
// titre · titre · … », puis « Au sommaire : » et une puce par sujet. Si le
// pipeline change cette forme, l'accroche et le sommaire disparaissent de
// l'app sans erreur, plutôt que d'afficher un texte mal découpé.
const NOTES_HEAD = /^Brief du \d{4}-\d{2}-\d{2}\.\s+(.+)$/m;
const HOOK_SEPARATOR = ' · ';
const TOPICS_HEAD = 'Au sommaire :';
const TOPIC_BULLET = /^\s*•\s*(.+?)\s*$/;

export function parseNotes(notes: string | null): { hook: string | null; topics: string[] } {
  if (!notes) return { hook: null, topics: [] };
  const head = notes.match(NOTES_HEAD);
  const hook = head ? head[1].split(HOOK_SEPARATOR)[0].trim() || null : null;
  const topics: string[] = [];
  const start = notes.indexOf(TOPICS_HEAD);
  if (start >= 0) {
    for (const line of notes.slice(start + TOPICS_HEAD.length).trim().split('\n')) {
      const m = line.match(TOPIC_BULLET);
      if (!m) break;
      topics.push(m[1]);
    }
  }
  return { hook, topics };
}

function parseItem(itemXml: string): Episode | null {
  const enclosure = tagAttributes(itemXml, 'enclosure');
  const pubDate = new Date(tagText(itemXml, 'pubDate') ?? '');
  if (!enclosure?.url || Number.isNaN(pubDate.getTime())) return null;
  const title = tagText(itemXml, 'title') ?? '';
  const size = Number(enclosure.length);
  const notes = parseNotes(tagText(itemXml, 'description'));
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
    ...notes,
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

const GUID_DAY = /(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Jour du brief. Pris dans le guid (brief-matin-AAAA-MM-JJ) plutôt que dans
 * la date de publication, qui est en UTC et dépend de l'heure du run.
 */
export function episodeDay(episode: Pick<Episode, 'guid' | 'pubDate'>): Date {
  const m = episode.guid.match(GUID_DAY);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(episode.pubDate);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Durée totale annoncée par le flux, null si une piste ne la donne pas. */
export function episodeDuration(episode: Episode): number | null {
  let total = 0;
  for (const t of episode.tracks) {
    if (t.durationSec === null) return null;
    total += t.durationSec;
  }
  return total;
}

export async function fetchEpisodes(feedUrl: string): Promise<Episode[]> {
  // GitHub Pages met le flux en cache 10 min : sans ce paramètre, l'app
  // ouverte juste après la publication peut recevoir la version de la veille.
  // Pas d'en-tête Cache-Control : dans un navigateur, il impose une requête
  // OPTIONS préalable, que GitHub Pages refuse (405), et l'aperçu web
  // n'aurait plus de flux.
  const url = `${feedUrl}${feedUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Flux indisponible (HTTP ${response.status})`);
  }
  return parseFeed(await response.text());
}
