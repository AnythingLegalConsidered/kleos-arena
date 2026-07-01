# Pipeline silhouette — post-process 2 tons

Outillage **offline** de la Phase 7 (CONCEPT §Art, LOCKED) : quelle que soit la source
(génération IA, dessin, photo détourée), chaque asset passe par un **seuillage dur en
2 tons** qui force la même palette exacte sur toute la production. C'est le verrou
anti-AI-slop : aucune dérive de style possible entre assets, le seuillage uniformise.

Ce dossier n'est **jamais bundlé** côté client ou serveur — c'est un outil de build
d'assets, lancé à la main.

## État (2026-07-02)

**Aucune silhouette source n'existe encore.** La génération des sources (IA ou autre)
est une étape humaine, hors de ce script. Le post-process est prêt : dès que des
sources PNG existent, une commande produit les sprites finaux.

## Usage

```bash
# une image
node scripts/silhouette/cli.mjs --in sources/spearman.png --out public/assets/gladiators

# un dossier entier (tous les .png, non récursif)
node scripts/silhouette/cli.mjs --in sources/ --out public/assets/gladiators
```

Options :

| Flag | Défaut | Rôle |
|---|---|---|
| `--fg <#hex\|transparent>` | `#14110d` | ton de la figure (noir chaud du jeu) |
| `--bg <#hex\|transparent>` | `transparent` | ton du fond (transparent = prêt pour sprite) |
| `--threshold <0-255\|otsu>` | `otsu` | coupe de luminance ; `otsu` la calcule par image |
| `--invert` | off | sources en figure claire sur fond sombre |
| `--suffix <texte>` | `''` | suffixe ajouté au nom de sortie |

Le script affiche par image le seuil retenu et le **pourcentage de pixels figure** ;
un ratio < 2 % ou > 90 % est signalé `[WARN]` (source inutilisable ou `--invert`
manquant/en trop). Format d'entrée : **PNG uniquement** (exporter les sources en PNG).

## Contraintes sur les sources (pour un bon seuillage)

- **Une silhouette par image**, vue de **profil**, pose lisible (l'arme dégagée du corps).
- Fort contraste figure/fond : figure sombre sur fond clair (ou l'inverse + `--invert`).
- Fond **uni**, pas de décor — le seuillage envoie tout ce qui est clair au fond.
- ~256–512 px de haut, la figure occupe 70–90 % du cadre, petites marges.
- Le détail intérieur (plis, muscles) disparaîtra au seuillage : l'identité doit être
  portée par le **contour** — c'est voulu (style figure noire).

## Prompts de génération suggérés (réfs CONCEPT §Art)

Base commune : *black-figure pottery style silhouette, solid dark figure on plain
light background, side profile, full body, Mycenaean Bronze Age warrior, clean
sharp outline, no interior detail, no text* — puis par archétype (l'arme EST
l'identité visuelle, les silhouettes doivent se distinguer d'un coup d'œil) :

| Archétype (`WeaponArchetype`) | Éléments de silhouette |
|---|---|
| `spear` | longue lance verticale dépassant nettement, **bouclier en 8** (figure-eight shield), casque à **défenses de sanglier** |
| `sword_shield` | épée courte levée, **grand bouclier tour** rectangulaire, stature carrée, **armure de Dendra** (épaules larges en cloche) |
| `axe` | **hache double** (labrys) tenue à deux mains au-dessus de l'épaule, torse nu, stature massive |
| `bow` | arc bandé, carquois dans le dos, silhouette fine, genou à terre ou fente avant |

Motifs décoratifs éventuels (bords de bouclier, cimier) : **spirales égéennes** —
mais rester sobre, le seuillage mange les motifs fins.

## Brancher les sprites dans le jeu

Sortie recommandée : `public/assets/gladiators/<archetype>.png` (le Preloader charge
depuis `../assets`). Le point de remplacement des formes blanches est
`bodyShape()` / `makeBody()` dans `src/client/scenes/Arena.ts` : une forme Phaser
par `WeaponArchetype`, à remplacer par un `Image` chargé + teinte d'équipe sur le
contour (le liseré `setStrokeStyle` actuel). Garder `BODY_RADIUS` comme échelle de
référence pour ne pas casser les barres de PV ni le knockback cosmétique.

## Tests

Le cœur (`threshold.mjs`) est pur (buffers RGBA, zéro dépendance) et couvert par
`test/tools/silhouette.test.ts` (vitest). `cli.mjs` n'est que l'enrobage I/O
(pngjs, devDependency).
