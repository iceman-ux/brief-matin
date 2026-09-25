# Lora (dépôt brief-matin) — contexte projet

Brief d'actualité personnel généré chaque nuit, publié dans un flux podcast
privé sur GitHub Pages, lancé au réveil par une automatisation Raccourcis iOS.
Auditeur unique : le propriétaire du repo. Ce n'est pas un produit.

**Nom et identité : Lora**, depuis le 25/09/2026 (avant : « Brief Matin »,
qui reste le nom du dépôt). DA : Art déco des années 30, nocturne et
luxueuse ; palette #0B0E2A, #1B2466, #F2A33A, #C9953C, #8E1426. Sonal
composé par Adam, à venir (`audio.intro_file` / `outro_file`).
Signatures fixes, posées par le code (`src/brand.py`, section `brand` de
`config.yaml`) et jamais demandées au modèle : ouverture « Lora. Il est
l'heure. » + date (« Mardi 29 septembre. ») + clin d'œil d'un jour férié +
accroche du modèle (« Ce matin, … », 20 mots au plus) ; clôture « C'était
Lora. Belle journée. » (« Belle semaine. » le lundi, « Bon week-end. » le
vendredi). Pas de mention d'IA dans le texte parlé : elle reste écrite, dans
le flux et sur la page d'installation.

## Architecture

```
config.yaml          tous les réglages — le code ne doit contenir AUCUNE valeur en dur
prompts/brief_fr.md  ligne éditoriale du brief (règles d'écriture numérotées)
src/config.py        chargement config + .env
src/sources.py       RSS : récupération parallèle, fenêtre temporelle, regroupement
src/memory.py        sujets déjà traités → data/covered.json
src/brand.py         signatures d'ouverture et de clôture, jours fériés
src/writer.py        construction du prompt, appel LLM, garde-fous sur la sortie
src/tts.py           synthèse vocale, découpage, encodage mp3
src/feed.py          flux RSS podcast, page d'accueil, rétention des épisodes
src/retry.py         réessais avec backoff exponentiel sur erreurs temporaires
src/main.py          orchestration + CLI
docs/                publié par GitHub Pages (feed.xml, index.html, installer.html, episodes/)
tools/analyse_voix.py  mesure audio pour le protocole d'écoute, hors pipeline
                       (numpy, scipy — hors requirements.txt, le run n'en a pas besoin)
```

Pipeline : RSS → dédoublonnage → mémoire → LLM → signatures → TTS → mp3 → feed.xml.

## Commandes

```bash
python -m src.main run              # brief complet (s'arrête si déjà publié)
python -m src.main run --force      # regénère même si l'épisode du jour existe
python -m src.main run --dry-run    # aucun appel API payant, bruit de test au lieu de la voix
python -m src.main run --no-audio   # script seul, pour itérer sur le prompt
python -m src.main say [AAAA-MM-JJ] # resynthèse d'un script existant, sans LLM
python -m src.main check-feeds      # diagnostic des sources RSS
python -m src.main rebuild-feed     # régénère feed.xml depuis docs/episodes.json
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
  l'ordre si le principal reste saturé.
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
- **Le raccourci iOS partagé s'appelle encore « Brief Matin »**
  (`onboarding.shortcut_name`) : ne changer la clé qu'après avoir repartagé
  un raccourci renommé « Lora » et mis à jour `onboarding.shortcut_url`.
- **Le modèle n'a que les titres et chapôs**, jamais le texte des articles.
  Le prompt lui interdit d'inventer des liens de causalité — c'est le défaut
  le plus grave possible ici, parce qu'il est invisible à l'écoute.

L'avancement et les tâches en cours sont dans `TODO.md` — à lire seulement
quand la question porte dessus (`@TODO.md`), pas à chaque session.
