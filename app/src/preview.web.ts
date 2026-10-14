// Aperçu web : l'adresse de la page choisit l'écran, le skin et le jeu de
// démonstration, pour regarder chaque état sans le provoquer à la main.
//   ?demo=1               jeu de démonstration (src/demo.ts)
//   ?ecran=reveil         bienvenue | reveil | accueil | lecteur | reglages
//   ?skin=casio           chrome | casio | ambre | papier
//   ?sujet=2              sujet choisi sur l'Accueil (1, 2…)
//   ?fiche=2              fiche zone ouverte sur ce sujet
//   ?lecture=58           lance la lecture à 58 s
import { DEMO_EPISODE } from './demo';
import type { Preview, PreviewScreen } from './preview';
import { isSkinName } from './skins';

export type { Preview, PreviewScreen };

const SCREENS: Record<string, PreviewScreen> = {
  bienvenue: 'welcome',
  reveil: 'wake',
  accueil: 'home',
  lecteur: 'player',
  reglages: 'settings',
};

function read(): Preview {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const index = (name: string) => {
    const n = Number(params.get(name));
    return Number.isInteger(n) && n >= 1 ? n - 1 : null;
  };
  const playAt = Number(params.get('lecture'));
  const skin = params.get('skin');
  return {
    demo: params.get('demo') === '1' ? DEMO_EPISODE : null,
    screen: SCREENS[params.get('ecran') ?? ''] ?? null,
    skin: isSkinName(skin) ? skin : null,
    sheet: index('fiche'),
    topic: index('sujet'),
    playAt: params.has('lecture') && Number.isFinite(playAt) && playAt >= 0 ? playAt : null,
  };
}

export const PREVIEW: Preview = read();
