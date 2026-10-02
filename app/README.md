# Lora — application iOS (squelette technique)

Ce dossier remplace, à terme, le montage Pocket Casts + raccourci +
automatisation. Le pipeline de la nuit ne change pas : l'app lit le flux
`https://iceman-ux.github.io/brief-matin/feed.xml`.

Cette version valide la technique, pas le visuel : un seul écran de test,
sans les maquettes.

## Ce que fait le squelette

- **Alarme** : une vraie alarme iOS (AlarmKit, iOS 26.1 au minimum), qui
  sonne avec le sonal de Lora même si l'app est fermée ou le téléphone en
  silencieux. Réglage de l'heure et des jours, bouton « Programmer », bouton
  « Tester dans 1 min ».
- **Lancement du brief** : le bouton d'arrêt de l'alarme ouvre l'app, qui
  lance l'épisode du jour tout de suite.
- **Épisode** : à chaque ouverture, l'app lit le flux, prend l'épisode le
  plus récent et le télécharge dans le cache (les deux derniers sont
  gardés). Tant qu'il n'est pas téléchargé, il est lu en direct, en Wi-Fi
  comme en 4G/5G. Si le flux ne répond pas, l'app relit le dernier épisode
  connu.
- **Lecture** en arrière-plan et écran verrouillé.
- **Ligne d'état** : App Group, autorisation, alarmes, épisode en cache ou
  non, erreur de flux.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `constants.js` | Tous les réglages : identifiant de l'app, App Group, adresse du flux, son d'alarme, réveil par défaut |
| `app.config.ts` | Configuration Expo, construite à partir de `constants.js` |
| `plugins/with-lora-alarm.js` | Réglages natifs d'AlarmKit, à la place de Xcode : clé Info.plist, App Group, sonal |
| `src/episodes.ts` | Lecture du flux ; un épisode est une **liste de pistes** |
| `src/library.ts` | Cache des mp3, dernier épisode connu |
| `src/alarm.ts` | Programmation des alarmes, détection du lancement par l'alarme |
| `App.tsx` | L'écran de test |
| `eas.json` | Profils de compilation dans le cloud |
| `tests/` | Tests du parseur (sur une copie du flux du 02/10) et du sonal |

Le sonal n'est pas recopié dans ce dossier : le plugin le prend dans
`assets/brand/sonal.wav` à chaque compilation et vérifie qu'iOS l'acceptera
(WAV PCM, moins de 30 s ; il fait 3,29 s). Si le sonal change, l'app suit.

## Quand les comptes seront prêts

Il faut un compte **Apple Developer** (99 $/an, au nom d'Adam) et un compte
**Expo** (gratuit). Ensuite, dans un terminal, dans le dossier `app/` :

```bash
npm install                      # une fois, puis après chaque mise à jour du dépôt
npx eas-cli@latest login         # tape toi-même ton mot de passe Expo
npx eas-cli@latest init          # relie le projet à ton compte Expo (une fois)
npx eas-cli@latest device:create # enregistre ton iPhone : ouvre le lien sur l'iPhone
npx eas-cli@latest build --profile development --platform ios
```

La compilation demande la connexion au compte Apple ; EAS crée lui-même les
certificats, l'App Group et le profil de provisionnement. Aucun mot de passe
ni jeton ne doit être écrit dans le dépôt.

À la fin, EAS donne un lien ou un QR code : on l'ouvre sur l'iPhone pour
installer l'app. Avec le profil `development`, l'app attend un serveur de
développement : `npm start` sur le PC, iPhone sur le même Wi-Fi.

Plus tard :

- `--profile preview` : app autonome, installée par lien, sans serveur ;
- `--profile production` puis `npx eas-cli@latest submit -p ios` :
  TestFlight.

## Tester sur l'iPhone

1. « Tester dans 1 min », accepter l'autorisation, verrouiller le téléphone.
2. L'alarme doit sonner avec le sonal (pas le son par défaut).
3. L'arrêter : l'app s'ouvre (après déverrouillage) et lit l'épisode.
4. Recommencer app fermée (balayée), puis app en arrière-plan.
5. Couper le Wi-Fi, vider l'app, relancer : lecture en direct en 4G.

## Vérifications sans Mac

```bash
npm test               # parseur du flux, sonal
npx tsc --noEmit       # types
npx expo-doctor        # dépendances et configuration
```

`npx expo prebuild --platform ios` refuse de tourner sous Windows ; la
vérification du projet natif a été faite en contournant cette garde, voir
le rapport du 02/10. Sur EAS, le prebuild tourne sur un Mac, sans souci.

## Ce qui reste à faire

- Confirmer l'identifiant `app.lora.brief` : il ne change plus après la
  première publication.
- Tous les tests sur un vrai iPhone (liste ci-dessus).
- Les écrans des maquettes : onboarding, accueil, lecture, réglages.
- Télécharger l'épisode la nuit, sans ouvrir l'app.
- Segments par rubrique dans le flux et choix des rubriques dans l'app.
- Contrôles sur l'écran verrouillé (titre, pochette, pause).
