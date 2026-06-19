# PHASE 1 — Sim headless déterministe
Status: not-started
Harness: —

## Goal
Un module TS pur résout un combat de façon déterministe, sans aucun rendu.

## Context
- Read: AGENTS.md, CONCEPT.md (Modèle de combat, Personnages & progression).
- Dépend de: PHASE-0 (structure projet).

## Touches
- `src/shared/sim/` (module partagé) + tests unitaires.

## Tasks
- [ ] Setup runner de test : **vitest** (aucun script `test` dans le scaffold) — pré-requis aux assertions de déterminisme.
- [ ] PRNG seedé (mulberry32 / xorshift) — interdiction de `Math.random` dans la sim.
- [ ] Modèle d'unité : Force / Agilité / Résilience + arme (portée, cadence, dégâts).
- [ ] Boucle à pas de temps fixe (ex. 30 ticks/s), découplée du rendu.
- [ ] Steering : seek cible la plus proche + separation (zéro pathfinding, arène vide).
- [ ] Résolution melee (contact + cooldown) et ranged (stop à portée + tir).
- [ ] Condition de victoire ; sortie = état/timeline reproductible pour le rendu.

## Verify
- `même seed + mêmes équipes → résultat strictement identique` (assertion, plusieurs runs).
- Un 2v2 se résout de façon cohérente et lisible dans les logs.

## Handoff
(structure du module, format de la timeline exportée pour la Phase 2)
