# PHASE 6 — Rétention (streak, leaderboard)
Status: in-progress
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
- [ ] Leaderboard du jour : tri par résultat de bracket.
- [ ] (Stretch) Flair communautaire attribué selon le rang.

## Verify
- Le streak incrémente sur jours consécutifs, reset sur jour manqué.
- Le leaderboard trie correctement les écuries du jour.

## Handoff
(stockage streak, perf du tri leaderboard à l'échelle, état du stretch flair)
