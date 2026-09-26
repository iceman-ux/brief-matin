# Lora (dépôt brief-matin) — avancement

## Diffusion — Spotify, depuis le 26/09/2026

- [x] Flux aux normes Spotify : propriétaire et auteur « Lora », adresse
      publique `lora.dailybrief@proton.me` (plus d'adresse perso), catégorie
      News › Daily News. mp3 à 96 kbps mono, 44,1 kHz. Rétention à la date
      (30 jours), mp3 supprimés de `docs/`.
- [x] Nouveau raccourci « Lora » (s'abonne dans Pocket Casts puis lance la
      lecture) et page d'installation en un geste, bonus « Lora au réveil »,
      autres applis repliées en bas.
- [x] mp3 hébergés dans la Release GitHub `episodes` (`audio.storage`),
      hors de l'historique Git ; repli sur `docs/episodes/` si l'envoi
      échoue ; commande `stats` pour les téléchargements.
- [ ] **Vérifier le 1er épisode servi par la Release dans Pocket Casts**
      (Adam).
- [ ] **Soumettre à Spotify for Creators** (Adam). Puis renseigner
      `onboarding.spotify_url` : le bouton Spotify apparaît tout seul.
- [ ] **Filmer la création de l'automatisation, 15 s** (Adam). La poser dans
      `docs/` et renseigner `onboarding.automation_video`.
- [ ] Tester « Copier » sur un vrai iPhone, dans le bloc replié : non
      vérifiable en navigateur headless.
- Apple Podcasts écarté : mention orale d'IA obligatoire dans chaque
  épisode, refusée par Adam.

## Lora — identité, depuis le 25/09/2026

- [x] Nom **Lora** affiché dans le flux, `index.html` et la page
      d'installation (`podcast.title`). Dépôt et adresse du flux inchangés.
- [x] Signatures fixes ajoutées par le code (`src/brand.py`, `brand` dans
      `config.yaml`) : date parlée, clin d'œil des jours fériés (fixes +
      Pâques, lundi de Pâques, Ascension, Pentecôte calculés), accroche du
      modèle vérifiée. Prompt, règle 12 réécrite.
- [x] **Ouverture choisie : I-marc-1** (« Ici Lora, il est l'heure. »,
      Marc), seule prise où « Lora » ne s'entend pas « l'aurore ». **Clôture
      choisie : C1-marc** (« C'était Lora. Belle journée. »). Figées dans
      `assets/brand/` le 25/09, à −17 LUFS (limiteur léger, choix d'Adam :
      −16 et TP ≤ −3 étaient incompatibles avec un simple gain). Jamais
      régénérées.
- [x] « Lora » ne passe plus jamais par le TTS : réplique variable
      « Et aujourd'hui, … » dite par Marc, garde-fou `strip_brand_name`.
- [x] Clôtures du lundi (« Belle semaine. », prise F-lundi-3) et du
      vendredi (« Bon week-end. », F-vendredi-1), montées sur le « C'était
      Lora. » de C1-marc. Autres prises et montages :
      `tests/ident/ecoute-5.html`.
- [ ] **Écouter `tests/episode-lora.mp3`** (épisode d'essai du 26/09,
      non publié). Le commit des signatures est poussé depuis le 25/09.
- [ ] Surveiller les premiers briefs Lora : avertissements « accroche »,
      « retiré du script » ou « Lora » dans les logs Actions.
- [x] **Sonal** composé par Adam, préparé le 26/09 dans
      `assets/brand/sonal.wav` (mono 24 kHz, 3,29 s, −18,6 LUFS, TP −3,0 :
      −17 LUFS aurait exigé un limiteur). Chevauchement réglable,
      `brand.sonal_overlap_ms`.
- [x] **Choisir A ou B** : B retenu le 26/09 (la voix entre à 2,28 s,
      `brand.sonal_overlap_ms: 1010`), −18,6 LUFS sans limiteur.
- [x] **Sonal en production** le 26/09 : `brand.sonal_file` renseigné,
      repli sans sonal (⚠⚠) si le fichier manque ou est illisible.
- [ ] **Écouter le 1er épisode avec sonal** (Adam) : la voix gêne-t-elle
      la queue du sonal ? Sinon, 790 ou 490 dans `sonal_overlap_ms`.
- [ ] Relire `data/fidelite/` après une semaine : faux positifs,
      corrections utiles ?
- [x] Raccourci renommé « Lora » et repartagé le 25/09 :
      `onboarding.shortcut_name` et `shortcut_url` à jour, page
      d'installation régénérée.
- [x] **Réflexion du rédacteur** : clé `models.writer_thinking`
      (`thinking_level`, transmise aux replis, rappel sans elle si un modèle
      la refuse). Essais du 25/09 pour le 26/09 : `low` ne réfléchit plus du
      tout (452 mots, alternance Marc/Léa sur les 15 répliques), `medium`
      (8 942 tokens) garde 7 répliques en alternance. Seule la réflexion par
      défaut (~21 000 tokens) respecte les règles de dialogue : **gardée,
      choix d'Adam**, ~0,10 $ de rédaction par épisode. Scripts dans
      `tests/reflexion/`.
- [x] Coût de la rédaction affiché par le run à côté de celui du TTS
      (`models.writer_prices`, tarif relevé le 25/09, à revérifier).
- [ ] Réessayer `medium` si la facture devient un sujet : un seul essai
      par niveau, sur une seule actualité, ne suffit pas à conclure.
- [x] Page d'installation dans la DA Lora (Art déco années 30, nocturne ;
      palette #0B0E2A, #1B2466, #F2A33A, #C9953C, #8E1426) le 25/09 :
      affiche, lecteur du dernier épisode, étapes à coins de laiton. Textes
      dans `onboarding` et `brand`, décor dans `docs/lora-scene.svg` et
      `docs/lora-rayons.svg`.
- [x] Cover Lora (`docs/lora-cover.jpg`, 3000 px) dans le flux le 25/09 ;
      l'ancienne `cover.png` est supprimée.

## État au 24/09/2026

Le pipeline tourne en production. Le repo GitHub existe, GitHub Pages sert le
flux, et le workflow tourne chaque nuit sur trois créneaux de cron (4 h 30,
5 h 30 et 6 h 30 heure de Paris l'été) pour compenser les runs planifiés que
GitHub abandonne, plus un quatrième à 8 h 10 UTC (10 h 10 à Paris l'été),
filet de sécurité après la remise à zéro du quota gratuit Gemini. Une garde d'idempotence dans `cmd_run` arrête les créneaux
suivants dès qu'un épisode du jour est publié. **Premier brief automatique :
23/09.** L'écoute quotidienne est en place depuis le 23/09 : flux dans Pocket
Casts avec téléchargement auto, automatisation Raccourcis sur l'arrêt de
l'alarme.

- [x] Raccourci « Brief Matin » partagé en lien iCloud le 24/09
      (`onboarding.shortcut_url`) : le bouton « Ajouter le raccourci » de
      `docs/installer.html` est actif.

**Voix de production : `gemini-3.8-flash-tts`, Kore/Puck, en un seul appel
TTS par brief, avec la finition audio** (compression 2:1, −16 LUFS), choisie
à l'aveugle le 24/09 au terme de deux tours. Le test de voix est clos. La
commande `say --out` resynthétise un script existant hors production, avec la
clé du projet de test.

## À faire

### Test de voix à l'aveugle — clos le 24/09

Deux tours, juges : Adam et deux amis, à l'aveugle, lettres tirées au hasard,
fichiers et clés dans `data/voice-test/` (ignoré par Git).

**Tour 1** (script du 23/09 entier, découpé en morceaux de 150 mots). Gagnant
net : `gemini-3.8-flash-tts`, devant `gemini-3.1-flash-tts-preview` (la
production d'alors) et `gemini-3.8-flash-lite-tts`. Passé en production le
jour même. Défauts entendus : ensemble monotone, et la voix qui change par
moments, attribuée au découpage (chaque morceau réinterprète les voix).

**Tour 2** (extrait : répliques 6 à 11 du 23/09, ~45 s, même finition pour
tous). **Z gagne à l'unanimité**, jugé « nettement plus pro » :
`gemini-3.8-flash-tts`, voix Kore/Puck, sans style, en un seul appel, avec la
finition commune. Perdants : X, voix sur mesure Gemini (Voice design) avec
les intentions de `tour2/annotations.json` ; Y, ElevenLabs v3 (Victoire +
Alexandre), fait à la main sur elevenlabs.io.

Enseignements : les changements de voix disparaissent en un seul appel ; la
finition contribue probablement à l'effet « pro » ; ElevenLabs ne justifie
pas son coût (~22 $/mois pour un brief quotidien, contre 1 à 2 $ avec Gemini).

Reste ouvert, sans urgence :

- [ ] Relancer `tools/analyse_voix.py` et vérifier si `derive_demitons` baisse
- [ ] Réintégrer trim_silence et la lecture de audio.chunk_gap_ms (perdus,
      jamais committés). Utile seulement si un brief repasse en plusieurs
      morceaux.
- Le chemin API ElevenLabs (`say --tts-provider elevenlabs`) n'a jamais été
  testé au-delà du 402 de l'offre gratuite. Gardé dans le code, non utilisé.

### Clés API

Les deux clés sont dans le **même projet** Google (`gen-lang-client-0612097558`),
contrairement à ce qu'indiquait la vérification cochée le 24/09 au matin.
Sans conséquence depuis le passage au palier payant : tests et production ne
se disputent plus un quota gratuit. Noms dans AI Studio :
`prod — brief de la nuit` (`GEMINI_API_KEY`) et `tests — PC`
(`GEMINI_API_KEY_TEST`).

## Dette assumée

**Les mp3 dans Git.** La rétention à 30 jours nettoie le répertoire de travail,
pas l'historique. Le débit est passé à 40 kbps : un épisode pèse ~1 Mo à
3 minutes, ~1,2 Mo à 4 minutes, soit **~350 à 450 Mo par an accumulés
définitivement** (à 64 kbps, les deux premiers épisodes pesaient 1,2 et
1,5 Mo). GitHub commence à râler vers 1 Go : environ deux ans de marge.
Deux issues restantes :

- héberger les mp3 sur Cloudflare R2 (10 Go gratuits, pas de frais de sortie)
  et ne garder que `feed.xml` dans le repo ;
- ne rien faire et réécrire l'historique le moment venu.

**Le mode batch TTS n'est pas implémenté.** `models.tts_batch` existe dans la
config mais ne change rien : `_synth_pcm` appelle `generate_content` en
synchrone. Le flag émet un avertissement s'il est activé. L'implémenter
diviserait la facture TTS par deux.

## À surveiller les premières semaines

- **Runs planifiés abandonnés par GitHub.** Vérifier dans l'onglet Actions
  qu'au moins un des quatre créneaux aboutit chaque jour, et que les suivants
  s'arrêtent bien sur « déjà publié ».
- **Sujets « France » faibles.** Deux causes identifiées : peu de sources
  généralistes (corrigé, Le Figaro et 20 Minutes ajoutés) et surtout le
  plafond de `_articles_block` qui ne transmettait que 60 articles sur 292,
  triés par nombre de reprises — donc les sujets internationaux. Passé à 120.
- **Slugs de mémoire trop précis.** Vérifier que `data/covered.json` contient
  `budget-2027` et non `budget-2027-vote-mardi`, sinon l'anti-répétition ne
  sert à rien.
- **Retards de GitHub sur les runs planifiés.** Le 24/09, les créneaux de nuit
  ont démarré avec environ cinq heures de retard (9 h 45, 10 h 37, 11 h 26 à
  Paris) et l'un d'eux n'a pas été lancé du tout. Si ça se répète, le brief
  n'est pas prêt au réveil : envisager un déclencheur externe.
- **Crédit Google Cloud de 257,47 €**, valable jusqu'à fin décembre 2026
  environ. Il ne couvre **pas** l'API Gemini, mais couvrirait Chirp 3 HD ou
  Cloud Storage. À utiliser avant son expiration ou à laisser filer.
- **Un seul appel TTS par brief** (`max_words_per_chunk: 900`). C'est ce
  qui a supprimé les changements de voix. Si un brief dépasse 900 mots, il
  sera découpé et les voix risquent de changer au raccord, sans compter les
  raccords non rabotés (trim_silence perdu) : surveiller la longueur des
  scripts (558 mots le 24/09, cible ~760).
- **Crêtes après finition** : loudnorm tient son plafond, mais le mp3 à
  40 kbps fait déborder les crêtes de 1,5 à 2,6 dB (mesuré le 24/09 sur A, B
  et C). Plafond passé de −1,5 à −3 dBFS : crêtes mp3 à −1,6, −1,6 et
  −0,6 dBFS. À 64 kbps, −2 suffirait (débordement sous 0,5 dB), mais les
  mp3 pèseraient ~60 % de plus.
- **Ne plus toucher au prompt** avant d'avoir trois ou quatre briefs sur des
  journées différentes. Celui du 22 septembre a été lu six fois : on l'a déjà
  sur-ajusté.

## Décisions prises

- Pas de récupération du texte intégral des articles : titres et chapôs
  seulement, pour des raisons de droits. Le prompt compense en interdisant les
  liens de causalité non sourcés.
- Dialogue à deux voix plutôt qu'une seule : même coût au token audio, bien
  moins monotone.
- Règles de dialogue en quotas chiffrés, pas en interdictions — le modèle
  ignorait les interdictions vagues. Mais un quota se satisfait à vide, d'où
  l'exigence de qualité ajoutée sur les relances.
- Le sport est une permission, pas un quota, et sans source dédiée : seul le
  sport qui perce dans l'actualité générale entre dans le brief.
- `words_per_minute: 190`, mesuré sur les voix Gemini et non repris d'une
  moyenne théorique de lecture.
- `data/scripts/` est versionné : sans lui, un brief raté sur GitHub Actions
  n'est pas débuggable après coup.
- `audio.bitrate: "40k"` : transparent pour de la parole mono à 24 kHz, et
  réduit d'un bon tiers le poids des mp3 accumulés dans l'historique Git.
- Trois créneaux de cron plutôt qu'un, protégés par une garde d'idempotence :
  GitHub abandonne des runs planifiés depuis fin août 2026. Un quatrième à
  8 h 10 UTC sert de filet après la remise à zéro du quota gratuit Gemini
  (minuit heure du Pacifique = 7 h UTC l'été, 8 h UTC l'hiver) : un quota
  épuisé la veille fait échouer les trois créneaux de nuit.
- Chemin TTS séparé pour les modèles `gemini-3.8-*` : API Interactions, une
  entrée annotée par réplique. Ces modèles lisent le texte mot pour mot, donc
  aucune consigne de direction dans le texte.
- `say --out` n'utilise que `GEMINI_API_KEY_TEST`, jamais la clé de
  production, et s'arrête si elle manque.
- **Production sur `gemini-3.8-flash-tts`, voix Kore/Puck, en un seul appel,
  avec finition** (compression 2:1 puis −16 LUFS, `finishing` dans
  `config.yaml`), choisie à l'aveugle le 24/09 au terme de deux tours. Voix
  sur mesure Gemini, intentions de jeu par réplique et ElevenLabs v3 ont été
  essayés et écartés ; leurs chemins restent dans le code, marqués « non
  utilisés en production » dans `config.yaml`.
- La finition fait partie du brief : si elle échoue, le run échoue et ne
  publie rien, pas de repli sur un audio non fini. `finishing.enabled: false`
  la coupe sans toucher au code.
- Voix sur mesure Gemini décrites en deux phrases de traits permanents,
  comme le recommande la doc : les réactions à l'info passent par
  `speech_metadata.style`, réplique par réplique. Elles expirent le
  24/09/2027.
- ElevenLabs par la bibliothèque standard (urllib), sans SDK, et
  seulement en essai via `say --out`.
- **Palier payant Gemini activé le 24/09.** Les quatre runs du matin ont
  échoué sur des 503 des deux modèles de rédaction, même après la remise à
  zéro du quota : l'offre gratuite était saturée. Garde-fous : prépaiement de
  25 € sans recharge automatique, plafond mensuel de 10 € dans AI Studio,
  alerte budgétaire Google Cloud à 10 € par mois (seuils 50, 90 et 100 %,
  sur le coût brut, crédits non déduits). Premier run payant réussi : le
  manuel du 24/09 à 13 h 02.
- Mention « généré par IA » dans le flux, en description du podcast et de
  chaque épisode (AI Act, article 50).
