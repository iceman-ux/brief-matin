# Lora (dépôt brief-matin) — contexte projet

Brief d'actualité personnel généré chaque nuit, publié dans un flux podcast
privé sur GitHub Pages, lancé au réveil par une automatisation Raccourcis iOS.
Auditeur unique : le propriétaire du repo. Ce n'est pas un produit.

**Nom et identité : Lora**, depuis le 25/09/2026 (avant : « Brief Matin »,
qui reste le nom du dépôt). DA : Art déco des années 30, nocturne et
luxueuse ; palette #0B0E2A, #1B2466, #F2A33A, #C9953C, #8E1426.

**Signatures figées, enregistrées une fois pour toutes** dans `assets/brand/`
(WAV 24 kHz mono, −17 LUFS, true peak ≤ −3 dBFS) et montées par
`tts.frame` : ouverture « Ici Lora, il est l'heure. » (prise I-marc-1,
Marc) ; clôture « C'était Lora. Belle journée. » (prise C1-marc), « Belle
semaine. » le lundi et « Bon week-end. » le vendredi (montages sur le même
« C'était Lora. »). **Le nom « Lora » ne passe jamais par le TTS**, qui le
prononce mal une fois sur deux : `brand.strip_brand_name` retire toute
phrase qui le contient, et on ne régénère jamais ces prises. Entre les deux,
Marc dit une réplique variable posée par le code (`src/brand.py`) :
« Et aujourd'hui, samedi 26 septembre. » + clin d'œil d'un jour férié +
accroche du modèle (le fait directement, 20 mots au plus). Montage :
sonal → ouverture en chevauchement → 350 ms → corps → 1 s → clôture, un
seul encodage mp3. Sonal composé par Adam (`assets/brand/sonal.wav`, 3,29 s,
−18,6 LUFS sans limiteur ; source dans `assets/brand/sources/`,
`tools/preparer_sonal.py`), en production depuis le 26/09 en montage B :
l'ouverture entre dans sa queue à 2,28 s (`brand.sonal_overlap_ms: 1010`),
sans baisser la musique. Sonal manquant ou illisible : l'épisode sort sans,
avec un ⚠⚠. Pas de mention d'IA dans le texte parlé : elle reste
écrite, dans le flux et sur la page d'installation.

## Architecture

```
config.yaml          tous les réglages — le code ne doit contenir AUCUNE valeur en dur
prompts/brief_fr.md  ligne éditoriale du brief (règles d'écriture numérotées)
prompts/fidelite_fr.md, correction_fr.md  consignes du garde-fou de fidélité
src/config.py        chargement config + .env
src/sources.py       RSS : récupération parallèle, fenêtre temporelle, regroupement
src/memory.py        sujets déjà traités → data/covered.json
src/brand.py         réplique d'ouverture, fichiers de marque, jours fériés, garde « Lora »
src/writer.py        construction du prompt, appel LLM, garde-fous sur la sortie
src/fidelite.py      garde-fou de fidélité aux sources (reprises, faits inventés)
src/tts.py           synthèse vocale, découpage, finition, montage des signatures, mp3
src/feed.py          flux RSS podcast, page d'accueil, rétention des épisodes
src/release.py       hébergement des mp3 dans la Release GitHub, par la CLI gh
src/retry.py         réessais avec backoff exponentiel sur erreurs temporaires
src/main.py          orchestration + CLI
docs/                publié par GitHub Pages (feed.xml, index.html, installer.html,
                     episodes.json, cover et décor SVG de la page d'installation ;
                     episodes/ ne garde que les mp3 d'avant la Release et les replis)
assets/brand/        signatures enregistrées, figées (ouverture, clôtures du jour)
tools/analyse_voix.py  mesure audio pour le protocole d'écoute, hors pipeline
                       (numpy, scipy — hors requirements.txt, le run n'en a pas besoin)
tools/preparer_sonal.py  mise au format du sonal (mono, 24 kHz, gain fixe), idem
data/sources/        articles envoyés au rédacteur, par jour (rétention des épisodes)
data/fidelite/       trace du garde-fou, par épisode
tests/test_fidelite.py  tests du contrôle de reprise : py -m unittest tests.test_fidelite
```

Pipeline : RSS → dédoublonnage → mémoire → LLM → signatures → fidélité →
TTS → mp3 → Release → feed.xml.

## Commandes

```bash
python -m src.main run              # brief complet (s'arrête si déjà publié)
python -m src.main run --force      # regénère même si l'épisode du jour existe
python -m src.main run --dry-run    # aucun appel API payant, bruit de test au lieu de la voix
python -m src.main run --no-audio   # script seul, pour itérer sur le prompt
python -m src.main say [AAAA-MM-JJ] # resynthèse d'un script existant, sans LLM
python -m src.main check-feeds      # diagnostic des sources RSS
python -m src.main rebuild-feed     # régénère feed.xml depuis docs/episodes.json
python -m src.main stats            # téléchargements de chaque épisode de la Release
python -m src.main fidelite [AAAA-MM-JJ] [--fix]  # rejoue le garde-fou, clé de test
```

Sur Windows, utiliser `py` plutôt que `python`.

## Conventions

- **Commentaires et messages utilisateur en français.** Noms de variables et
  de fonctions en anglais.
- **Aucune valeur en dur dans le code.** Tout réglage va dans `config.yaml`,
  avec un commentaire qui explique son effet.
- Les commentaires expliquent **pourquoi**, jamais **quoi**. Un commentaire
  qui paraphrase la ligne suivante est à supprimer.
- Un run qui échoue ne publie rien : on préfère réécouter le brief de la
  veille qu'en diffuser un vide ou faux.
- Pas de dépendance ajoutée sans raison forte. Le projet tient sur
  feedparser, PyYAML, google-genai.
- Les erreurs prévisibles (API saturée, flux RSS mort) donnent un message
  lisible ; les vraies erreurs de code gardent leur traceback.

## Pièges connus

- **Windows n'a pas de base de fuseaux horaires** : le paquet `tzdata` est
  indispensable, sinon `ZoneInfo("Europe/Paris")` échoue.
- **`.env` n'est jamais versionné** et disparaît si on réextrait une archive
  par-dessus le projet.
- **Gemini est au palier payant depuis le 24/09/2026**, après une matinée de
  503 sur l'offre gratuite saturée. Prépaiement sans recharge et plafond
  mensuel de 10 € : un run peut donc échouer faute de crédit. Les deux clés
  (prod et tests) sont dans le même projet et partagent sa facture.
  `models.writer_fallbacks` liste les modèles de rédaction essayés dans
  l'ordre si le principal reste saturé. La réflexion du rédacteur coûte
  plus que tout le reste (~0,10 $ sur ~0,15 $ par épisode) mais la baisser
  (`models.writer_thinking`) casse les règles de dialogue : essais du 25/09.
- **GitHub lance les runs planifiés en retard**, jusqu'à cinq heures le
  24/09, et en saute parfois un. Les créneaux de cron tombent en pleine
  nuit américaine, mais l'heure réelle de publication n'est pas garantie.
- **GitHub abandonne des runs planifiés** depuis fin août 2026, d'où les
  trois créneaux de nuit, plus un quatrième à 8 h 10 UTC : filet de sécurité
  après la remise à zéro du quota gratuit Gemini (minuit heure du Pacifique,
  7 h UTC l'été, 8 h UTC l'hiver). Une garde d'idempotence arrête `run` si l'épisode du jour
  est déjà dans `docs/episodes.json` : pour regénérer, `run --force`.
  `say`, `--dry-run` et `--no-audio` ne sont pas concernés.
- **Ne jamais renommer le dépôt GitHub en « lora »** : l'adresse du flux
  (`iceman-ux.github.io/brief-matin/feed.xml`) changerait et tous les
  abonnés perdraient le podcast. Le nom affiché se change dans
  `podcast.title`. Même raison pour le préfixe `brief-matin-` des guid
  d'épisode dans `feed.py` : le changer republierait tous les épisodes.
- **L'adresse du flux (`podcast.email`) est publique** : elle sort dans
  `<itunes:owner>` de `feed.xml`, lisible par tous, et Spotify for Creators
  y envoie son code de vérification. Jamais d'adresse personnelle ni de nom
  réel dans `podcast.author` ou `podcast.email`.
- **Le raccourci iOS partagé s'appelle « Lora »** depuis le 25/09
  (`onboarding.shortcut_name`) : ne changer ce nom qu'avec
  `onboarding.shortcut_url`, après avoir repartagé le raccourci renommé.
- **Les mp3 ne sont plus dans Git** depuis le 26/09 (`audio.storage:
  releases`) : chaque épisode est attaché à la Release `episodes` par
  `gh release upload` (jeton `GITHUB_TOKEN` du workflow, aucun secret
  ajouté), puis retiré de `docs/`. URL :
  `github.com/iceman-ux/brief-matin/releases/download/episodes/<fichier>`,
  une redirection 302. **Repli** : si l'envoi échoue (gh absent, pas
  connecté, réseau), l'épisode sort quand même depuis `docs/episodes/`,
  avec un avertissement ⚠⚠ ; le workflow l'ajoute avec `git add -f`, car
  `docs/episodes/*.mp3` est ignoré. L'URL de chaque épisode est mémorisée
  dans `docs/episodes.json` (`url`, `storage`) : le flux ne la recalcule
  jamais. La rétention supprime aussi les fichiers expirés de la Release.
  `stats` donne les téléchargements comptés par GitHub, relances des
  applis comprises : un ordre de grandeur, pas des auditeurs. En local,
  sans `gh` connecté, `run` et `say` publient donc dans `docs/`.
- **Le modèle n'a que les titres et chapôs**, jamais le texte des articles.
  Le prompt lui interdit d'inventer des liens de causalité — c'est le défaut
  le plus grave possible ici, parce qu'il est invisible à l'écoute.
- **Garde-fou de fidélité** (`src/fidelite.py`, section `fidelite`), depuis
  le 26/09, entre les signatures et le TTS. (1) Sans API : toute suite de
  8 mots ou plus recopiée d'un titre ou d'un chapô du jour est une reprise
  (droit voisin de la presse) ; les citations « » de 20 mots au plus sont
  comptées à part. (2) Un appel au modèle de rédaction (réflexion `low`)
  liste les affirmations absentes des sources ; chiffre, nom, date et
  citation sont « haute ». (3) S'il y a reprise ou « haute », un appel
  réécrit ces seules répliques, puis le contrôle de reprise repasse.
  ~0,013 $ le contrôle, ~0,014 $ la correction. **Il ne bloque jamais
  l'épisode** : panne, API saturée ou réponse illisible, le script sort tel
  quel avec un ⚠⚠ dans le log. Trace dans `data/fidelite/`, sources du
  jour dans `data/sources/` (même rétention que les épisodes), versionnées
  par le workflow pour rejouer un contrôle (`fidelite`). Le contrôle rate
  des affirmations « autre » (conditions, conséquences inventées) : il
  attrape surtout les faits précis.

L'avancement et les tâches en cours sont dans `TODO.md` — à lire seulement
quand la question porte dessus (`@TODO.md`), pas à chaque session.
