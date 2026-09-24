# Brief Matin — avancement

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

**Voix de production : `gemini-3.8-flash-tts` depuis le 24/09**, gagnant du
tour 1 du test à l'aveugle, en un seul appel TTS par brief. **En cours : tour
2**, pour trouver des voix plus humaines. La commande `say --out` resynthétise un script
existant hors production, avec la clé du projet de test.

## À faire

### Test de voix à l'aveugle (en cours)

Remplace les essais 03 à 06 du protocole d'écoute. Trois modèles sur le même
script, celui du 23/09, découpé en morceaux de 150 mots :
`gemini-3.1-flash-tts-preview` (production), `gemini-3.8-flash-tts` et
`gemini-3.8-flash-lite-tts`, cités ici dans un ordre sans rapport avec les
lettres.

Les fichiers sont dans `data/voice-test/` (ignoré par Git), avec des lettres
tirées au hasard. La correspondance est dans `cle.txt`, à ne pas ouvrir avant
la fin des écoutes.
Juges : deux amis d'Adam, qui ne connaissent pas la correspondance.

- [x] Générer A et C
- [x] Générer B
- [x] Faire écouter les trois fichiers, recueillir les avis
- [x] Ouvrir `cle.txt` seulement ensuite, et choisir le modèle
- [ ] Relancer `tools/analyse_voix.py` et vérifier si `derive_demitons` baisse
- [x] **Trancher** : agréable à écouter au réveil, oui ou non — non, pas
      encore, d'où le tour 2
- [ ] Réintégrer trim_silence et la lecture de audio.chunk_gap_ms (perdus,
      jamais committés). Moins urgent : un brief tient désormais en un seul
      morceau, sans raccord.

**Verdict du tour 1 (24/09).** Gagnant net : C = `gemini-3.8-flash-tts`,
devant la production d'alors (B, `gemini-3.1-flash-tts-preview`) et
Flash-Lite (A). Passé en production le jour même. Mais C reste loin d'une
voix humaine : intonations correctes, ensemble monotone, et **la voix change
par moments**, comme s'il y avait plus de deux personnes. Cause la plus
probable : le découpage en 5 morceaux de 150 mots, soit 5 générations
séparées qui réinterprètent chacune les voix. La production tourne en un seul
appel (`max_words_per_chunk: 900`), vérifié sur le script du 24/09 : 2 min 55
en un morceau.

### Test de voix à l'aveugle, tour 2 (en cours)

Objectif d'Adam : des voix de radio chaleureuses, vivantes, qui réagissent à
l'info. La qualité passe avant le coût. **Le tour 2 porte sur un extrait**,
les répliques 6 à 11 du script du 23/09 (Groenland puis roman accusé d'IA,
134 mots, ~45 s), parce que Z n'a été généré que sur cet extrait. Trois
fichiers, lettres X, Y, Z tirées au hasard, correspondance dans
`data/voice-test/tour2/cle.txt`, à ne pas ouvrir avant la fin des écoutes :
`gemini-3.8-flash-tts` avec les voix de production sans style (le C du
tour 1, régénéré en un appel), voix sur mesure Gemini (Voice design) avec les
intentions de `tour2/annotations.json`, ElevenLabs v3 avec les balises
équivalentes. Même finition pour les trois (`finish` : compression 2:1,
−16 LUFS, 40 kbps 24 kHz) : aucun ne gagne parce qu'il sonne plus fort.

- [x] Annoter le script du 23/09 (`tour2/annotations.json`)
- [x] Créer les voix sur mesure Gemini (`voices.designed` dans
      `config.yaml`), synthétiser le script complet :
      `tour2/work-gemini-designed.mp3`, 2 min 57 en un appel
- [x] Z, ElevenLabs v3, généré à la main sur elevenlabs.io (l'offre gratuite
      refuse les voix de la bibliothèque par l'API : erreur 402). Extrait
      seulement. Voix : Victoire (Léa) et Alexandre - Calm, Warm & Authentic
      (Marc) ; Nicolas Petit, essayé pour Marc, écarté
      (`work-elevenlabs-nicolas-petit-ecarte.mp3`, hors test). Le chemin API
      (`say --tts-provider elevenlabs`) reste jamais testé au-delà du 402.
- [x] Régénérer les deux extraits Gemini (`say --lines 6-11`), clé de test
- [x] Finition commune (`finish`), réglages `finishing` dans `config.yaml`
- [x] Tirage des lettres : `tour2/X.mp3`, `Y.mp3`, `Z.mp3`
- [ ] Écoutes, puis ouverture de `tour2/cle.txt`
- [ ] Ne pas écouter `data/voice-test/apercus-gemini/` ni les `work-*.mp3`
      avant la fin des écoutes : leurs noms trahissent la correspondance
- [ ] Selon le verdict : brancher `finish` sur la production ? Pas fait,
      la finition ne sert qu'au test pour l'instant

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
- **Un seul appel TTS par brief** (`max_words_per_chunk: 900`). Si un brief
  dépasse 900 mots, il sera découpé et les voix risquent de changer au
  raccord : surveiller la longueur des scripts.
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
