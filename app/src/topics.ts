// Sujets d'un brief. Aujourd'hui le flux ne donne que les titres ; le reste
// (début dans l'audio, lieu, sources, présence dans la presse) viendra du
// pipeline. Règle : une donnée absente fait disparaître l'élément qui
// l'affiche, jamais de valeur inventée.
//
// Sans dépendance, testé par node --test.

export type Place = {
  city: string;
  country: string;
  lat: number;
  lon: number;
  /** Fuseau IANA (« Europe/Kyiv ») ; sans lui, pas d'heure locale. */
  tz?: string;
};

export type Topic = {
  title: string;
  /** Début du sujet dans l'audio, en secondes. */
  start?: number;
  place?: Place;
  /** Noms des médias. */
  sources?: string[];
  /** Présence dans la presse sur 7 jours, du plus ancien au plus récent. */
  trend7d?: number[];
  /** Sujets liés sur 7 jours. */
  related7d?: number;
};

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

function readPlace(raw: unknown): Place | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as Record<string, unknown>;
  if (!isText(p.city) || !isText(p.country) || !isNumber(p.lat) || !isNumber(p.lon)) return undefined;
  if (Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return undefined;
  return { city: p.city, country: p.country, lat: p.lat, lon: p.lon, ...(isText(p.tz) ? { tz: p.tz } : {}) };
}

/**
 * Un sujet tel que le donne le flux, ou le cache d'une version précédente de
 * l'app (un simple titre). Ce qui est mal formé est ignoré, champ par champ.
 */
export function readTopic(raw: unknown): Topic | null {
  if (isText(raw)) return { title: raw.trim() };
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isText(r.title)) return null;
  const topic: Topic = { title: r.title.trim() };
  if (isNumber(r.start) && r.start >= 0) topic.start = r.start;
  const place = readPlace(r.place);
  if (place) topic.place = place;
  if (Array.isArray(r.sources)) {
    const sources = r.sources.filter(isText);
    if (sources.length > 0) topic.sources = sources;
  }
  if (Array.isArray(r.trend7d) && r.trend7d.length >= 2 && r.trend7d.every(isNumber)) topic.trend7d = r.trend7d;
  if (isNumber(r.related7d) && r.related7d >= 0) topic.related7d = r.related7d;
  return topic;
}

export function readTopics(raw: unknown): Topic[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(readTopic).filter((t): t is Topic => t !== null);
}

/**
 * Les débuts ne servent que s'ils sont tous connus et dans l'ordre : sinon
 * la barre afficherait des repères faux.
 */
export function hasStarts(topics: Topic[]): boolean {
  if (topics.length === 0) return false;
  return topics.every((t, i) => t.start !== undefined && (i === 0 || t.start > (topics[i - 1].start as number)));
}

/** Sujet en cours à `seconds`, ou null avant le premier sujet ou sans débuts. */
export function topicAt(topics: Topic[], seconds: number): number | null {
  if (!hasStarts(topics)) return null;
  let index: number | null = null;
  topics.forEach((t, i) => {
    if ((t.start as number) <= seconds) index = i;
  });
  return index;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** « 01 », « 02 »… */
export const topicNumber = (index: number) => pad(index + 1);

/** Nom court du bouton de sujet : la ville, sinon « Sujet 1 ». */
export const topicShortName = (topic: Topic, index: number) => topic.place?.city ?? `Sujet ${index + 1}`;

/** « 50.45N 30.52E ». */
export function formatCoordinates(place: Place): string {
  const lat = `${Math.abs(place.lat).toFixed(2)}${place.lat >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(place.lon).toFixed(2)}${place.lon >= 0 ? 'E' : 'W'}`;
  return `${lat} ${lon}`;
}

/** Sens de la courbe de présence : comparaison du dernier jour au premier. */
export function trendDirection(trend: number[]): '▲' | '▼' | '=' {
  const delta = trend[trend.length - 1] - trend[0];
  return delta > 0 ? '▲' : delta < 0 ? '▼' : '=';
}

/** Décalage d'un fuseau avec l'UTC, en minutes, à l'instant donné. */
function zoneOffsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

function formatShift(minutes: number): string {
  if (minutes === 0) return 'même heure';
  const sign = minutes > 0 ? '+' : '−';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h} h${m ? ` ${pad(m)}` : ''}`;
}

/**
 * « 08:00 · +1 h » : heure du lieu et écart avec l'heure du téléphone. Null
 * sans fuseau, ou si le moteur JavaScript ne connaît pas ce fuseau.
 */
export function localTime(place: Place, now: Date): string | null {
  if (!place.tz) return null;
  try {
    const offset = zoneOffsetMinutes(place.tz, now);
    const local = new Date(now.getTime() + offset * 60_000);
    const time = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
    return `${time} · ${formatShift(offset + now.getTimezoneOffset())}`;
  } catch {
    return null;
  }
}
