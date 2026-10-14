// Jeu de démonstration de l'aperçu web (?demo=1) : le vrai brief du 11/10,
// enrichi des données que le pipeline ne donne pas encore. Les titres, les
// sources et l'audio sont réels ; les lieux, les débuts et les courbes sont
// posés à la main pour voir les écrans complets. Jamais chargé sur iPhone :
// seul preview.web.ts l'importe, et l'écran affiche « Données de
// démonstration ».
import type { Episode } from './episodes';

const TITLE_1 = 'Trump réclame un nouveau président ukrainien';

export const DEMO_EPISODE: Episode = {
  guid: 'brief-matin-2026-10-11',
  title: `11/10 — ${TITLE_1}`,
  pubDate: new Date('2026-10-11T02:06:16Z'),
  tracks: [
    {
      url: 'https://github.com/iceman-ux/brief-matin/releases/download/episodes/brief-2026-10-11.mp3',
      title: `11/10 — ${TITLE_1}`,
      durationSec: 184,
      sizeBytes: 2214079,
    },
  ],
  hook: TITLE_1,
  topics: [
    {
      title: TITLE_1,
      start: 12,
      place: { city: 'Kyiv', country: 'Ukraine', lat: 50.45, lon: 30.52, tz: 'Europe/Kyiv' },
      sources: ['Le Monde', 'franceinfo'],
      trend7d: [4, 6, 8, 14, 13, 24, 30, 36],
      related7d: 5,
    },
    {
      title: 'Aéroport de Riyad frappé par un missile',
      start: 58,
      place: { city: 'Riyad', country: 'Arabie saoudite', lat: 24.71, lon: 46.68, tz: 'Asia/Riyadh' },
      sources: ['Le Monde', 'France 24', 'RFI'],
      trend7d: [2, 2, 3, 4, 6, 14, 32, 40],
      related7d: 2,
    },
    {
      title: 'Répression massive de la jeunesse à Delhi',
      start: 101,
      place: { city: 'New Delhi', country: 'Inde', lat: 28.61, lon: 77.21, tz: 'Asia/Kolkata' },
      sources: ['Le Monde', 'The Guardian', 'France 24'],
      trend7d: [14, 18, 16, 22, 20, 26, 24, 30],
      related7d: 3,
    },
    {
      title: 'Lycéen blessé à Lens : versions opposées',
      start: 140,
      place: { city: 'Lens', country: 'France', lat: 50.43, lon: 2.83, tz: 'Europe/Paris' },
      sources: ['Le Monde', 'franceinfo'],
      trend7d: [6, 8, 24, 34, 30, 22, 16, 12],
      related7d: 1,
    },
  ],
};
