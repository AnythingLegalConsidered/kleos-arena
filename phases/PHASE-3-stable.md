# PHASE 3 — Écurie & progression
Status: not-started
Harness: —

## Goal
Le joueur gère une écurie persistante entre les combats.

## Context
- Read: AGENTS.md, CONCEPT.md (Personnages & progression, Progression persistante).
- Dépend de: PHASE-0 (peut avancer en parallèle de 1-2).

## Touches
- `src/client` (UI écurie), `src/server` (KV), `src/shared` (modèles).

## Tasks
- [ ] Roster (3 gladiateurs) ; modèle perso = attributs + aptitude aléatoire + arme.
- [ ] Points d'attribut + petites échelles de 3-4 perks par attribut.
- [ ] Armes aléatoires (archétypes antiques) à la recrue.
- [ ] Économie : or / faveur (gagner, dépenser : level, soin, stuff).
- [ ] Persistance Redis/KV : roster + éco survivent à la fermeture du post.

## Verify
- Gérer son écurie entre deux combats modifie réellement la sim suivante.
- Fermer puis rouvrir le post : l'état est restauré à l'identique.

## Handoff
(schéma KV, modèle de données perso, ce qui reste à équilibrer)
