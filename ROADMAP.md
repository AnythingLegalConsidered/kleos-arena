# ROADMAP — KLEOS

Build order ~27j (solo, part-time), deadline **2026-07-15 18:00 PT**.
Design : `CONCEPT.md`. Protocole d'exécution : `AGENTS.md`.

## Phases
| # | Phase | Dépend de | Status |
|---|---|---|---|
| 0 | Setup Devvit + Phaser | — | done |
| 1 | Sim headless déterministe | 0 | done |
| 2 | Rendu Phaser + juice | 1 | done |
| 3 | Écurie & progression | 0 | done |
| 4 | Loop quotidienne & arène | 2, 3 | done |
| 5 | Pari=vote & ferveur | 4 | not-started |
| 6 | Rétention (streak, leaderboard) | 3 | not-started |
| 7 | Art & polish | 2 | not-started |
| 8 | Submission | tout | not-started |

## Chemin critique
**Phases 1-2 (le combat).** Si ça glisse : couper le stretch (flair, minijeu), simplifier —
**jamais** sacrifier le Polish des phases déjà finies (Polish est un critère équipondéré).

## Parallélisable
La Phase 3 (écurie) ne dépend que de la 0 → peut avancer en parallèle de 1-2.
La Phase 7 (art) avance en continu dès que la 2 existe, avec un bloc final dédié.

## Légende Status
`not-started` · `in-progress` · `done`. L'agent qui bosse met à jour cette ligne **et** le fichier phase.
