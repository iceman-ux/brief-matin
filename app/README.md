# Lora — application iOS

Ce dossier remplace, à terme, le montage Pocket Casts + raccourci +
automatisation. Le pipeline de la nuit ne change pas : l'app lit le flux
`https://iceman-ux.github.io/brief-matin/feed.xml`.

Quatre écrans, d'après les maquettes validées : Bienvenue (premier
lancement seulement), Accueil, Lecture, Réglages. On peut les voir et les
manipuler dans un navigateur, sans iPhone ni compte Apple.

## Voir l'app dans le navigateur

Sous Windows, dans PowerShell. La première fois, compter quelques minutes
pour l'installation.

1. Aller dans le dépôt et prendre la branche de l'app :
   ```powershell
   cd C:\FINANCE\brief-matin
   git checkout app
   git pull
   ```
2. Entrer dans le dossier de l'app :
   ```powershell
   cd app
   ```
3. Installer les dépendances (la première fois, puis après chaque
   `git pull` qui touche `package.json`) :
   ```powershell
   npm.cmd install
   ```
4. Lancer l'aperçu :
   ```powershell
   npx.cmd expo start --web
   ```
   Après une dizaine de secondes, le navigateur s'ouvre tout seul sur
   `http://localhost:8081`. S'il ne s'ouvre pas, taper `w` dans PowerShell,
   ou ouvrir cette adresse à la main.

**Ce qui doit s'afficher** : l'écran Bienvenue (soleil, « Lora », heure et
jours). « Activer mon réveil » mène à l'Accueil, avec le vrai épisode du
jour tiré du flux ; « Écouter Lora » le joue pour de vrai. Pour voir l'app
à la taille d'un iPhone : F12, puis l'icône téléphone (Ctrl+Maj+M), et
choisir un iPhone.

- **L'alarme est simulée** dans le navigateur (mention « Aperçu web » en
  bas des écrans) : rien ne sonne, l'heure et les jours sont seulement
  enregistrés.
- **Revoir Bienvenue** : les réglages sont gardés dans le navigateur. F12 →
  Application → Local Storage → `http://localhost:8081` → supprimer les
  clés `lora:…`, puis recharger la page.
- **Une modification du code** se voit tout de suite, sans relancer.

**Arrêter** : Ctrl+C dans PowerShell (répondre `O` si Windows demande de
terminer le traitement), puis fermer l'onglet. Pour revenir au pipeline :
`cd ..` puis `git checkout main`.

## Ce que fait l'app

- **Alarme** : une vraie alarme iOS (AlarmKit, iOS 26.1 au minimum), qui
  sonne avec le sonal de Lora même si l'app est fermée ou le téléphone en
  silencieux. Heure par pas de 15 min et jours, choisis dans Bienvenue puis
  dans Réglages (l'alarme est reprogrammée à chaque changement). Accès
  caché à l'alarme de test : appui long sur « Lora », en bas des Réglages.
- **Lancement du brief** : le bouton d'arrêt de l'alarme ouvre l'app, qui
  lance l'épisode du jour tout de suite (réglage « Lancer Lora après
  l'alarme »).
- **Accroche et sommaire** : tirés de la description de chaque épisode du
  flux. L'accroche est le premier titre du jour ; le sommaire, les lignes
  « Au sommaire ».
- **Épisode** : à chaque ouverture, l'app lit le flux, prend l'épisode le
  plus récent et le télécharge dans le cache (les deux derniers sont
  gardés). Tant qu'il n'est pas téléchargé, il est lu en direct, en Wi-Fi
  comme en 4G/5G. Si le flux ne répond pas, l'app relit le dernier épisode
  connu.
- **Lecture** en arrière-plan et écran verrouillé.
- **Réglages gardés** d'un lancement à l'autre (fichiers JSON sur
  l'iPhone, localStorage dans le navigateur). « Télécharger en 4G / 5G »
  est enregistré mais sans effet pour l'instant.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `constants.js` | Tous les réglages : identifiant de l'app, App Group, adresse du flux, son d'alarme, réveil par défaut, pas de l'heure, mention IA |
| `app.config.ts` | Configuration Expo, construite à partir de `constants.js` |
| `plugins/with-lora-alarm.js` | Réglages natifs d'AlarmKit, à la place de Xcode : clé Info.plist, App Group, sonal |
| `src/theme.ts` | **Toute l'apparence** : couleurs, polices, tailles, espacements, arrondis |
| `src/Illustration.tsx` | L'illustration (soleil Art déco), seul fichier à remplacer pour en changer |
| `src/screens/` | Les quatre écrans ; aucune couleur ni police en dur |
| `src/ui.tsx`, `src/icons.tsx` | Éléments communs (boutons, heure, jours) et icônes |
| `src/episodes.ts` | Lecture du flux ; un épisode est une **liste de pistes** |
| `src/schedule.ts` | Prochain réveil, libellés de jours et de durées en français |
| `src/settings.ts`, `src/storage.ts` | Réglages gardés entre deux lancements |
| `src/library.ts` | Cache des mp3, dernier épisode connu |
| `src/alarm.ts` | Programmation des alarmes, détection du lancement par l'alarme |
| `*.web.ts` | Remplaçants pour le navigateur : alarme simulée, pas de cache, localStorage |
| `App.tsx` | Navigation entre les écrans, lecteur, flux |
| `eas.json` | Profils de compilation dans le cloud |
| `tests/` | Tests du parseur (sur une copie du flux du 02/10), du prochain réveil et du sonal |

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

1. Appui long sur « Lora » en bas des Réglages (alarme de test dans 1 min),
   accepter l'autorisation, verrouiller le téléphone.
2. L'alarme doit sonner avec le sonal (pas le son par défaut).
3. L'arrêter : l'app s'ouvre (après déverrouillage) et lit l'épisode.
4. Recommencer app fermée (balayée), puis app en arrière-plan.
5. Couper le Wi-Fi, vider l'app, relancer : lecture en direct en 4G.

## Vérifications sans Mac

```bash
npm test                          # parseur du flux, prochain réveil, sonal
npx tsc --noEmit                  # types
npx expo-doctor                   # dépendances et configuration
npx expo export --platform web    # l'aperçu web se construit
```

`npx expo prebuild --platform ios` refuse de tourner sous Windows ; la
vérification du projet natif a été faite en contournant cette garde, voir
le rapport du 02/10. Sur EAS, le prebuild tourne sur un Mac, sans souci.

## Ce qui reste à faire

- Confirmer l'identifiant `app.lora.brief` : il ne change plus après la
  première publication.
- Tous les tests sur un vrai iPhone (liste ci-dessus).
- Télécharger l'épisode la nuit, sans ouvrir l'app.
- Segments par rubrique dans le flux et choix des rubriques dans l'app.
- Contrôles sur l'écran verrouillé (titre, pochette, pause).
