// Réglages choisis par l'utilisateur, gardés d'un lancement à l'autre.
// Le réveil réellement programmé dans iOS est suivi à part, par alarm.ts.
import { DEFAULT_ALARM, DEFAULT_DISPLAY, DEFAULT_PLAYBACK } from '../constants';
import type { AlarmSchedule } from './schedule';
import { DEFAULT_SKIN, type SkinName, isSkinName } from './skins';
import { readJson, writeJson } from './storage';

export type Settings = {
  alarm: AlarmSchedule;
  /** Bienvenue terminé : l'app s'ouvre ensuite sur l'Accueil. */
  onboarded: boolean;
  autoplayAfterAlarm: boolean;
  /** Stocké, sans effet tant que le téléchargement de nuit n'existe pas. */
  downloadOnCellular: boolean;
  /** Carte, spectre et globe en mouvement ; « Réduire les animations » d'iOS l'emporte. */
  animations: boolean;
  skin: SkinName;
};

const SETTINGS_KEY = 'settings';

export function loadSettings(): Settings {
  const saved = readJson<Partial<Settings>>(SETTINGS_KEY) ?? {};
  const settings = { alarm: DEFAULT_ALARM, onboarded: false, ...DEFAULT_PLAYBACK, ...DEFAULT_DISPLAY, skin: DEFAULT_SKIN, ...saved };
  return isSkinName(settings.skin) ? settings : { ...settings, skin: DEFAULT_SKIN };
}

export function saveSettings(settings: Settings): void {
  writeJson(SETTINGS_KEY, settings);
}
