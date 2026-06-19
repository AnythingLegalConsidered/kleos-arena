# PHASE 4 — Loop quotidienne & arène
Status: not-started
Harness: —

## Goal
Une arène quotidienne s'ouvre ; l'équipe joue une qualif instant + entre dans un bracket résolu au tick.

## Context
- Read: AGENTS.md, CONCEPT.md (Core loop, Cadence, Adversaires).
- Dépend de: PHASE-2 (combat jouable), PHASE-3 (écurie).

## Touches
- `src/server` (scheduler/tick, post quotidien, matchmaking ghosts), `src/client` (flow visite).

## Tasks
- [ ] Création d'un post d'arène quotidien (scheduler Devvit).
- [ ] Dieu du jour = modificateur global (rotation 3-4 dieux).
- [ ] Combat instant (qualif) sur soumission ; n'utilise que la foule du joueur.
- [ ] Entrée dans le bracket du jour ; bots crédibles pour amorcer + ghosts (snapshots) ensuite.
- [ ] Tick quotidien : résolution du bracket côté serveur (autorité), distribution des résultats.

## Verify
- Une nouvelle arène apparaît chaque jour (testable en forçant le tick).
- Le bracket se résout au tick et produit un classement.
- Aucun adversaire manquant même sans joueurs (les bots amorcent).

## Handoff
(cadence du scheduler, format snapshot ghost, gotchas tick)
