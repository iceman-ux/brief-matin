// Aperçu web : pas de cache de mp3, le navigateur lit l'épisode en direct
// depuis la Release. Le dernier épisode connu reste gardé, comme sur iPhone.
import type { Episode } from './episodes';
import { readJson, writeJson } from './storage';
import { readTopics } from './topics';

const LAST_EPISODE_KEY = 'last-episode';

export function playableSources(episode: Episode): { uri: string; name: string }[] {
  return episode.tracks.map((t) => ({ uri: t.url, name: t.title }));
}

export function isEpisodeCached(_episode: Episode): boolean {
  return false;
}

export async function mayDownload(_allowCellular: boolean): Promise<boolean> {
  return false;
}

export async function downloadEpisode(_episode: Episode): Promise<void> {}

export function saveLastEpisode(episode: Episode): void {
  writeJson(LAST_EPISODE_KEY, episode);
}

export function loadLastEpisode(): Episode | null {
  const raw = readJson<Omit<Episode, 'hook' | 'topics'> & Partial<Episode>>(LAST_EPISODE_KEY);
  // Les versions précédentes gardaient les sujets comme de simples titres.
  return raw && { hook: null, ...raw, topics: readTopics(raw.topics), pubDate: new Date(raw.pubDate) };
}
