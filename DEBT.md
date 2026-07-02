# DEBT — KLEOS

Registre de la dette technique et des findings de review qui **traversent les phases**.
But : qu'un pattern douteux, une vuln connue ou un `Verify` différé ne se reperde plus
entre deux harnais. Toute review (cf. `AGENTS.md` § review cross-harnais) y déverse ses
findings non corrigés.

Statuts : `open` · `deferred` · `watching` · `wontfix` · `closed`.
Sévérités : `high` · `medium` · `low`.

| ID | Sév | Titre | Origine | Statut |
|----|-----|-------|---------|--------|
| DEBT-001 | medium | Crédit des gains de pari non atomique | Phase 5 (hérité Phase 4) | closed |
| DEBT-002 | medium | `settleBets` throw global bloque tous les payouts du jour | Phase 5 | closed |
| DEBT-003 | low | `placeCurrentBet` plante si `exec()` rend `null` | Phase 5 | closed |
| DEBT-004 | medium | Couche serveur non testée (atomicité / idempotence / concurrence) | Phases 4-5 | deferred |
| DEBT-005 | medium | 37 vulns `npm audit` (dont 6 high) héritées du scaffold | Phase 0 | watching |
| DEBT-006 | low | Parallélisation des phases via git worktrees inexploitée | Process | deferred |
| DEBT-007 | medium | Équilibrage paris : favori clampé à 1.2 = +EV ; « marché auto-équilibré » ≠ impl | Phase 5 | open |
| DEBT-008 | medium | Claim `'creating'` du post quotidien sans TTL → zombie sur crash | Review 2026-06-19 | closed |
| DEBT-009 | low | `withBettingLock` libère le lock via `get`+`del` non atomique | Review 2026-06-19 | closed |
| DEBT-010 | medium | Settlements non rejouables : throw après 20 retries, pas de dead-letter | Review 2026-06-19 | deferred |
| DEBT-011 | medium | Routes économiques acceptent `anonymous` ; pas de rate limit | Review 2026-06-19 | closed |
| DEBT-012 | low | Scaffold Devvit visible (menu "Example form", routes `increment`/`decrement`) | Review 2026-06-19 | closed |
| DEBT-013 | low | `SETTLEMENT_ATTEMPTS`/`delay()` dupliqués entre modules serveur | Review 2026-06-19 | closed |
| DEBT-014 | low | Bumps mineurs `hono`/`vite` disponibles, non appliqués | Review 2026-06-19 | watching |
| DEBT-015 | medium | Verify manuels Phase 7 différés (playtest mobile réel, testeur neuf) | Phase 7 | open |

---

## DEBT-001 — Crédit des gains de pari non atomique
**Problème** : un crash serverless entre le claim et le crédit laisse le payout marqué
« réglé » sans que l'or soit jamais versé → perte silencieuse pour le joueur. Lost-update
aussi possible si un achat écurie tombe pendant le tick.
**Où** : `applyBetSettlement` ([src/server/core/dailyArena.ts](src/server/core/dailyArena.ts#L337-L356)). Pattern hérité de `applyArenaSettlement` ([src/server/core/stableStore.ts](src/server/core/stableStore.ts#L26-L43)).
**Action** : claim + crédit dans le **même** `MULTI` (à l'image du débit `placeCurrentBet`, déjà robuste via `WATCH`/`MULTI`/`EXEC`). Corriger aussi `applyArenaSettlement` (même faille).
**Résolu** : `applyBetSettlement` et `applyArenaSettlement` réécrits en `WATCH`/`MULTI`/`EXEC`
(claim + écriture du solde dans le même `EXEC`, retry borné sur abort, plus de claim orphelin
sans crédit). Payout perdant (`gold === 0`) garde un simple `hSetNX` (aucun solde à corrompre).
**Moitié manquante (review 2026-06-19, finding T1)** : `stable.post('/action')` restait en
load-mutate-save sans `WATCH` — une dépense d'écurie concurrente d'un payout écrasait le crédit
(lost-update). Corrigé via `mutateStableAtomically` (read-modify-write sous `WATCH`/`MULTI`/`EXEC`,
retry borné, aucune écriture sur mutation refusée). Tous les writers de `stable:${user}` passent
désormais par `WATCH`. Vérifié par `type-check`/`lint`/`build` ; couverture unitaire serveur reste sous `DEBT-004`.

## DEBT-002 — `settleBets` throw global bloque tous les payouts
**Problème** : si un featured n'est pas retrouvé dans le bracket, le throw avorte **tout**
le règlement des paris du jour, définitivement (arène déjà `resolved` → re-throw au re-tick).
Aujourd'hui inactif (les featured sont garantis en tête de bracket), mais une assertion qui
casse tout au lieu de skipper le ticket fautif.
**Où** : `settleBets` ([src/shared/betting/model.ts](src/shared/betting/model.ts#L72-L101)).
**Action** : skip + log le ticket non résolvable au lieu de throw.
**Résolu** : `settleBets` itère et `continue` (avec `console.warn`) sur un ticket dont le featured
ou le bracket est introuvable, au lieu de throw — les paris valides du jour sont réglés.
Test : `test/betting/model.test.ts` « skips an unresolvable ticket… ».

## DEBT-003 — `placeCurrentBet` plante si la transaction WATCH est avortée
**Problème** : `results.length !== 2` lève une `TypeError` si `exec()` rend `null`
(WATCH avorté par un achat écurie concurrent du même user). Rare, message cryptique ;
pas de débit erroné cependant.
**Où** : `placeCurrentBet` ([src/server/core/dailyArena.ts](src/server/core/dailyArena.ts#L152-L153)).
**Action** : traiter `results == null` comme « betting is busy ».
**Résolu** : garde `if (!results || results.length !== 2)` — un `EXEC` avorté lève désormais
« betting is busy » au lieu d'une `TypeError`.

## DEBT-004 — Couche serveur non testée
**Problème** : 0 test sur atomicité / idempotence / no-double-débit alors que c'est là que
sont les risques (DEBT-001/002/003). Le domaine pur, lui, est bien couvert.
**Action** : fake Redis in-memory (ou harness de test serveur) pour couvrir les invariants
économiques. Chantier → post-submission si la deadline serre.

## DEBT-005 — Vulnérabilités npm héritées du scaffold
**Problème** : `npm audit --omit=dev` → 37 vulns (dont 6 high), chaînes Hono/Devvit/Vite.
Les fixes sortent des versions figées par le scaffold ou sont cassantes.
**Action** : surveillé via `.github/dependabot.yml`. Réévaluer avant submission (Phase 8).
**Réévaluation 2026-07-02** : 32 vulns (2 low, 24 moderate, **6 high**). Les 6 high :
- `hono` (path traversal `serve-static` Windows + Set-Cookie Lambda — aucune des deux ne
  s'applique au runtime Devvit) → **fix non cassant : hono 4.12.27** (patch).
- `vite` (launch-editor NTLM + `server.fs.deny` bypass, dev-time) → **fix non cassant : vite 8.1.3** (minor).
- `@devvit/cli`, `tmp`, `ws`, `protobufjs` → fix = `devvit@1.0.0` (**major**, couplé plateforme)
  ou downgrade `@devvit/web` : à NE PAS toucher avant la deadline.
Recommandation : bumper `hono` + `vite` (+ éventuellement `@devvit/*` 0.13.4→0.13.6, patch)
en Phase 8 **après feu vert humain**, rejouer les 4 verify + un playtest. Aucun bump appliqué.

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
**Note review 2026-06-19** : les 3 reviewers confirment le favori +EV → bumpé `low` → `medium` (finding T8).

---

> Findings versés depuis la review multi-LLM `reviews/range-critical-2026-06-19-1956`
> (settlements durcis, mais races Redis résiduelles non couvertes). Tickets T3/T4/T5/T9.

## DEBT-008 — Claim `'creating'` du post quotidien sans TTL
**Problème** : le claim `'creating'` dans `POST_CLAIMS_KEY` n'a pas d'expiration. Un crash
serverless entre le claim et la création du post laisse un claim zombie qui bloque toute
re-création du post du jour.
**Où** : `dailyArena.ts:242-267` (review, finding T3).
**Action** : remplacer le field hash `'creating'` par une clé `SET NX EX` par jour avec TTL.
**Résolu** : le claim est désormais une clé dédiée `arena:post-claim:<day>` posée via
`redis.set(key, 'creating', { nx: true, expiration })` (`POST_CLAIM_TTL_MS` = 60s, à côté de
`BETTING_LOCK_TTL_MS`). Un crash entre le claim et la création du post laisse expirer la clé au
lieu de bloquer indéfiniment. `arena.postId` (persisté par `saveArena`) reste la source de
vérité : sur claim déjà pris, on recharge l'arène du jour et on renvoie son `postId` s'il existe,
sinon on throw comme avant.

## DEBT-009 — `withBettingLock` libère le lock non atomiquement
**Problème** : la libération fait `get` puis `del` en deux temps. Fenêtre où le lock d'un autre
process peut être supprimé par erreur. Faible probabilité, pas de corruption d'or directe.
**Où** : `dailyArena.ts:372-395` (review, finding T4).
**Action** : libération atomique via Lua/`EVAL` si dispo, ou supprimer le `del` et laisser le TTL expirer.
**Résolu** : le client redis Devvit (`@devvit/web@0.13.4`) n'expose pas d'`EVAL`/Lua. La libération
passe par `WATCH`/`MULTI`/`EXEC` (même pattern que `applyBetSettlement`/`placeCurrentBet`) : `get`
sous `WATCH`, puis `del` dans le `MULTI` si le token correspond encore. Un `exec()` qui rend `null`
signifie que la clé a changé entre-temps (déjà reprise ou effacée par quelqu'un d'autre) — ce n'est
pas une erreur, rien à faire de plus.

## DEBT-010 — Settlements non rejouables (pas de dead-letter)
**Problème** : un settlement échoue définitivement après 20 retries, traité séquentiellement, sans
file de retry ni dead-letter. Un payout durablement contendu reste impayé sans trace exploitable.
**Où** : `dailyArena.ts:231-237/369`, `stableStore.ts` (review, finding T5).
**Action** : journaliser les settlements échoués et permettre un retry idempotent. Chantier → couplé
au harness de test serveur (`DEBT-004`), post-submission si la deadline serre.

## DEBT-011 — Routes économiques : `anonymous` accepté, pas de rate limit
**Problème** : plusieurs routes font `getCurrentUsername() ?? 'anonymous'` — un utilisateur non
authentifié partage l'écurie/le solde `anonymous`. Aucun rate limit sur les routes de dépense.
**Où** : `arena.ts:21/66/90`, `stable.ts:18/24`, `api.ts:45` (review, finding T9).
**Action** : refuser `anonymous` sur les routes à enjeu (or, paris) ; rate limit simple sur les dépenses.
**Résolu (version minimale)** : `POST /stable/action`, `POST /arena/bet` et `POST /arena/enter`
renvoient désormais `401 authentication required` si `getCurrentUsername()` échoue, au lieu de
retomber sur `'anonymous'`. Les routes de lecture pure (`GET /stable`, `GET /arena`, `/init`)
gardent le fallback `anonymous` — pas d'enjeu économique. Rate limiting non implémenté (hors
budget de cette passe) ; à traiter séparément si besoin.

## DEBT-012 — Scaffold Devvit visible
**Problème** : le scaffold du template Devvit est encore visible et nuit à la crédibilité d'une
soumission — le menu « Example form » (`devvit.json:30`) et les routes `increment`/`decrement`
(`src/server/routes/api.ts:60-98`) sont du code de démarrage inutilisé.
**Où** : `devvit.json:30`, `src/server/routes/api.ts:60-98` (review, finding T6).
**Action** : à retirer en Phase 7/8.
**Résolu** (Phase 7, commit `3586d8a`) : retirés le menu « Example form » + mapping `forms`
(`devvit.json`, `routes/forms.ts` supprimé), les routes compteur `/api/init`/`increment`/
`decrement` + leurs types partagés (le `/init` n'était appelé que par la scène template morte),
les scènes Game/GameOver inatteignables (rien n'y naviguait depuis MainMenu → Stable) et
`public/snoo.png` (le splash réécrit en Phase 7 n'y référence plus). Périmètre un peu plus large
que le ticket (scènes + `/init`) : même unité de scaffold, retirée d'un bloc.

## DEBT-013 — Retry/délai de settlement dupliqués
**Problème** : la constante `SETTLEMENT_ATTEMPTS` et la fonction `delay()` sont redéfinies dans
plusieurs modules serveur au lieu d'être partagées. Pure duplication, aucun comportement incorrect.
**Où** : `dailyArena.ts`, `stableStore.ts` (review, finding SUMMARY-kimi T4).
**Action** : extraire dans un module commun. Non bloquant, cosmétique.
**Résolu** (Phase 7) : `SETTLEMENT_ATTEMPTS` et `delay()` vivent désormais dans
[src/server/core/settlement.ts](src/server/core/settlement.ts), importés par `dailyArena.ts` et
`stableStore.ts`. Valeurs et comportement inchangés (les 4 verify auto passent à l'identique).

## DEBT-014 — Bumps mineurs `hono`/`vite` disponibles
**Problème** : des versions mineures plus récentes de `hono`/`vite` existent, non appliquées.
**Où** : `package.json` (review, finding SUMMARY-kimi T9).
**Action** : surveillé avec `DEBT-005`, réévaluer avant submission (Phase 8).
**Réévaluation 2026-07-02** (`npm outdated`) : `hono` 4.12.21→4.12.27 (patch, corrige un high
DEBT-005), `vite` 8.0.13→8.1.3 (minor, corrige un high), `@devvit/*` 0.13.4→0.13.6 (patch),
`phaser` 4.1.0→4.2.0 (minor — ne pas bumper sans re-tester le rendu), outillage dev
(eslint/prettier/typescript-eslint) sans enjeu. Décision et application couplées à DEBT-005.

## DEBT-015 — Verify manuels Phase 7 différés
**Problème** : la passe viewport/onboarding de la Phase 7 (commits `a67b5ae`, `d851e65`) est
validée par les 4 verify auto et par calcul de géométrie, mais **pas à l'œil sur appareil réel**.
Deux Verify de phase restent non satisfaits : (a) jouable sur mobile réel sans scroll ni
chevauchement (layouts compacts Stable < 820 px et Betting < 640 px jamais affichés sur un
téléphone), (b) un testeur neuf joue un cycle complet sans explication externe.
**Où** : `phases/PHASE-7-art.md` §Verify.
**Action** : `npm run dev` (playtest Reddit) sur téléphone + un cobaye humain avant de passer
la Phase 7 `done`. Aggravant : le sub-agent qui a produit le layout Stable compact a été coupé
en cours de route (travail terminé à la main) — contrôle visuel d'autant plus nécessaire.
