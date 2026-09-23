# Brief Matin

Un brief d'actualité personnel, généré chaque nuit, publié dans un flux podcast
privé, et lancé automatiquement quand tu coupes ton réveil sur iPhone.

```
flux RSS (France + Monde + Éco + Tech)
   ↓  agrégation, fenêtre 26 h (74 h le lundi)
   ↓  regroupement des reprises → tri par importance
   ↓  mémoire des 7 derniers jours : « ne rejoue pas ce que tu as dit mardi »
   ↓  LLM → script en dialogue deux voix
   ↓  TTS → mp3
   ↓  flux RSS podcast sur GitHub Pages
   ↓  Pocket Casts / Overcast
   ↓  Raccourcis iOS : « quand l'alarme s'arrête » → lire le dernier épisode
```

Tout tourne sur GitHub Actions. Aucun serveur à maintenir.

---

## 1. Installation (20 minutes)

### a. Le repo

```bash
git init brief-matin && cd brief-matin      # ou décompresse l'archive ici
pip install -r requirements.txt
```

ffmpeg est requis en local si tu veux tester : `brew install ffmpeg`
(macOS) ou `sudo apt install ffmpeg` (Linux). GitHub Actions l'installe seul.

### b. La clé API

Récupère une clé sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey),
puis :

```bash
cp .env.example .env
# colle la clé dans GEMINI_API_KEY
```

### c. Valider les sources

Les flux RSS bougent : un média change d'URL, un autre passe derrière un mur.
**Fais-le avant tout le reste.**

```bash
python -m src.main check-feeds
```

Retire de `config.yaml` les flux en échec, ajoute les tiens. Un flux mort ne
casse pas le brief — il le rend juste plus pauvre, en silence. D'où ce test.

### d. Premier essai, sans dépenser un centime

```bash
python -m src.main run --dry-run
```

Ça exerce l'agrégation, la mémoire et l'encodage avec un script factice et un
mp3 silencieux. Si ça passe, la plomberie est bonne. Un dry-run ne publie
rien : ni épisode, ni flux, ni mise à jour de la mémoire. Le silence et le
script factice vont dans `data/dry-run.*`, hors de `docs/`.

Ensuite, un vrai brief mais sans audio — c'est là que tu juges la qualité
éditoriale, et c'est l'étape sur laquelle il faut itérer :

```bash
python -m src.main run --no-audio
cat data/scripts/$(date +%F).txt
```

Relis à voix haute. Si une phrase te fait trébucher, elle est trop longue.
Corrige `prompts/brief_fr.md` et relance. Trois ou quatre allers-retours
suffisent généralement à caler le ton.

Puis le brief complet :

```bash
python -m src.main run
```

### e. Publier

1. Crée un repo GitHub (**public** : Actions y est gratuit sans limite de minutes).
2. `Settings → Pages → Source: Deploy from a branch`, branche `main`, dossier `/docs`.
3. `Settings → Secrets and variables → Actions → New repository secret` :
   nom `GEMINI_API_KEY`, valeur ta clé.
4. Dans `config.yaml`, remplace `podcast.base_url` par
   `https://<ton-pseudo>.github.io/<nom-du-repo>`.
5. `git push`.
6. Onglet **Actions** → *Brief quotidien* → **Run workflow** pour déclencher
   le premier run à la main.

Ton flux est à `https://<ton-pseudo>.github.io/<repo>/feed.xml`.

> ⚠️ Repo public = flux public. Personne ne le trouvera sans l'URL, mais ce
> n'est pas un secret. Si ça te gêne, passe le repo en privé : Actions reste
> gratuit dans la limite de 2 000 min/mois (ce job en consomme de l'ordre de
> 150 à 200 : un run complet de trois ou quatre minutes, plus environ une
> minute pour chacun des deux créneaux redondants ; estimation, pas une
> mesure), mais il
> faudra héberger les mp3 ailleurs (Cloudflare R2, 10 Go gratuits).

---

## 2. Le réveil sur iPhone

### a. Ajouter le flux

Apple Podcasts n'accepte pas une URL de flux arbitraire sur iOS. Utilise
**Pocket Casts** (gratuit) ou **Overcast** :

- Pocket Casts : `Découvrir` → loupe → colle l'URL du `feed.xml`
- Overcast : `+` → `Add URL`

Active le téléchargement automatique des nouveaux épisodes — sinon le matin
tu attends le buffering.

### b. L'automatisation

App **Raccourcis** → onglet `Automatisation` → `+` :

1. Déclencheur : **Alarme** → `Quand elle est arrêtée` → *Toute alarme*
   (ou une alarme précise si tu veux que ça ne s'applique qu'à celle du matin)
2. `Exécuter immédiatement`, et désactive `Demander avant d'exécuter`
3. Actions :
   - `Attendre` 2 secondes (laisse l'iPhone finir de se réveiller)
   - `Pocket Casts : Lire le dernier épisode` → ton podcast
     *(ou Overcast : `Play Podcast`)*

Tu continues à régler ton réveil normalement dans l'app Horloge selon tes
cours. Rien à reconfigurer.

**Variantes utiles**

- Déclencheur `Répéter l'alarme` → mettre en pause : le brief reprend
  au vrai réveil.
- Ajoute `Si` → `Jour de la semaine` pour ne rien lancer le week-end.
- Enchaîne avec `Régler la luminosité` ou `Lire la météo` pour un vrai
  rituel de réveil.

---

## 3. Réglage éditorial

Tout le caractère du brief vit dans deux fichiers.

**`config.yaml`** — le cadre :

| Réglage | Effet |
|---|---|
| `brief.target_minutes` | durée visée. C'est le seul levier de coût qui compte. |
| `brief.mix` | répartition France / Monde / Éco / Tech |
| `brief.lookback_hours` | fenêtre d'actu, par jour de semaine |
| `brief.weekly_recap_on` | jours où on ajoute « à retenir de la semaine » |
| `voices.two_voices` | dialogue ou voix unique |
| `voices.speakers[].voice` | timbre (Kore, Puck, Charon, Fenrir, Achernar…) |
| `voices.direction` | consigne de jeu passée au modèle TTS |
| `memory.lookback_days` | profondeur de la mémoire anti-répétition |

**`prompts/brief_fr.md`** — la ligne éditoriale. C'est là que tu passes ton
temps. Ses règles d'écriture numérotées sont ce qui sépare un brief écoutable d'une
lecture de dépêches. Ajoute les tiennes au fil des écoutes : chaque fois qu'un
tic t'agace, une ligne de plus dans le prompt.

### Contre la monotonie

Par ordre d'impact réel :

1. **Le dialogue à deux voix.** Le prompt interdit explicitement l'alternance
   mécanique et les répliques de complaisance (« exactement », « tout à
   fait ») — sans ça, le modèle produit un faux dialogue pire qu'un monologue.
2. **Les répliques de longueur inégale.** Aussi dans le prompt.
3. **Le choix des timbres.** `Kore` (ferme) + `Puck` (énergique) est un
   contraste qui marche. Teste sur [aistudio.google.com](https://aistudio.google.com)
   avant de changer.
4. **`voices.direction`.** Le modèle TTS traite cette consigne comme une
   direction d'acteur.

Le multi-locuteurs ne coûte pas plus cher : la facture dépend de la durée
audio, pas du nombre de voix.

---

## 4. Ce que ça coûte

Base : 4 minutes par jour, 30 jours.

| Poste | Mensuel |
|---|---|
| TTS Gemini Flash (standard) | ~3,3 € |
| LLM rédacteur (~25k tokens in / 1,5k out par jour) | ~0,70 € |
| GitHub Actions + Pages | 0 € |
| Pocket Casts | 0 € |
| **Total** | **~4 €/mois** |

Le calcul TTS : 240 s × 25 tokens/s = 6 000 tokens audio, à 20 $/M. Le mode
batch, deux fois moins cher, n'est pas implémenté : `tts_batch` ne change rien. Chaque minute ajoutée coûte ~0,03 $/jour, soit ~0,90 $/mois.
`estimate_cost_usd()` affiche le coût réel à chaque run.

Le free tier de Gemini peut suffire pour un brief par jour — mais les quotas
bougent et les données y sont réutilisables pour l'entraînement. Vérifie la
[grille officielle](https://ai.google.dev/gemini-api/docs/pricing), les tarifs
changent (celui du modèle texte double au 1er janvier 2027).

---

## 5. Structure

```
config.yaml              tous les réglages
prompts/brief_fr.md      la ligne éditoriale
src/
  config.py              chargement config + .env
  sources.py             RSS : récupération, fenêtre, regroupement
  memory.py              sujets déjà traités (data/covered.json)
  writer.py              construction du prompt, appel LLM, garde-fous
  tts.py                 synthèse, découpage, encodage mp3
  feed.py                flux RSS podcast + page d'accueil + rétention
  main.py                orchestration et CLI
docs/                    publié par GitHub Pages
  feed.xml  index.html  episodes/*.mp3  episodes.json
data/covered.json        la mémoire, versionnée dans le repo
```

### Commandes

```bash
python -m src.main run                # le brief du jour
python -m src.main run --dry-run      # tout, sans appel payant
python -m src.main run --no-audio     # script seul, pour itérer sur le prompt
python -m src.main check-feeds        # diagnostic des sources
python -m src.main rebuild-feed       # régénère feed.xml depuis l'index
```

---

## 6. Points d'attention

**Trois créneaux de cron, pas un.** Le workflow se déclenche à `30 2`, `30 3`
et `30 4` UTC, soit 4 h 30, 5 h 30 et 6 h 30 à Paris l'été. Depuis fin août
2026, GitHub abandonne régulièrement des runs planifiés : un créneau unique
laissait des matins sans brief. Le premier créneau qui aboutit publie
l'épisode ; les suivants voient qu'il existe déjà et s'arrêtent avant tout
appel payant (garde d'idempotence dans `cmd_run`, contournable avec
`run --force`). Ils consomment tout de même la minute d'installation de
ffmpeg et des dépendances, qui précède la garde.

**Le cron est en UTC.** GitHub ne gère pas les fuseaux : l'hiver, les trois
créneaux reculent d'une heure à Paris (3 h 30, 4 h 30, 5 h 30).

**GitHub Actions n'est pas ponctuel.** Le déclenchement peut glisser de 5 à
30 minutes aux heures chargées. Lance le job largement en avance sur ton
réveil le plus matinal.

**Si aucun article n'est récupéré, le run s'arrête** sans rien publier — tu
réécoutes celui de la veille plutôt qu'un brief vide. Surveille l'onglet
Actions les premières semaines.

**Le modèle n'a que les titres et chapôs.** Le prompt lui interdit d'inventer
au-delà, mais un chapô ambigu donne un brief approximatif. Pour aller plus
loin il faudrait récupérer le texte des articles — ce qui pose des questions
de droits selon les médias. Reste sur les chapôs.

**Vérifie la mémoire de temps en temps.** `data/covered.json` se lit à la
main. Si les slugs sont trop précis (`budget-2027-vote-mardi`), la mémoire ne
sert à rien : le modèle croira que c'est un sujet neuf. Resserre la consigne
dans le prompt.
