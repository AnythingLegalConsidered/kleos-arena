# PHASE 2 — Rendu Phaser + juice
Status: done
Harness: claude

## Goal
Phaser dessine la sim de façon nerveuse ; le replay d'un seed = le combat live.

## Context
- Read: AGENTS.md, CONCEPT.md (Art, Modèle de combat spatial).
- Dépend de: PHASE-1 (la sim + sa timeline).

## Touches
- `src/client/scenes/Arena*`, couche de rendu, effets.

## Tasks
- [x] Rendu de l'état sim avec **formes blanches** (PAS d'art final — placeholders).
- [x] Interpolation : le rendu **lit** la sim, ne la pilote jamais.
- [x] Juice : screen shake, hit-pause, knockback, particules (poussière/étincelles), popups dégâts.
- [x] Slow-mo sur les kills, rugissement de foule qui enfle.
- [x] Mode replay : rejouer un seed donne exactement le même déroulé visuel.

## Verify
- Le clash *feel* nerveux/VS (jugement subjectif assumé, mais le juice est présent et lisible).
  → effets implémentés et lisibles ; **confirmation « feel » = playtest humain** (`npm run dev`), non automatisable ici.
- `Replay(seed) == combat live` (frame de résolution identique).
  → ✅ vérifié headless : `test/client/playback.test.ts` (deux playbacks du même seed → flux sample/events identiques ; events émis == events sim).
- Tient à ~60fps sur mobile milieu de gamme.
  → conçu pour (≤ ~12 objets, pools de particules, alloc/frame minime) ; **mesure réelle = playtest humain**, non faite ici.

## Handoff
**Architecture rendu** : le rendu est une **lecture pure** de la sim, jamais un pilote.
- `simulate(config)` tourne **une fois** dans `Arena.create()` → `BattleResult`. Le rendu ne le rejoue pas, il l'échantillonne.
- `src/client/arena/playback.ts` — `BattlePlayback(result, specs)` : interpole les frames (30 ticks/s → 60 fps),
  `advance(dt)` → events franchis (chrono, 1×), `sample()` → `SampledUnit[]` (pos interpolées + hp + alive + team + weapon).
  `maxHp` déduit de la frame 0 (spawn = vie pleine) → **zéro recouplage** aux coeffs de `unit.ts`. `setSpeed()` = time-warp.
- `src/client/arena/demoBattle.ts` — `demoBattleConfig()` : 3v3 fixe (seed `0x6b1e05`) avec builds contrastés
  (spear/sword_shield/axe/bow ×2 camps). **Placeholder** jusqu'à ce que la Phase 3/4 câble de vrais rosters.
- `src/client/scenes/Arena.ts` — scène Phaser. Fit monde→écran responsive (recalc au `resize`), bornes calculées
  sur **toutes** les frames (rien ne sort du champ).

**Silhouettes (formes blanches)** : triangle=spear · carré=sword_shield · losange=axe · cercle=bow. Fill blanc,
contour teinté équipe (rouge/bleu) pour lisibilité. Barre de vie au-dessus. Mort = fade + burst de poussière.

**Effets (tuning centralisé dans `const JUICE` en haut d'`Arena.ts`)** :
- hit-flash (fill ambré + squash 1.35×) · knockback cosmétique (offset décroissant, **ne touche pas** la pos sim)
- popups dégâts (+ « MISS » sur esquive ; or sur kill) · étincelles (ADD) au contact · poussière au déplacement
- screen shake gradué au dégât · hit-pause à l'impact · **slow-mo sur kill** (`slowMoFactor` 0.35, 420 ms)
- **fervor/rugissement de foule** : jauge + vignette dont la baseline **enfle** avec l'avancement du combat,
  spikes sur hits/kills puis décroissance. (Visuel only — **pas d'audio** : aucun asset son, contrainte Devvit. Audio = stretch Phase 7.)
- Replay : `tap` ou touche `R` → `playback.reset()` + reset des effets. Déterminisme garanti (même `BattleResult`).

**Verify machine** : `npm test` 15/15 · `npm run type-check` OK · `npm run lint` OK · `npm run build` OK.

**Pièges / dette pour la suite** :
- `Arena` utilise `this.views.find(id)` par unité/frame (O(n), n=6 → ok). Rosters plus gros → passer en `Map<id,view>`.
- Scaffold template **orphelin** depuis le reroute : `scenes/Game.ts` (compteur /api/init) + `GameOver.ts` toujours
  enregistrés dans `game.ts` mais plus atteints ; `MainMenu` affiche encore logo/texte template. **Non supprimé** (règle surgical) — à nettoyer/réskinner en Phase 7 (art & polish).
- Tuning combat (`weapons.ts`/`unit.ts`) toujours brut : certains combos finissent vite/lentement. Équilibrage = Phase 4+.
- `npm run dev` (`devvit playtest`) = chemin de validation visuelle ; non lancé ici (auth Reddit + subreddit live, action sortante).
