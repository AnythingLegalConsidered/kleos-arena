# PHASE 1 — Sim headless déterministe
Status: done
Harness: claude

## Goal
Un module TS pur résout un combat de façon déterministe, sans aucun rendu.

## Context
- Read: AGENTS.md, CONCEPT.md (Modèle de combat, Personnages & progression).
- Dépend de: PHASE-0 (structure projet).

## Touches
- `src/shared/sim/` (module partagé) + tests unitaires.

## Tasks
- [x] Setup runner de test : **vitest** 4.1.9 (`npm test` = `vitest run`, tests sous `test/`).
- [x] PRNG seedé (mulberry32, `src/shared/sim/prng.ts`) — `Math.random` banni dans la sim.
- [x] Modèle d'unité : Force / Agilité / Résilience + arme (portée, cadence, dégâts) — `unit.ts` + `weapons.ts`.
- [x] Boucle à pas de temps fixe (30 ticks/s, `DT = 1/30`), découplée du rendu — `battle.ts`.
- [x] Steering : seek cible la plus proche + separation (entre alliés, zéro pathfinding).
- [x] Résolution melee (contact + cooldown) et ranged (bow range 120, stop à portée + tir).
- [x] Condition de victoire (1 équipe survivante) ; sortie = `BattleResult` (frames + events reproductibles).

## Verify
- `même seed + mêmes équipes → résultat strictement identique` (assertion, plusieurs runs).
- Un 2v2 se résout de façon cohérente et lisible dans les logs.

## Handoff
- **Module** : `src/shared/sim/` — `prng.ts` (mulberry32, type `Rng`), `types.ts` (domaine),
  `weapons.ts` (table 4 archétypes : spear/sword_shield/axe/bow), `vector.ts`, `unit.ts`
  (attributs → stats dérivées), `battle.ts` (`simulate(config)`), `index.ts` (barrel). Import unique : `src/shared/sim`.
- **Entrée** : `BattleConfig { seed, units: UnitSpec[], maxTicks? }`. `UnitSpec` = id, teamId, attributes, weapon, position.
- **Sortie (pour Phase 2)** : `BattleResult { outcome, winner, ticks, frames, events, finalHp }`.
  - `frames: TimelineFrame[]` = 1 snapshot/tick (tick 0 inclus → `frames.length === ticks + 1`), positions arrondies 2 déc. + hp.
  - `events: AttackEvent[]` = log chrono { tick, attackerId, targetId, damage, dodged, killed } → source du juice (hitpause, KO).
- **Déterminisme** : tout l'aléa passe par `Rng` seedé ; unités triées par `id` (ordre d'entrée indifférent) ; update séquentiel (Gauss-Seidel). Même seed+équipes → résultat strictement identique (testé). Garantie *same-runtime* (cf. CONCEPT) : suffit pour le replay client ; le serveur reste autorité aux enjeux.
- **Verify** : `npm test` = 9/9 vert (prng, déterminisme ×3, 2v2). `npm run type-check` OK.
- **Tuning** (`weapons.ts` + coeffs `unit.ts`) volontairement simple/linéaire — à équilibrer plus tard (Phase 4+).
- **⚠️ Pré-existant à trancher (hors scope sim)** : `npm run lint` cassé sur Windows — le script `eslint 'src/**/*.{ts,tsx}'` passe les quotes simples littéralement à cmd (glob non déplié). `npx eslint src/shared/sim` = clean. Fix portable possible (retirer les quotes ou pointer `src` directement), non appliqué (surgical).
