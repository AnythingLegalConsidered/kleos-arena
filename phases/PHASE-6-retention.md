# PHASE 6 — Rétention (streak, leaderboard)
Status: done
Harness: Claude Code

## Goal
Streak quotidien + leaderboard du jour. (Stretch : flair par rang.)

## Context
- Read: AGENTS.md, CONCEPT.md (Cibles de prix Retention, Progression persistante).
- Dépend de: PHASE-3 (persistance), PHASE-4 (résultats du jour).

## Touches
- `src/server` (streak, agrégation leaderboard), `src/client` (affichage).

## Tasks
- [x] Streak : jours consécutifs de participation (incrément / reset sur jour manqué).
- [x] Leaderboard du jour : tri par résultat de bracket.
- [ ] (Stretch) Flair communautaire attribué selon le rang.

## Verify
- Le streak incrémente sur jours consécutifs, reset sur jour manqué — couvert par les tests
  unitaires existants (`test/stable/model.test.ts`).
- Le leaderboard trie correctement les écuries du jour — hérité de `buildStandings`
  (`src/shared/daily/model.ts`), déjà couvert par `test/daily/model.test.ts`. La route
  `GET /api/arena` ne fait qu'exposer `status.arena.standings` tel quel (aucune logique de tri/
  troncature ajoutée côté serveur), donc pas de nouveau test serveur nécessaire.
- `npm test && npm run type-check && npm run lint && npm run build` : tous passent.

## Handoff
- **Streak** : stocké sur `Stable.streak` (`src/shared/stable/types.ts`), incrémenté par
  `recordParticipation` lors de `POST /arena/enter` (déjà en place avant cette phase). Affiché en
  continu dans le HUD de `Stable.ts` (`or … faveur … série Nj`) car `stable.streak` est toujours à
  jour dès `GET /api/stable`, pas seulement après une entrée — plus robuste que de dépendre
  uniquement de `ArenaEntryResponse.streak`.
- **Leaderboard** : `standings: Standing[]` ajouté à `ArenaStatusResponse` (`src/shared/api.ts`),
  renseigné en passthrough depuis `status.arena.standings` dans `arena.get('/')`
  (`src/server/routes/arena.ts`) — vide tant que l'arène est `'open'`, peuplé à la résolution.
  Affiché dans `Stable.ts` sous forme de panneau compact (top 5, `LEADERBOARD_ROWS`) ancré dans la
  marge droite libre à côté des cartes de gladiateurs, uniquement quand `standings.length > 0`
  (donc arène résolue). Distinction visuelle joueur/bot via `standing.kind` (or vs gris) — pas de
  highlighting "c'est moi" car le username courant n'est pas exposé au client dans ce fichier ;
  ajouter `ownerId`/username matching serait un axe d'amélioration ultérieur si besoin.
- **Perf tri à l'échelle** : `buildStandings` trie en mémoire (in-memory), volume quotidien attendu
  modeste (jeu Reddit naissant) → aucun souci de perf identifié, pas d'optimisation nécessaire.
  Pas de plafonnement côté API (renvoie tous les standings) : la troncature top-5 est purement
  cosmétique côté client.
- **Stretch flair** : volontairement coupé, hors budget avant la deadline du 2026-07-15. Case
  laissée non cochée ci-dessus.
