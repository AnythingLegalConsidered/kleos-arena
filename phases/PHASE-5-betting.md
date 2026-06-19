# PHASE 5 — Pari=vote & ferveur
Status: not-started
Harness: —

## Goal
Parier = voter : la mise ajoute de la ferveur (bornée), l'outsider paie plus, les gains vont à l'écurie.

## Context
- Read: AGENTS.md, CONCEPT.md (La ferveur, Mécaniques sociales).
- Dépend de: PHASE-4 (bracket + tick).

## Touches
- `src/client` (UI pari sur combats featured), `src/server` (cotes, ferveur, payouts au tick).

## Tasks
- [ ] UI : parier de l'or sur 2-3 combats featured d'autres écuries.
- [ ] Cotes : l'outsider paie davantage (marché auto-équilibré).
- [ ] La mise ajoute de la ferveur à l'écurie misée.
- [ ] Ferveur **bornée** appliquée au tick : penche les combats serrés, n'écrase pas la force.
- [ ] Payouts au tick : or crédité à l'écurie du parieur.

## Verify
- Parier sur l'outsider rapporte plus que sur le favori.
- La ferveur n'inverse QUE des combats serrés (test : gros écart de force → pas d'inversion).
- Les gains de pari atterrissent bien dans l'or de l'écurie.

## Handoff
(formule de cote, plafond de ferveur, définition de "combat serré")
