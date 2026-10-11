// Petits documents JSON gardés sur le téléphone, un fichier par clé. Lecture
// synchrone : l'écran de départ (Bienvenue ou Accueil) est connu dès le
// premier rendu, sans clignotement.
import { File, Paths } from 'expo-file-system';

const fileFor = (key: string) => new File(Paths.document, `${key}.json`);

export function readJson<T>(key: string): T | null {
  const file = fileFor(key);
  if (!file.exists) return null;
  try {
    return JSON.parse(file.textSync()) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  fileFor(key).write(JSON.stringify(value));
}

export function removeJson(key: string): void {
  const file = fileFor(key);
  if (file.exists) file.delete();
}
