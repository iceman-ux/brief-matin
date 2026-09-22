# Brief Matin — avancement

## État au 22/09/2026

Le pipeline tourne de bout en bout : agrégation, rédaction, TTS, flux, mémoire.
Trois briefs audio réels produits. 15/15 flux RSS opérationnels. Le repo GitHub
n'existe pas encore, donc rien n'est publié en ligne.

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

### Avant le premier push

- [ ] Décider du sort des mp3 dans Git — voir « Dette » plus bas
- [ ] `git init`, repo GitHub public, premier push
- [ ] Settings → Pages → branche `main`, dossier `/docs`
- [ ] Settings → Secrets → `GEMINI_API_KEY`
- [ ] Déclencher le workflow à la main (onglet Actions) et vérifier le résultat

### Écoute quotidienne

- [ ] Ajouter le flux dans Pocket Casts, activer le téléchargement auto
- [ ] Créer l'automatisation Raccourcis iOS (déclencheur Alarme → arrêtée)

## Dette assumée

**Les mp3 dans Git.** La rétention à 30 jours nettoie le répertoire de travail,
pas l'historique. À 64 kbps, un épisode pèse ~1 Mo, soit **~365 Mo par an
accumulés définitivement**. GitHub commence à râler vers 1 Go : environ deux
ans et demi de marge. Trois issues :

- baisser `audio.bitrate` à `"40k"` — transparent pour de la parole à 24 kHz,
  ramène à ~230 Mo/an ; non appliqué pour ne pas ajouter une variable au
  protocole d'écoute en cours ;
- héberger les mp3 sur Cloudflare R2 (10 Go gratuits, pas de frais de sortie)
  et ne garder que `feed.xml` dans le repo ;
- ne rien faire et réécrire l'historique dans deux ans.

**Le mode batch TTS n'est pas implémenté.** `models.tts_batch` existe dans la
config mais ne change rien : `_synth_pcm` appelle `generate_content` en
synchrone. Le flag émet un avertissement s'il est activé. L'implémenter
diviserait la facture TTS par deux.

## À surveiller les premières semaines

- **Sujets « France » faibles.** Deux causes identifiées : peu de sources
  généralistes (corrigé, Le Figaro et 20 Minutes ajoutés) et surtout le
  plafond de `_articles_block` qui ne transmettait que 60 articles sur 292,
  triés par nombre de reprises — donc les sujets internationaux. Passé à 120.
- **Slugs de mémoire trop précis.** Vérifier que `data/covered.json` contient
  `budget-2027` et non `budget-2027-vote-mardi`, sinon l'anti-répétition ne
  sert à rien.
- **503 et 429 du free tier Gemini** aux heures de pointe américaines. Le cron
  à 4 h 30 UTC les évite en principe. Si ça arrive quand même, activer la
  facturation pour la priorité de file.
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
