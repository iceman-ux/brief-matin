// Réglages de l'app, lus à la fois par app.config.ts (au prebuild, dans Node)
// et par le code de l'app. En JavaScript simple pour que Node le charge sans
// compilation ; les types sont dans constants.d.ts.

// À confirmer par Adam avant la première compilation : il ne se change plus
// une fois l'app publiée sur TestFlight.
const BUNDLE_ID = 'app.lora.brief';

module.exports = {
  BUNDLE_ID,
  // Doit être identique dans l'entitlement et dans l'appel configure()
  // d'expo-alarm-kit, sinon l'état des alarmes n'est pas partagé.
  APP_GROUP: `group.${BUNDLE_ID}`,
  // expo-alarm-kit 0.1.11 déclare iOS 26.1 dans son podspec : une cible plus
  // basse fait échouer « pod install » sur EAS.
  IOS_DEPLOYMENT_TARGET: '26.1',
  FEED_URL: 'https://iceman-ux.github.io/brief-matin/feed.xml',
  // Nom du sonal dans le bundle, recopié depuis assets/brand/ au prebuild.
  ALARM_SOUND_FILE: 'lora-sonal.wav',
  ALARM_SOUND_SOURCE: '../assets/brand/sonal.wav',
  ALARM_TITLE: 'Lora',
  ALARM_USAGE_DESCRIPTION: 'Lora sonne à l’heure choisie puis lance le brief du jour.',
  // Repère l'alarme dans le payload de lancement, pour ne pas confondre avec
  // une alarme d'une version future (rappel, sieste…).
  ALARM_DISMISS_PAYLOAD: 'lora-brief',
  DEFAULT_ALARM: { hour: 7, minute: 0, weekdays: [2, 3, 4, 5, 6] },
  // Épisodes gardés en cache : celui du jour et la veille, au cas où le run
  // de la nuit aurait échoué.
  CACHE_KEEP_EPISODES: 2,
};
