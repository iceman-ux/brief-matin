// Aperçu web : pas de cache de mp3, le navigateur lit l'épisode en direct
// depuis la Release. Le dernier épisode connu reste gardé, comme sur iPhone.
import type { Episode } from './episodes';
import { readJson, writeJson } from './storage';

const LAST_EPISODE_KEY = 'last-episode';

export function playableSources(episode: Episode): { uri: string; name: string }[] {
  return episode.tracks.map((t) => ({ uri: t.url, name: t.title }));
}

export function isEpisodeCached(_episode: Episode): boolean {
  return false;
}

export async function downloadEpisode(_episode: Episode): Promise<void> {}

export function saveLastEpisode(episode: Episode): void {
  writeJson(LAST_EPISODE_KEY, episode);
}

export function loadLastEpisode(): Episode | null {
  const raw = readJson<Omit<Episode, 'hook' | 'topics'> & Partial<Episode>>(LAST_EPISODE_KEY);
  return raw && { hook: null, topics: [], ...raw, pubDate: new Date(raw.pubDate) };
}
