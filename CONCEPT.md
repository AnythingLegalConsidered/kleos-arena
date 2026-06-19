# KLEOS — Concept

> Auto-battler de gladiateurs déterministe sur Reddit/Devvit, où la **foule** est la mécanique.
> Hackathon : Reddit's Games with a Hook (deadline 2026-07-15). Solo.

## Pitch
Tu diriges une écurie de gladiateurs dans l'arène d'un monde égéen (mycénien/proto-grec).
Chaque jour une nouvelle arène (favorisée par un dieu) ouvre. Tu formes/développes ton équipe,
elle combat en simulation déterministe, et la **communauté Reddit parie sur les écuries** —
parier = voter. Plus on te suit et plus on parie sur toi, plus la foule galvanise tes gladiateurs.

## Cibles de prix (le design sert les 3 à la fois)
- **Best Use of Phaser** — combat déterministe rendu nerveux/juicy.
- **Best Use of Retention** — arène quotidienne + progression d'écurie + streak + leaderboard + foule.
- **Best Use of User Contributions** — pari/vote sur les vrais joueurs, écuries comme contenu.
- Grand prix "Hook" en aval si la boucle quotidienne est exceptionnelle.

## Décisions de fondation (LOCKED)
1. **Architecture** : simulation **déterministe** (seed + composition → résultat fixe) +
   **arène quotidienne async**. PAS de combat live multijoueur.
2. **Cadence** : hybride — combat **instantané** quand tu joues (satisfaction + démo juge)
   + **bracket quotidien** résolu au tick (anticipation overnight).
3. **Adversaires** : hybride — **bots** crédibles pour amorcer (cold-start <200 membres)
   → **ghosts** (snapshots d'équipes réelles) quand le pool grossit.
4. **Modèle de combat** : **full auto (Modèle A)**. Aucune action live. Résultat = composition +
   attributs + armes + placement + modificateurs. Déterminisme trivial.
   **Spatial** : **arène ouverte**, unités à positions libres (steering = seek + separation, zéro
   pathfinding), clash au centre. Le « nerveux/VS » vient du **juice de présentation**
   (shake, hitpause, particules, slow-mo), PAS de la complexité de la sim. Sim headless d'abord, rendu ensuite.
5. **Art** : **technique silhouette 2-tons** (figure-noire → post-process seuillage = anti-AI-slop)
   appliquée à un **sujet égéen/mycénien** (armure de Dendra, boucliers en 8, casques en défenses
   de sanglier, motifs spiralés). PAS de fresque détaillée (casserait l'anti-slop).
   Variété d'armures (quelques-unes lourdes) + **arme = identité visuelle ET mécanique** → silhouettes distinctes.

## Personnages & progression
- **Pas de classes.** 3 attributs développables : **Force** (dégâts), **Agilité** (vitesse/esquive/initiative),
  **Résilience** (PV/réduction). Lisibles, qui stack.
- **Aptitude aléatoire** : chaque gladiateur monte un attribut moins cher → variété, build adapté au perso.
- **Progression** : points d'attribut + **petites échelles de 3-4 perks par attribut** (mini-branches).
  PAS de grand arbre tentaculaire en v1 (backlog).
- **Armes aléatoires** à archétypes classiques antiques (lance, épée+bouclier, hache double, arc…)
  → définissent la silhouette et le rôle.

## Core loop — 1 visite (~3-4 min)
1. **Arène du jour** — un dieu/modificateur change la meta.
2. **Gérer l'écurie** — dépenser or/faveur : attributs, perks, soin, stuff/armes.
3. **Combat instant** — placer l'équipe, sim déterministe juteuse (Phaser). N'utilise que **ta** foule.
4. **Parier/voter** — sur 2-3 combats featured d'autres écuries.
5. **Tick overnight** — ton équipe dans le bracket, votes accumulés appliqués, résolution.

### Retour le lendemain = 3 anticipations
- Mon équipe a fini où ? Combien ont parié/voté sur moi ?
- Mes paris ont payé (or pour l'écurie) ?
- Ma foule a grossi → nouveau palier de buff débloqué ?

## La ferveur (l'or Reddit-y) — bornée
- **Parier = voter** : miser de l'or sur une écurie ajoute de la **ferveur** à cette écurie. Un seul geste.
- **Marché auto-équilibré** : parier sur l'outsider **paie plus** → l'appât du gain envoie la ferveur
  vers les outsiders → ils récupèrent une vraie chance. Ta vision, sans action séparée.
- **Bornée** : la ferveur **fait pencher les combats serrés**, elle n'**écrase pas** la force.
  La couche stratégique reste dominante ; la ferveur est le pouce sur la balance.
- **Timing** : combat instant = ta foule seule (déterministe tde suite) ; bracket au tick = votes
  du jour accumulés appliqués, puis résolu (déterministe une fois les votes fermés).

## Mécaniques sociales (passives, pas d'input live)
- **Dieu du jour** → modificateur d'arène global.
- **Foule/followers** → buff de départ qui *stack* avec le nombre de suiveurs.
- **Faveur des dieux** → 1 choix pré-combat (bénédiction passive) avant de soumettre.

## Progression persistante (le compte d'épargne qui ramène)
Écurie (roster + attributs + perks + armes) · or/faveur · foule/followers · faveur des dieux ·
**streak quotidien** · place au **leaderboard du jour**.

## Stack technique (LOCKED)
- **Plateforme** : Devvit Web (conteneur du post interactif Reddit).
- **Langage** : TypeScript.
- **Client** : **Phaser 4.1.0** (version du template officiel) — canvas de combat + juice. Cible le prix Phaser.
- **Menus** : DOM/HTML léger ou scènes Phaser (écurie, pari, progression). Pas de React.
- **Serveur** : Devvit serverless via **Hono** — Redis/KV (persistance), scheduler (tick quotidien), ghosts, paris.
- **Build** : Vite.
- **Sim** : **module TS pur partagé** client↔serveur. Serveur = autorité pour les résultats à enjeu
  (bracket au tick, anti-triche) ; client rejoue la même sim (seed) pour le combat instant.
- **Pas** de React / three.js / second framework. Phaser + DOM léger, point.
- **Scaffold** : `reddit/devvit-template-phaser` posé (app `kleos-arena`). **Node >=22.2.0** (Node 24 OK).
  Structure confirmée : `src/client` (Phaser + scenes) · `src/server` (Hono + routes) · `src/shared` (sim).
  `npm run dev` = `devvit playtest`. Contrat plateforme détaillé dans AGENTS.md §2.
- Déterminisme : replay identique dans le même runtime (PRNG seedé) suffit ; pas de sim float-identique
  cross-runtime — le serveur tranche les enjeux.

---
## À trancher ensuite
- **Build order** sur ~27 jours (proposé ci-dessus, à figer dans ROADMAP.md).
- **Tuning** : set de perks, éco or/faveur, cotes de pari — à préciser à l'exécution.
- **Nom du jeu** : **KLEOS** (κλέος = la gloire portée par la communauté) — slug app `kleos`.
  Nom d'affichage / subreddit à polir.
- **Workflow harnais** : convention de phases portable (voir ci-dessous / AGENTS.md).
