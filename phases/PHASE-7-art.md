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

### Fait (2026-07-02, seconde passe — bloc final onboarding + dette, verify auto 4/4 après chaque commit)
- **Ligne ferveur** (`338cace`) : « La ferveur fait pencher les duels serrés · jamais les écrasés » affichée sous le sous-titre de Betting (9 px sous 640 px, 11 px au-dessus) — friction (b) fermée.
- **Explication Stable** (`a2d5d66`) : bouton « ? » dans les deux headers (wide 40 px, compact 32 px) ouvrant un overlay tap-to-close « L'ÉCURIE EN BREF » : or, FOR/AGI/RES, coût des « +N », don à moitié prix, perks, soin, faveur, série — friction (a) fermée.
- **Écran retour du lendemain** (`f2c3be8`) : nouvelle scène `Recap` (« LE VERDICT DE LA NUIT ») montrée **une fois par session** quand `ArenaStatusResponse.result` existe : rang du bracket (champion mis en avant), +or/+faveur, gains de paris, série, blessés, teaser du dieu du jour, CTA vers l'écurie. Routage dans `Stable.loadData()` via `claimRecapPresentation()` (garde module, pas d'état serveur) — friction (c) fermée.
- **DEBT-013 fermée** (`8deae31`) : `SETTLEMENT_ATTEMPTS`/`delay()` extraits dans `src/server/core/settlement.ts`, importés par `dailyArena.ts` et `stableStore.ts`. Zéro changement de comportement.
- **DEBT-005/014 réévaluées + PHASE-8 récrite** (`bf1196b`) : 32 vulns prod (6 high) ; `hono` 4.12.27 et `vite` 8.1.3 corrigent 2 high sans casse — **aucun bump appliqué**, feu vert humain requis. PHASE-8 calée sur les règles Devpost + guide launch Devvit vérifiés (piège : README racine = encore le template scaffold → motif de rejet explicite ; review Reddit jusqu'à ~1 semaine → publier avant le 2026-07-08).

### Proposition DEBT-007 (analyse chiffrée 2026-07-02 — décision humaine requise, rien d'implémenté)
Mesure : ~4 800 sims déterministes (3 paires de bots, buffs +0..+8 par attribut, 200 seeds/cellule, dieu symétrique), scripts en scratchpad (non versionnés, reproductibles depuis `src/shared`).
- **La sim est quasi déterministe** : p(le plus fort gagne) ≥ 0,90 dès ~2 pts de share de force, = 1,000 dès ~4 pts (share 0,54). À share 0,500 exact, la composition d'armes donne p ≈ 0,99/0,01 — la share ignore les counters.
- **EV du favori clampé** (le cas du ticket, cote 1,2, p→1) : **+20 % garanti**. Mais le pire cas est ailleurs : favori à cote 1,4-2,0 → EV mesurée **+40 % à +98 %** par pari. « Toujours miser le favori affiché » ≈ +60 à +130 or/jour d'espérance (3 duels × 50 or) — plus que le champion du bracket (100 or) : la faille imprime de l'or.
- **Ferveur** : dans sa fenêtre (écart relatif ≤ 15 %), la ferveur max ne penche pas, elle **décide** (p 0,90 → 0,00 mesuré) ; hors fenêtre, zéro effet. Dans la zone serrée, p dépend donc surtout du différentiel de ferveur — c'est le vrai levier « auto-équilibré » du CONCEPT.

Options (EV favori clampé avant → après) :
- **A. Vig 8 % + clamp [1,05, 5]** (le simple tuning du ticket) : +20 % → +5 % au clamp, mais EV max mesurée reste **+82 %** hors clamp. Écartée par les chiffres — insuffisante seule.
- **B. Cotes par simulation — recommandée v1** : à `createFeaturedMatches`, estimer p̂ par mini-ensemble (~20-30 seeds dérivés + scénarios ferveur {0, cap} de chaque côté), cote = clamp((1−vig)/p̂, 1,05, 6), vig 8 %. EV ≈ −vig partout où p̂ est calibrée ; résidu +5 % max au plancher sur les duels pliés (cote 1,05 = signal honnête « aucune value », pousse les mises vers les duels serrés où la ferveur donne l'agentivité). Coût ~40-80 lignes (`shared/daily`+`betting`) + tests ; CPU mesuré < 2 s pour ~90 sims, 1×/jour sous lock. CONCEPT intact : « l'outsider paie plus » reste vrai et « marché auto-équilibré » devient défendable.
- **C. Parimutuel vig 8 % — backlog post-jam** : pool par duel, cote de règlement = (1−vig)·pool_total/pool_i → EV moyen = −vig structurellement, auto-équilibrage littéral. Coût moyen-haut : le champ `odds` figé du ticket saute, UI « cote estimée », `settleBets` réécrit, risque UX (« la cote a bougé »). Cold-start : seeder les pools avec les cotes B.
- Si B est retenue, le libellé CONCEPT « marché auto-équilibré » tient sans réécriture ; si on garde l'existant, il faudra le réécrire (section LOCKED → validation humaine explicite).

### Reste
1. **Générer les silhouettes sources** (humain) : prompts par archétype + contraintes dans `scripts/silhouette/README.md`. Sortie suggérée : `public/assets/gladiators/<archetype>.png`.
2. **Brancher les sprites** : remplacer `bodyShape()` dans `Arena.ts` par des `Image` chargées au Preloader ; garder `BODY_RADIUS` comme échelle (barres PV, knockback) et le liseré `setStrokeStyle` pour la couleur d'équipe.
3. **Verify manuels** (DEBT-015, humain) : playtest sur téléphone réel (`npm run dev`) + testeur neuf sur un cycle complet — étendu aux écrans de cette passe (overlay « ? », ligne ferveur, Recap).
4. **Décision DEBT-007** (humain) : trancher A/B/C ci-dessus avant toute implémentation.
5. **Review cross-harnais avant `done`** : non faite — obligatoire avant de fermer. Paquet ci-dessous.

### Paquet pour le reviewer cross-harnais (commits depuis `2c3c439`)
`a67b5ae` fit viewport · `d851e65` splash+titre · `3586d8a` retrait scaffold (DEBT-012) · `417206c` docs · `338cace` ligne ferveur · `a2d5d66` overlay « ? » Stable · `f2c3be8` scène Recap · `8deae31` module settlement (DEBT-013) · `bf1196b` docs DEBT-005/014 + PHASE-8 · (+ le commit docs de ce handoff).
Points d'attention suggérés :
- **Recap** : routage `Stable.loadData()` → early-return vers `Recap` (garde `claimRecapPresentation()`, état module par chargement de page) — vérifier absence de boucle Stable↔Recap et le resize en cours d'affichage.
- **Overlay « ? »** : la priorité d'input repose sur l'ordre d'ajout au container (dim au-dessus des boutons) — vérifier qu'aucun bouton sous l'overlay ne reste cliquable.
- **Betting** : la nouvelle ligne à y=78 s'insère entre le sous-titre (fin ~75) et « TRÉSOR » (y=92) — vérifier l'absence de chevauchement à 360 px (fonte 9 px).
- **DEBT-013** : pur déplacement, valeurs inchangées — diff à relire comme un no-op comportemental.
- Rien de tout ça n'a été vu à l'œil sur appareil (DEBT-015).

### Pièges / frictions notées
- Le sub-agent viewport a été coupé par une limite de session en plein vol : ses helpers `text()`/`button()` de Stable ont été finis à la main et `Betting.ts` écrit entièrement après coup. Le layout compact est vérifié **par calcul**, pas à l'œil — d'où DEBT-015.
- En mode empilé (Betting < 640 px), le libellé chiffré « FERVEUR x/y » disparaît (seule la barre reste) — jugé acceptable, à revalider à l'œil.
- ~~Frictions onboarding hors périmètre~~ : les 3 frictions (a) Stable muet, (b) ferveur non écrite, (c) pas d'écran « retour du lendemain » sont **fermées** par la seconde passe du 2026-07-02 (scope validé humain via checkpoint).
- La ferveur, dans sa fenêtre, **décide** plus qu'elle ne penche (cf. proposition DEBT-007) — le texte in-game reste vrai (elle ne renverse jamais les écrasés), mais si le tuning doit s'adoucir, c'est `FERVOR_MAX_ATTRIBUTE_BONUS` qu'il faut baisser (re-simuler avant).
