# PHASE 0 — Setup Devvit + Phaser
Status: in-progress
Harness: claude (cadrage + merge repo) → toi (auth Reddit + playtest)

## Goal
Un post Devvit de playtest affiche un canvas Phaser qui tourne.

## Context
- Read: AGENTS.md, CONCEPT.md (Stack technique).
- Dépend de: — (point de départ).
- ⚠️ Besoin humain : compte Reddit dev (developers.reddit.com), `devvit login`, Node installé.

## Touches
- Racine projet (init Devvit Web), `src/client`, config `devvit.*`, `package.json`.

## Tasks
- [x] Node : 24 OK (`engines: >=22.2.0`), install validée. Pas de downgrade nécessaire.
- [x] Scaffold : `npm create devvit@latest --template=phaser` → app `kleos-arena`.
- [x] Consolidation : docs de planif + AGENTS.md fusionné dans `kleos-arena` (repo canonique).
- [x] Structure réelle figée dans CONCEPT.md + AGENTS.md (§2).
- [ ] `npm run dev` (= `devvit playtest`) : un canvas Phaser s'affiche dans un post de playtest. ← reste (auth Reddit + subreddit de test).

## Verify
- Un post de playtest rend un canvas Phaser visible et interactif.
- La structure `src/client` / `src/server` / `src/shared` est confirmée et notée dans CONCEPT.md.

## Handoff
- **Stack réel** : Phaser 4.1.0, Vite 8, TS 6, Hono 4, devvit 0.13.4. Node >=22.2.0 (24 OK).
- **Structure** : `src/client` (game.ts + scenes Boot/Preloader/MainMenu/Game/GameOver, splash.ts) ·
  `src/server` (index.ts Hono, core/post.ts, routes/ api·forms·menu·triggers) · `src/shared` (api.ts).
  Plus `public/`, `tools/`, `devvit.json`, `vite.config.ts`.
- **Repo canonique** : `kleos-arena` (git `main`, root-commit créé au merge). Ancien dossier
  `Hackaton Reddit 2026` superseded (planif copiée) → supprimable.
- **Reste** : playtest non lancé (besoin auth Reddit + subreddit de test). Aucun runner de test (→ Phase 1, vitest).
