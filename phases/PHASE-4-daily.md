# PHASE 4 — Loop quotidienne & arène
Status: done
Harness: Codex GPT-5

## Goal
Une arène quotidienne s'ouvre ; l'équipe joue une qualif instant + entre dans un bracket résolu au tick.

## Context
- Read: AGENTS.md, CONCEPT.md (Core loop, Cadence, Adversaires).
- Dépend de: PHASE-2 (combat jouable), PHASE-3 (écurie).

## Touches
- `src/server` (scheduler/tick, post quotidien, matchmaking ghosts), `src/client` (flow visite).

## Tasks
- [x] Création d'un post d'arène quotidien (scheduler Devvit).
- [x] Dieu du jour = modificateur global (rotation 3-4 dieux).
- [x] Combat instant (qualif) sur soumission ; n'utilise que la foule du joueur.
- [x] Entrée dans le bracket du jour ; bots crédibles pour amorcer + ghosts (snapshots) ensuite.
- [x] Tick quotidien : résolution du bracket côté serveur (autorité), distribution des résultats.

## Verify
- Une nouvelle arène apparaît chaque jour (testable en forçant le tick).
- Le bracket se résout au tick et produit un classement.
- Aucun adversaire manquant même sans joueurs (les bots amorcent).

Validé par `npm test` (31/31), `npm run type-check`, `npm run lint` et `npm run build`.
Le menu modérateur `Force daily arena tick` expose le chemin de test live ; le playtest Reddit
n'a pas été lancé dans cette session (action sortante).

## Handoff
**Cadence / cycle** :
- `devvit.json` déclare la tâche `daily-arena` à `5 0 * * *` (UTC), endpoint
  `/internal/tasks/daily-arena`. Le tick résout J-1 puis ouvre le post de J.
- `onAppInstall` et le menu `Open today's arena` créent/réutilisent aussi le post courant.
  `arena:post-claims` empêche les doubles posts lors de déclenchements concurrents.
- Forçage : menu modérateur `Force daily arena tick` → résout le jour courant, de façon idempotente.

**Domaine / Redis** :
- `src/shared/daily/` est pur : rotation Arès/Athéna/Hermès/Niké, qualif seedée,
  bracket minimum 8 puis prochaine puissance de 2, bots de cold-start et classement déterministe.
- Snapshot ghost = `{ id, ownerId, name, kind, roster: Gladiator[] }`. Une copie par owner vit dans
  le hash `arena:ghosts`; les entrées du jour vivent dans `arena:entries:{YYYY-MM-DD}`.
- Méta/résultat complet : `arena:{YYYY-MM-DD}`. Dernier jour résolu : `arena:latest-resolved`.
  Claims de règlement : `arena:settled:{day}` pour ne pas doubler or/faveur/blessures sur retry.
- Qualif : `POST /api/arena/enter` fige la stable, choisit un ghost réel si disponible sinon un bot,
  simule côté serveur puis renvoie seulement la config à rejouer par Phaser.

**Distribution / gotchas** :
- Récompenses placeholder : rang 1 `100 or + 2 faveur`, rang 2 `70 + 1`, rangs 3-4 `45`
  (rang 3 +1 faveur), autres `25`. Blessure = pire perte de PV subie dans le bracket.
- La ferveur externe n'existe pas encore (Phase 5) : la qualif n'applique donc aucun vote adverse ;
  sa config est déjà isolée et pourra recevoir uniquement la foule du joueur.
- Limite distribuée : Reddit `submitCustomPost` et Redis ne forment pas une transaction atomique.
  Le claim privilégie l'absence de doublon ; un crash exactement pendant la création peut demander
  une reprise manuelle du claim `creating`.
