// Réglages choisis par l'utilisateur, gardés d'un lancement à l'autre.
// Le réveil réellement programmé dans iOS est suivi à part, par alarm.ts.
import { DEFAULT_ALARM, DEFAULT_PLAYBACK } from '../constants';
import type { AlarmSchedule } from './schedule';
import { readJson, writeJson } from './storage';

export type Settings = {
  alarm: AlarmSchedule;
  /** Bienvenue terminé : l'app s'ouvre ensuite sur l'Accueil. */
  onboarded: boolean;
  autoplayAfterAlarm: boolean;
  /** Stocké, sans effet tant que le téléchargement de nuit n'existe pas. */
  downloadOnCellular: boolean;
};

const SETTINGS_KEY = 'settings';

export function loadSettings(): Settings {
  const saved = readJson<Partial<Settings>>(SETTINGS_KEY) ?? {};
  return { alarm: DEFAULT_ALARM, onboarded: false, ...DEFAULT_PLAYBACK, ...saved };
}

export function saveSettings(settings: Settings): void {
  writeJson(SETTINGS_KEY, settings);
}
