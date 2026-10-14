// Réglages de l'aperçu web, lus dans l'adresse de la page (preview.web.ts).
// Sur iPhone, rien de tout ça n'existe : ni démonstration, ni écran forcé.
import type { Episode } from './episodes';
import type { SkinName } from './skins/types';

export type PreviewScreen = 'welcome' | 'wake' | 'home' | 'player' | 'settings';

export type Preview = {
  /** Jeu de démonstration, à la place du flux. */
  demo: Episode | null;
  screen: PreviewScreen | null;
  skin: SkinName | null;
  /** Fiche zone ouverte sur ce sujet (0, 1…). */
  sheet: number | null;
  /** Sujet choisi sur l'Accueil. */
  topic: number | null;
  /** Lance la lecture à cette position, en secondes. */
  playAt: number | null;
};

export const PREVIEW: Preview = { demo: null, screen: null, skin: null, sheet: null, topic: null, playAt: null };
