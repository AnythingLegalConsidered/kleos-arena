# PHASE 5 — Pari=vote & ferveur
Status: done
Harness: Codex GPT-5

## Goal
Parier = voter : la mise ajoute de la ferveur (bornée), l'outsider paie plus, les gains vont à l'écurie.

## Context
- Read: AGENTS.md, CONCEPT.md (La ferveur, Mécaniques sociales).
- Dépend de: PHASE-4 (bracket + tick).

## Touches
- `src/client` (UI pari sur combats featured), `src/server` (cotes, ferveur, payouts au tick).

## Tasks
- [x] UI : parier de l'or sur 2-3 combats featured d'autres écuries.
- [x] Cotes : l'outsider paie davantage (marché auto-équilibré).
- [x] La mise ajoute de la ferveur à l'écurie misée.
- [x] Ferveur **bornée** appliquée au tick : penche les combats serrés, n'écrase pas la force.
- [x] Payouts au tick : or crédité à l'écurie du parieur.

## Verify
- Parier sur l'outsider rapporte plus que sur le favori.
- La ferveur n'inverse QUE des combats serrés (test : gros écart de force → pas d'inversion).
- Les gains de pari atterrissent bien dans l'or de l'écurie.

Validé par `npx vitest run` (36/36), `npm run type-check`, `npm run lint` et
`npm run build`. La scène Phaser a aussi été testée à `1280x720` contre une API locale
contrôlée : choix de mise, débit d'or, hausse de ferveur et verrouillage du ticket fonctionnent,
sans erreur console. Le playtest Reddit live n'a pas été lancé dans cette session.

## Handoff
**Marché / cotes** :
- Trois duels featured sont figés au premier accès dans `arena:featured:{day}` et verrouillés comme
  premiers matchs du bracket. L'API masque le duel du joueur : il voit donc 2 ou 3 autres combats.
- Puissance d'une équipe = somme Force + Agilité + Résilience après le dieu du jour. Cote décimale =
  `(puissance A + puissance B) / puissance de l'équipe`, arrondie à 2 décimales et bornée `[1.2, 4]`.
  L'arme n'entre pas encore dans l'estimation : tuning possible sans changer le contrat.
- Une mise autorisée vaut 10, 25 ou 50 or. Un seul ticket par joueur et duel ; l'or est débité
  immédiatement. Le serveur dérive la cote et refuse l'auto-pari, les équipes inconnues et le marché fermé.

**Ferveur / résolution** :
- `arena:bets:{day}` porte les tickets. Les mises d'une équipe s'additionnent avec un plafond de
  **100 ferveur**. Le bonus est linéaire de `+0` à `+2` sur chacun des trois attributs.
- Un combat est **serré** si `abs(A-B) / max(A,B) <= 15 %` sur les puissances initiales. Au-delà,
  la config de combat reste strictement inchangée, même avec 100 ferveur.
- Le verrou `arena:betting-lock:{day}` sérialise mises et tick. La ferveur accompagne ensuite l'équipe
  dans les tours suivants ; seuls les joueurs réellement inscrits ce jour reçoivent le règlement bracket.

**Payouts / gotchas** :
- Gain total d'un ticket gagnant = `floor(mise * cote)` ; perdant = 0. Les crédits idempotents vivent
  dans `arena:bet-payouts:{day}` et sont appliqués après les récompenses du bracket.
- Le premier accès fige les affiches : un entrant tardif rejoint le reste du bracket mais ne devient pas
  featured ce jour. Le ticket et le débit du blob de stable sont écrits atomiquement par `MULTI/EXEC`.
- `npm audit --omit=dev` signale 37 vulnérabilités héritées du scaffold (Hono/Devvit/Vite, dont 6 high).
  Les corrections proposées sortent des versions figées ou sont cassantes ; aucune mise à jour hors phase.
