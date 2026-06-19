# AGENTS.md — KLEOS (protocole multi-harnais)

> Lu **nativement** par Codex CLI et OpenCode. Claude Code y accède via `CLAUDE.md`.
> But unique : **tout agent, quel que soit le harnais, démarre avec le MÊME contexte.**
> Ce fichier = (1) notre protocole de travail, (2) le contrat technique de la plateforme Devvit Web.

---
# 1. Protocole de travail

## Contexte obligatoire — charger DANS CET ORDRE avant toute action
1. `AGENTS.md` (ce fichier) — protocole + contrat plateforme.
2. `CONCEPT.md` — le design produit. **Source de vérité. LOCKED.**
3. `ROADMAP.md` — l'état des phases.
4. `phases/PHASE-N.md` — la phase en cours.

Tu ne commences à coder qu'après 1→4. Aucune exception.

## Le design est figé
Les sections **LOCKED** de `CONCEPT.md` ne se rediscutent pas en exécution. Besoin réel de
changement → tu t'arrêtes, tu écris la proposition dans le `Handoff` de la phase, tu ne modifies
`CONCEPT.md` **qu'après validation humaine**. Jamais de dérive silencieuse.

## Comment travailler une phase
1. Prends la prochaine phase `not-started` sans dépendance ouverte (`ROADMAP.md`).
2. `phases/PHASE-N.md` : `Status: in-progress`, renseigne `Harness:`.
3. Fais les `Tasks` (coche `- [x]`).
4. Satisfais les `Verify`. Deux natures, à ne pas confondre :
   - **Verify auto** (`test`, `type-check`, `lint`, `build`) → **bloquant**. Tant qu'un échoue,
     la phase n'est pas `done`. C'est ça "done", pas "ça compile".
   - **Verify manuel** (playtest Reddit, contrôle visuel) → si non fait, ne le marque PAS
     satisfait : note-le `deferred` dans le `Handoff` **et** ouvre une ligne dans `DEBT.md`.
     Jamais de `Verify` silencieusement sauté.
5. Commits **atomiques** : 1 unité cohérente = 1 commit, message anglais impératif. Ajoute un
   trailer `Assisted-by: <harnais>` (ex. `Assisted-by: Codex GPT-5`) pour tracer qui a produit quoi.
6. **Review cross-harnais avant `done`** : un harnais ≠ celui qui a codé relit la phase (ou
   `/review-multi`). Les findings partent corrigés dans le `Handoff`, ou différés dans `DEBT.md`.
   Une phase ne passe pas `done` avec un finding **bloquant** non traité.
7. MAJ `Handoff` (fait / reste / pièges) = le bâton de relais.
8. `Status: done`, puis MAJ `ROADMAP.md`.

## Discipline de code
- **Surgical** : chaque ligne trace au besoin de la phase. Pas de refactor adjacent. Garde le style existant.
- **Goal-driven** : bug → écris d'abord le test qui le reproduit.
- **Mutation d'or / d'économie partagée = atomique**. `WATCH`/`MULTI`/`EXEC`, ou claim `hSetNX` +
  écriture dans le **même** `MULTI`. Jamais "claim puis write" en deux temps : un crash serverless
  entre les deux corrompt le solde (cf. `DEBT-001`).
- Code et commentaires **en anglais**. Docs / prose / `Handoff` **en français**.
- Aucune dépendance nouvelle sans raison forte.

## Ne touche PAS
Le **BACKLOG** de `CONCEPT.md` (multi-civilisations, itémisation profonde, dieux partagés). Hors-scope v1.

---
# 2. Contrat technique — Devvit Web (plateforme)

> App Devvit Web exécutée sur Reddit.com. Stack : **Phaser 4 + Vite** (client),
> **Hono sur Devvit serverless** (backend), **TypeScript**. Node serverless v22.

## Layout
- `src/server` — **backend**, environnement serverless sécurisé. Accès `redis`, `reddit`, `context`
  via `@devvit/web/server`. Entrée : `index.ts` (app Hono). Routes dans `routes/`.
- `src/client` — **frontend**, exécuté dans une iFrame sur reddit.com. Entrypoints = fichiers HTML
  mappés dans `devvit.json` :
  - `game.html` — vue étendue (le jeu Phaser).
  - `splash.html` — vue inline dans le feed. **Garde-la rapide** ; dépendances lourdes dans `game.html`.
- `src/shared` — code partagé client↔serveur (← le module de **sim déterministe** va ici).

## Règles plateforme (sous peine de casse)
- Navigation : `navigateTo` de `@devvit/web/client`, jamais `window.location`.
- Pas de `window.alert` → `showToast` / `showForm` de `@devvit/web/client`.
- Pas de géoloc / caméra / micro / notifications (aucune alternative).
- Pas de `<script>` inline dans le HTML → fichier js/ts séparé.
- **N'utilise PAS** `@devvit/public-api` ni les "blocks" : ce projet est Devvit **Web** uniquement.
- Nouvel endpoint pour une action de menu → ajoute le mapping dans `devvit.json`.

## Commands
- `npm run dev` — playtest live sur Reddit (`devvit playtest`).
- `npm run build` — build Vite. `npm run type-check` — `tsc --build`. `npm run lint` — eslint. `npm run prettier`.
- `npm run deploy` — type-check + lint + `devvit upload`. `npm run launch` — deploy + publish. `npm run login`.
- **CI** : `.github/workflows/ci.yml` rejoue `type-check` + `lint` + `test` + `build` sur chaque push / PR (jamais de deploy).

## Code style (template)
- Préfère les `type` aux `interface`. Exports **nommés**. Ne **cast** jamais les types TS.

## Notes scaffold (état réel, vérifié)
- **Phaser 4.1.0** (pas 3). **Node >=22.2.0** (Node 24 OK, install validée).
- Pas de tRPC dans ce scaffold malgré d'anciennes mentions du template : communication via routes Hono
  (`src/server/routes/api.ts`) + `src/shared/api.ts`.
- **Tests : vitest configuré** (`vitest.config.ts`). Scripts `npm test` (run) et `npm run test:watch`.
  Suites dans `test/` (sim, daily, stable, betting, client). La couche **serveur** (atomicité,
  idempotence, concurrence Redis) n'est PAS couverte — cf. `DEBT-004`.

Docs Devvit (pour agents) : https://developers.reddit.com/docs/llms.txt
