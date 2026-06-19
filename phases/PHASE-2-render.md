# PHASE 2 — Rendu Phaser + juice
Status: not-started
Harness: —

## Goal
Phaser dessine la sim de façon nerveuse ; le replay d'un seed = le combat live.

## Context
- Read: AGENTS.md, CONCEPT.md (Art, Modèle de combat spatial).
- Dépend de: PHASE-1 (la sim + sa timeline).

## Touches
- `src/client/scenes/Arena*`, couche de rendu, effets.

## Tasks
- [ ] Rendu de l'état sim avec **formes blanches** (PAS d'art final — placeholders).
- [ ] Interpolation : le rendu **lit** la sim, ne la pilote jamais.
- [ ] Juice : screen shake, hit-pause, knockback, particules (poussière/étincelles), popups dégâts.
- [ ] Slow-mo sur les kills, rugissement de foule qui enfle.
- [ ] Mode replay : rejouer un seed donne exactement le même déroulé visuel.

## Verify
- Le clash *feel* nerveux/VS (jugement subjectif assumé, mais le juice est présent et lisible).
- `Replay(seed) == combat live` (frame de résolution identique).
- Tient à ~60fps sur mobile milieu de gamme.

## Handoff
(liste des effets, ce qui manque côté feel, params de tuning du juice)
