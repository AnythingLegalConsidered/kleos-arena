# PHASE 7 — Art & polish
Status: in-progress
Harness: Claude Code (Fable 5)

## Goal
Pipeline silhouette IA-proof, remplacement des placeholders, fit viewport/mobile, onboarding clair.

## Context
- Read: AGENTS.md, CONCEPT.md (Art).
- Dépend de: PHASE-2 (rendu). Avance en continu, avec un bloc final dédié.

## Touches
- `assets/`, `src/client` (intégration sprites), pipeline de génération / post-process.

## Tasks
- [x] Pipeline : post-process seuillage 2 tons (consistance forcée) — `scripts/silhouette/` (CLI + cœur pur testé).
- [ ] Génération des silhouettes égéennes sources — **étape humaine, bloquée** : aucun outil de génération d'images dans les harnais. Prompts et contraintes prêts dans `scripts/silhouette/README.md`.
- [ ] Remplacer les formes blanches par les silhouettes (arme = identité visuelle) — **bloqué par l'absence de sources** (dépend de la tâche ci-dessus). Point de branchement : `bodyShape()`/`makeBody()` dans `src/client/scenes/Arena.ts`.
- [x] Fit viewport (desktop + mobile), zéro scroll, UI dans le cadre.
- [x] Onboarding : un nouveau joueur comprend sans notice (le post de démo s'auto-explique).

## Verify
- Tient dans le viewport, jouable sur mobile. → **deferred** (vérifié par calcul et par les 4 verify auto, pas sur appareil réel — DEBT-015)
- Un testeur neuf joue un cycle complet sans explication externe. → **deferred** (DEBT-015)
- Aucune dérive de style entre assets (le seuillage uniformise). → **non testable** tant qu'aucun asset source n'existe ; le test unitaire garantit déjà une sortie strictement 2 tons.

## Handoff

### Fait (2026-07-02, verify auto 4/4 : test 57 ✔ · type-check ✔ · lint ✔ · build ✔)
- **Pipeline silhouette** (`2c3c439`) : `node scripts/silhouette/cli.mjs --in <png|dir> --out <dir>` — seuillage 2 tons, Otsu par image (déterministe), `--invert`, `--fg/--bg` (défaut `#14110d`/transparent), warning si ratio figure < 2 % ou > 90 %. Cœur pur RGBA sans dépendance (14 tests) ; `pngjs` en devDependency pour l'I/O uniquement. Validé bout-en-bout sur image synthétique.
- **Fit viewport** (`a67b5ae`) : Stable passe en layout compact empilé sous 820 px (cartes 124 px, touch targets ≥ 32 px) ; Betting empile les équipes par duel sous 640 px (noms longs tronqués, footer déplacé à côté du bouton retour) ; Preloader centré dynamiquement ; flash bleu template supprimé ; titre `KLEOS`.
- **Onboarding** (`d851e65`) : splash feed = pitch statique KLEOS (palette égéenne, CTA « OUVRIR L'ARÈNE », zéro asset) ; MainMenu = écran-titre qui enseigne la boucle (3 étapes numérotées + hook bracket nocturne, bouton « ENTRER DANS L'ARÈNE »). Fuite du listener resize de MainMenu corrigée au passage.
- **DEBT-012 fermée** (`3586d8a`) : menu « Example form », routes `/init`/`increment`/`decrement`, scènes template Game/GameOver (inatteignables), `snoo.png` — tout le scaffold Devvit retiré.

### Reste
1. **Générer les silhouettes sources** (humain) : prompts par archétype + contraintes dans `scripts/silhouette/README.md`. Sortie suggérée : `public/assets/gladiators/<archetype>.png`.
2. **Brancher les sprites** : remplacer `bodyShape()` dans `Arena.ts` par des `Image` chargées au Preloader ; garder `BODY_RADIUS` comme échelle (barres PV, knockback) et le liseré `setStrokeStyle` pour la couleur d'équipe.
3. **Verify manuels** (DEBT-015) : playtest sur téléphone réel (`npm run dev`) + testeur neuf sur un cycle complet.
4. **Review cross-harnais avant `done`** : non faite dans cette passe (la phase reste ouverte) — obligatoire avant de fermer.

### Pièges / frictions notées
- Le sub-agent viewport a été coupé par une limite de session en plein vol : ses helpers `text()`/`button()` de Stable ont été finis à la main et `Betting.ts` écrit entièrement après coup. Le layout compact est vérifié **par calcul**, pas à l'œil — d'où DEBT-015.
- En mode empilé (Betting < 640 px), le libellé chiffré « FERVEUR x/y » disparaît (seule la barre reste) — jugé acceptable, à revalider à l'œil.
- Frictions onboarding hors périmètre de cette passe (remontées par la review du travail) : le Stable n'explique pas OR/attributs/perks au premier contact ; « la ferveur fait basculer les combats serrés » n'est écrit nulle part en jeu ; pas d'écran « retour du lendemain » qui mette en scène le résultat du bracket (le hook du MainMenu le promet). Candidats pour le bloc final de la phase ou le BACKLOG.
