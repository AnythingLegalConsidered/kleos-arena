# PHASE 3 — Écurie & progression
Status: done
Harness: claude

## Goal
Le joueur gère une écurie persistante entre les combats.

## Context
- Read: AGENTS.md, CONCEPT.md (Personnages & progression, Progression persistante).
- Dépend de: PHASE-0 (peut avancer en parallèle de 1-2).

## Touches
- `src/client` (UI écurie), `src/server` (KV), `src/shared` (modèles).

## Tasks
- [x] Roster (3 gladiateurs) ; modèle perso = attributs + aptitude aléatoire + arme.
- [x] Points d'attribut + petites échelles de 3-4 perks par attribut.
- [x] Armes aléatoires (archétypes antiques) à la recrue.
- [x] Économie : or / faveur (dépenser : level, perk, soin). *Gains de combat = Phase 4 ; "stuff" = backlog.*
- [x] Persistance Redis/KV : roster + éco keyés par user (`stable:{username}`).

## Verify
- Gérer son écurie entre deux combats modifie réellement la sim suivante.
  → ✅ **prouvé headless** (`test/stable/model.test.ts` : roster renforcé → bataille différente même seed). Câblage UI→serveur→Arena en place ; bout-en-bout = playtest.
- Fermer puis rouvrir le post : l'état est restauré à l'identique.
  → logique de sérialisation ✅ **prouvée headless** (round-trip deep-equal, rejet des blobs invalides/version). Le **round-trip Redis réel** (close/reopen) n'est pas testable ici → **playtest requis** (`npm run dev`).

## Handoff
**Modèle de données** (`src/shared/stable/`, pur & testé) :
- `Gladiator` = `{ id, name, attributes{force,agility,resilience}, aptitude, weapon, perks{...}, injury }`.
- `Stable` = `{ version, ownerId, name, gold, favor, roster: Gladiator[] }`. `STABLE_VERSION = 1`.
- `recruit(rng, id)` : aptitude + arme + attributs aléatoires (RNG seedé de la sim) ; roster de départ **déterministe** par owner (hash → seed).
- Fold-down sim : `effectiveAttributes(g)` = base × pénalité-blessure + bonus-perk ; `gladiatorToUnitSpec(g, team, pos)` = **seul pont** vers la sim → sim LOCKED intouchée.

**Schéma KV** : clé `stable:{username}` → `JSON.stringify(Stable)`. Serveur = **seul writer** (anti-triche).
- `GET /api/stable` : load-or-create (crée + persiste un défaut si absent).
- `POST /api/stable/action` `{ action:'attr'|'perk'|'heal', gladiatorId, attr? }` : valide → applique via le modèle → persiste → renvoie la stable, ou `{type:'error'}` (400) sans écrire.

**Économie (tuning placeholder, `model.ts`)** : or départ 120, faveur 3. Coût attribut = `18 + 3×niveau`, **½ sur l'aptitude**. Perks : 3 paliers/attribut, coûts `[40,80,140]`, bonus cumulés `[2,5,9]`, gatés. Soin = `injury×60`.

**Boucle câblée** : MainMenu → **Stable** (cartes roster : +attribut / perk-aptitude / soin, bouton COMBATTRE) → **Arena** (équipe = roster folded, adversaire = `botTeam()` placeholder) → tap après victoire = retour Stable.

**À équilibrer / suite** :
- Tuning éco + perks brut (placeholder). Vrais gains d'or, faveur, et **injury post-combat** = Phase 4.
- UI perk ne cible que l'**aptitude** du gladiateur (serveur supporte les 3) ; soin visible mais inactif tant qu'`injury=0` (pas de source avant Phase 4).
- Adversaire = bot fixe ; bracket quotidien / ghosts = Phase 4. Seed de combat fixe (`DEMO_SEED`).
- Persistance globale par user (pas par post) = voulu (progression persistante). Fallback `anonymous` si pas de username.

**Verify machine** : `npm test` 25/25 · `type-check` OK · `lint` OK · `build` OK. Live (Redis + flux UI) = playtest.
