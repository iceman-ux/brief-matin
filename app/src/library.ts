// Épisodes sur le téléphone : fichiers mp3 en cache et dernier épisode connu.
// Le dernier épisode est gardé pour que l'alarme lance quand même quelque
// chose si le flux ne répond pas au réveil (pas de réseau, GitHub en panne).
import { Directory, File, Paths } from 'expo-file-system';

import { CACHE_KEEP_EPISODES } from '../constants';
import type { Episode, Track } from './episodes';

const episodesDir = new Directory(Paths.cache, 'episodes');
const lastEpisodeFile = new File(Paths.document, 'last-episode.json');
const PARTIAL_SUFFIX = '.part';

function fileFor(track: Track): File {
  const name = decodeURIComponent(track.url.split('?')[0].split('/').pop() || 'episode.mp3');
  return new File(episodesDir, name);
}

function isComplete(file: File, track: Track): boolean {
  return file.exists && file.size > 0 && (track.sizeBytes === null || file.size === track.sizeBytes);
}

export function cachedUri(track: Track): string | null {
  const file = fileFor(track);
  return isComplete(file, track) ? file.uri : null;
}

/** Ce que le lecteur doit jouer : le fichier local s'il est complet, l'URL sinon. */
export function playableSources(episode: Episode): { uri: string; name: string }[] {
  return episode.tracks.map((t) => ({ uri: cachedUri(t) ?? t.url, name: t.title }));
}

export function isEpisodeCached(episode: Episode): boolean {
  return episode.tracks.every((t) => cachedUri(t) !== null);
}

/**
 * Télécharge les pistes manquantes. L'URL des Releases GitHub répond par une
 * redirection 302 vers le stockage de GitHub : URLSession la suit seul. On
 * écrit dans un fichier « .part » renommé à la fin, pour qu'un téléchargement
 * coupé ne soit jamais pris pour un épisode complet.
 */
export async function downloadEpisode(episode: Episode): Promise<void> {
  episodesDir.create({ intermediates: true, idempotent: true });
  for (const track of episode.tracks) {
    const target = fileFor(track);
    if (isComplete(target, track)) continue;
    const partial = new File(episodesDir, target.name + PARTIAL_SUFFIX);
    if (partial.exists) partial.delete();
    await File.downloadFileAsync(track.url, partial, { idempotent: true });
    if (!isComplete(partial, track)) {
      partial.delete();
      throw new Error(`Téléchargement incomplet : ${target.name}`);
    }
    if (target.exists) target.delete();
    partial.move(target);
  }
  prune();
}

/** Garde les épisodes les plus récents, supprime le reste et les restes de téléchargements coupés. */
function prune(): void {
  const files = episodesDir.list().filter((f): f is File => f instanceof File);
  for (const f of files.filter((f) => f.name.endsWith(PARTIAL_SUFFIX))) f.delete();
  const complete = files
    .filter((f) => !f.name.endsWith(PARTIAL_SUFFIX))
    .sort((a, b) => (b.modificationTime ?? 0) - (a.modificationTime ?? 0));
  for (const f of complete.slice(CACHE_KEEP_EPISODES)) f.delete();
}

export function saveLastEpisode(episode: Episode): void {
  lastEpisodeFile.write(JSON.stringify(episode));
}

export function loadLastEpisode(): Episode | null {
  if (!lastEpisodeFile.exists) return null;
  try {
    const raw = JSON.parse(lastEpisodeFile.textSync());
    return { ...raw, pubDate: new Date(raw.pubDate) };
  } catch {
    return null;
  }
}
