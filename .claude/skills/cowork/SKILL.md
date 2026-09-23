---
name: cowork
description: Exécute la tâche préparée par Claude (Cowork) dans « Claude outputs/tache.md », puis écrit le rapport dans « Claude outputs/rapport.md ». À utiliser quand l'utilisateur tape /cowork.
---

# Relais avec Cowork

Adam travaille le produit, la stratégie et la recherche avec Claude dans
Cowork, et le code ici. Cowork et toi échangez par deux fichiers du dossier
`Claude outputs/`, qui est ignoré par Git. Ça évite à Adam de copier-coller
des consignes et des rapports d'une fenêtre à l'autre.

## Déroulé

1. **Lis `Claude outputs/tache.md`.**
   - S'il n'existe pas, ou si sa première ligne commence par `STATUT : fait`,
     dis-le en une phrase et arrête-toi : il n'y a rien de nouveau.
   - Sinon, résume la tâche en deux lignes à Adam, puis exécute-la.
2. **Exécute la tâche** en respectant `CLAUDE.md`. Si la tâche contredit
   `CLAUDE.md`, ou si une décision n'y est pas tranchée et engage de l'argent,
   des données ou la production, arrête-toi et demande à Adam ici, dans
   VS Code. Ne devine pas.
3. **Écris `Claude outputs/rapport.md`** en écrasant l'ancien, au format
   ci-dessous. Il sera lu par Claude dans Cowork, pas seulement par Adam :
   sois précis sur ce qui est fait, ce qui ne l'est pas, et pourquoi.
4. **Marque la tâche comme faite** : ajoute en toute première ligne de
   `tache.md` : `STATUT : fait le AAAA-MM-JJ HH:MM — voir rapport.md`.
5. **Termine en une phrase** dans le terminal : « Rapport écrit, tu peux dire
   à Cowork de le lire. »

## Format de `rapport.md`

```markdown
# Rapport — <titre de la tâche>
Date : AAAA-MM-JJ HH:MM (Paris)
Statut : terminé | partiel | bloqué

## Fait
- … (un point par action, avec le hash des commits et « poussé » ou non)

## Pas fait, et pourquoi
- …

## Décisions à prendre
- … (vide si aucune)

## Vérifications
- … (commandes lancées et résultat en une ligne)
```

## Règles qui ne se discutent pas

- **Aucun secret** dans le rapport, le terminal ou un commit : ni le contenu
  de `.env`, ni une clé, même partielle.
- **Ne lis ni n'affiche jamais** le contenu de `data/voice-test/cle.txt` :
  le test de voix est à l'aveugle.
- **Ne pousse que si la tâche le demande.** Sinon, committe en local et
  signale-le dans le rapport.
- **Appels API payants ou soumis à quota** : seulement ceux que la tâche
  prévoit, dans le budget qu'elle fixe. Sur une erreur 429 ou 503 qui
  persiste, arrête-toi et note le détail du quota dans le rapport.
