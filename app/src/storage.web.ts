// Aperçu web : mêmes documents que sur le téléphone, dans le localStorage du
// navigateur. Il peut être absent (navigation privée) : l'app repart alors
// des réglages par défaut à chaque chargement, sans erreur.
const PREFIX = 'lora:';

export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {}
}

export function removeJson(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {}
}
