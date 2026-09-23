# Brief Matin — avancement

## État au 23/09/2026

Le pipeline tourne en production. Le repo GitHub existe, GitHub Pages sert le
flux, et le workflow tourne chaque nuit sur trois créneaux de cron (4 h 30,
5 h 30 et 6 h 30 heure de Paris l'été) pour compenser les runs planifiés que
GitHub abandonne. Une garde d'idempotence dans `cmd_run` arrête les créneaux
suivants dès qu'un épisode du jour est publié. **Premier brief automatique :
23/09.**

**En cours : protocole d'écoute** pour régler les voix. Le verdict à date est
que le rendu est trop robotique. Les essais sont dans `tests/`, et la commande
`say` resynthétise un script existant pour comparer à texte constant.

## À faire

### Protocole d'écoute (en cours)

- [ ] `03` — revenir à une voix expressive (Marc sur `Puck`), comparer au `02`
- [ ] `04` — consigne `direction` plus courte et plus concrète
- [ ] `05` — casser la régularité du texte à la main dans `data/scripts/`
- [ ] `06` — `max_words_per_chunk: 150`, écouter les jointures
- [ ] Relancer `tools/analyse_voix.py` et vérifier si `derive_demitons` baisse
- [ ] **Trancher** : agréable à écouter au réveil, oui ou non
- [ ] Réintégrer trim_silence et la lecture de audio.chunk_gap_ms après le
      test à l'aveugle (perdus, jamais committés).
- [ ] Activer la facturation Gemini au plus tard avant la phase 2.

### Écoute quotidienne

- [ ] Ajouter le flux dans Pocket Casts, activer le téléchargement auto
- [ ] Créer l'automatisation Raccourcis iOS (déclencheur Alarme → arrêtée)

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
  qu'au moins un des trois créneaux aboutit chaque nuit, et que les suivants
  s'arrêtent bien sur « déjà publié ».
- **Sujets « France » faibles.** Deux causes identifiées : peu de sources
  généralistes (corrigé, Le Figaro et 20 Minutes ajoutés) et surtout le
  plafond de `_articles_block` qui ne transmettait que 60 articles sur 292,
  triés par nombre de reprises — donc les sujets internationaux. Passé à 120.
- **Slugs de mémoire trop précis.** Vérifier que `data/covered.json` contient
  `budget-2027` et non `budget-2027-vote-mardi`, sinon l'anti-répétition ne
  sert à rien.
- **503 et 429 du free tier Gemini** aux heures de pointe américaines. Les
  créneaux de nuit (2 h 30 à 4 h 30 UTC) les évitent en principe. Si ça arrive
  quand même, activer la facturation pour la priorité de file.
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
  GitHub abandonne des runs planifiés depuis fin août 2026.
