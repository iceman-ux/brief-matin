# Brief Matin — contexte projet

Brief d'actualité personnel généré chaque nuit, publié dans un flux podcast
privé sur GitHub Pages, lancé au réveil par une automatisation Raccourcis iOS.
Auditeur unique : le propriétaire du repo. Ce n'est pas un produit.

## Architecture

```
config.yaml          tous les réglages — le code ne doit contenir AUCUNE valeur en dur
prompts/brief_fr.md  ligne éditoriale du brief (règles d'écriture numérotées)
src/config.py        chargement config + .env
src/sources.py       RSS : récupération parallèle, fenêtre temporelle, regroupement
src/memory.py        sujets déjà traités → data/covered.json
src/writer.py        construction du prompt, appel LLM, garde-fous sur la sortie
src/tts.py           synthèse vocale, découpage, encodage mp3
src/feed.py          flux RSS podcast, page d'accueil, rétention des épisodes
src/retry.py         réessais avec backoff exponentiel sur erreurs temporaires
src/main.py          orchestration + CLI
docs/                publié par GitHub Pages (feed.xml, index.html, installer.html, episodes/)
tools/analyse_voix.py  mesure audio pour le protocole d'écoute, hors pipeline
                       (numpy, scipy — hors requirements.txt, le run n'en a pas besoin)
```

Pipeline : RSS → dédoublonnage → mémoire → LLM → TTS → mp3 → feed.xml.

## Commandes

```bash
python -m src.main run              # brief complet (s'arrête si déjà publié)
python -m src.main run --force      # regénère même si l'épisode du jour existe
python -m src.main run --dry-run    # aucun appel API payant, audio silencieux
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
- **Le free tier Gemini renvoie beaucoup de 503** aux heures de pointe
  américaines. Les trois créneaux de cron (2 h 30, 3 h 30 et 4 h 30 UTC)
  tombent en pleine nuit américaine précisément pour les éviter.
- **GitHub abandonne des runs planifiés** depuis fin août 2026, d'où les
  trois créneaux de nuit, plus un quatrième à 8 h 10 UTC : filet de sécurité
  après la remise à zéro du quota gratuit Gemini (minuit heure du Pacifique,
  7 h UTC l'été, 8 h UTC l'hiver). Une garde d'idempotence arrête `run` si l'épisode du jour
  est déjà dans `docs/episodes.json` : pour regénérer, `run --force`.
  `say`, `--dry-run` et `--no-audio` ne sont pas concernés.
- **Le modèle n'a que les titres et chapôs**, jamais le texte des articles.
  Le prompt lui interdit d'inventer des liens de causalité — c'est le défaut
  le plus grave possible ici, parce qu'il est invisible à l'écoute.

L'avancement et les tâches en cours sont dans `TODO.md` — à lire seulement
quand la question porte dessus (`@TODO.md`), pas à chaque session.
