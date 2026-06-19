# PHASE 7 — Art & polish
Status: not-started
Harness: —

## Goal
Pipeline silhouette IA-proof, remplacement des placeholders, fit viewport/mobile, onboarding clair.

## Context
- Read: AGENTS.md, CONCEPT.md (Art).
- Dépend de: PHASE-2 (rendu). Avance en continu, avec un bloc final dédié.

## Touches
- `assets/`, `src/client` (intégration sprites), pipeline de génération / post-process.

## Tasks
- [ ] Pipeline : génération IA des silhouettes égéennes → post-process seuillage 2 tons (consistance forcée).
- [ ] Remplacer les formes blanches par les silhouettes (arme = identité visuelle).
- [ ] Fit viewport (desktop + mobile), zéro scroll, UI dans le cadre.
- [ ] Onboarding : un nouveau joueur comprend sans notice (le post de démo s'auto-explique).

## Verify
- Tient dans le viewport, jouable sur mobile.
- Un testeur neuf joue un cycle complet sans explication externe.
- Aucune dérive de style entre assets (le seuillage uniformise).

## Handoff
(prompts / refs du pipeline, assets manquants, points de friction onboarding)
