# DEBT — KLEOS

Registre de la dette technique et des findings de review qui **traversent les phases**.
But : qu'un pattern douteux, une vuln connue ou un `Verify` différé ne se reperde plus
entre deux harnais. Toute review (cf. `AGENTS.md` § review cross-harnais) y déverse ses
findings non corrigés.

Statuts : `open` · `deferred` · `watching` · `wontfix` · `closed`.
Sévérités : `high` · `medium` · `low`.

| ID | Sév | Titre | Origine | Statut |
|----|-----|-------|---------|--------|
| DEBT-001 | medium | Crédit des gains de pari non atomique | Phase 5 (hérité Phase 4) | open |
| DEBT-002 | medium | `settleBets` throw global bloque tous les payouts du jour | Phase 5 | open |
| DEBT-003 | low | `placeCurrentBet` plante si `exec()` rend `null` | Phase 5 | open |
| DEBT-004 | medium | Couche serveur non testée (atomicité / idempotence / concurrence) | Phases 4-5 | deferred |
| DEBT-005 | medium | 37 vulns `npm audit` (dont 6 high) héritées du scaffold | Phase 0 | watching |
| DEBT-006 | low | Parallélisation des phases via git worktrees inexploitée | Process | deferred |
| DEBT-007 | low | Équilibrage paris : favori clampé à 1.2 = +EV ; « marché auto-équilibré » ≠ impl | Phase 5 | open |

---

## DEBT-001 — Crédit des gains de pari non atomique
**Problème** : un crash serverless entre le claim et le crédit laisse le payout marqué
« réglé » sans que l'or soit jamais versé → perte silencieuse pour le joueur. Lost-update
aussi possible si un achat écurie tombe pendant le tick.
**Où** : `applyBetSettlement` ([src/server/core/dailyArena.ts](src/server/core/dailyArena.ts#L337-L356)). Pattern hérité de `applyArenaSettlement` ([src/server/core/stableStore.ts](src/server/core/stableStore.ts#L26-L43)).
**Action** : claim + crédit dans le **même** `MULTI` (à l'image du débit `placeCurrentBet`, déjà robuste via `WATCH`/`MULTI`/`EXEC`). Corriger aussi `applyArenaSettlement` (même faille).

## DEBT-002 — `settleBets` throw global bloque tous les payouts
**Problème** : si un featured n'est pas retrouvé dans le bracket, le throw avorte **tout**
le règlement des paris du jour, définitivement (arène déjà `resolved` → re-throw au re-tick).
Aujourd'hui inactif (les featured sont garantis en tête de bracket), mais une assertion qui
casse tout au lieu de skipper le ticket fautif.
**Où** : `settleBets` ([src/shared/betting/model.ts](src/shared/betting/model.ts#L72-L101)).
**Action** : skip + log le ticket non résolvable au lieu de throw.

## DEBT-003 — `placeCurrentBet` plante si la transaction WATCH est avortée
**Problème** : `results.length !== 2` lève une `TypeError` si `exec()` rend `null`
(WATCH avorté par un achat écurie concurrent du même user). Rare, message cryptique ;
pas de débit erroné cependant.
**Où** : `placeCurrentBet` ([src/server/core/dailyArena.ts](src/server/core/dailyArena.ts#L152-L153)).
**Action** : traiter `results == null` comme « betting is busy ».

## DEBT-004 — Couche serveur non testée
**Problème** : 0 test sur atomicité / idempotence / no-double-débit alors que c'est là que
sont les risques (DEBT-001/002/003). Le domaine pur, lui, est bien couvert.
**Action** : fake Redis in-memory (ou harness de test serveur) pour couvrir les invariants
économiques. Chantier → post-submission si la deadline serre.

## DEBT-005 — Vulnérabilités npm héritées du scaffold
**Problème** : `npm audit --omit=dev` → 37 vulns (dont 6 high), chaînes Hono/Devvit/Vite.
Les fixes sortent des versions figées par le scaffold ou sont cassantes.
**Action** : surveillé via `.github/dependabot.yml`. Réévaluer avant submission (Phase 8).

## DEBT-006 — Parallélisation des phases inexploitée
**Problème** : `ROADMAP.md` marque les phases 6 et 7 parallélisables, mais le workflow reste
séquentiel mono-harnais.
**Action** : un harnais par phase sur des git worktrees isolés. À tenter sur 6 ‖ 7.

## DEBT-007 — Équilibrage des paris
**Problème** : (a) cotes clampées `[1.2, 4]` sans marge maison → miser sur un favori
écrasant (clampé 1.2, proba ~99 %, non renversable par la ferveur) est +EV → ferme d'or
bornée mais sans risque. (b) La spec dit « marché auto-équilibré » mais les cotes dérivent
de la force pure et ne bougent pas avec le volume de mises.
**Où** : `oddsForConfig` ([src/shared/betting/model.ts](src/shared/betting/model.ts#L18-L28)).
**Action** : décision de design (tuning bornes / vig, ou réécrire le contrat). Non bloquant v1.
