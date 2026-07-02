# PHASE 8 — Submission
Status: not-started
Harness: —

## Goal
Soumission Devpost complète et conforme, **app approuvée par la review Reddit avant la deadline
2026-07-15 18:00 PT (PDT)**. Exigences vérifiées le 2026-07-02 sur
redditgameswithahook.devpost.com/rules et developers.reddit.com/docs (launch-guide, devvit_rules).

## Context
- Read: AGENTS.md, CONCEPT.md, règles du hackathon (Devpost), guide launch Devvit.
- Dépend de: tout le reste.
- **Piège de calendrier (vérifié)** : la review Reddit prend 1-2 jours ouvrés en typique,
  **jusqu'à ~1 semaine pour une app nouvelle**. Publier au plus tard le **2026-07-08** pour
  garder de la marge. `npx devvit publish` est requis à **chaque** version lancée.
- Ce que demande Devpost (champs requis) : lien app `developers.reddit.com/apps/kleos-arena`,
  lien subreddit de test **public < 200 membres** + un post qui fait tourner le jeu, description
  texte du projet. Optionnels : vidéo < 1 min (YouTube/Vimeo…), URL repo public, survey feedback
  (prix Most Valuable Feedback).
- Catégories : « Best Experience That Will Keep People Coming Back » + sous-défis Best Use of
  Phaser / Retention Mechanics / User Contributions (KLEOS vise les 3 — un seul prix possible).
  Jugement équipondéré : Delightful UX · Polish · Reddity · Hook (· Phaser Innovation).

## Touches
- `README.md` (EN) à la racine, `package.json` (bumps éventuels), app listing, subreddit de démo.

## Tasks
- [ ] **README.md racine réécrit en anglais** — l'actuel est encore le template scaffold, motif
      de **rejet explicite** (devvit_rules) : overview ≤ 1000 mots pour non-développeurs (quoi,
      pour qui, notes opérationnelles), configuration/déploiement/interaction (menu mod « Open
      today's arena », tick cron 00:05 UTC), et un **changelog par version soumise**.
- [ ] Décision bumps sécurité (DEBT-005/014, feu vert humain) : `hono` 4.12.27 + `vite` 8.1.3
      (2 high non cassants) ; rejouer les 4 verify + playtest après.
- [ ] Checklist launch-ready Devvit (vérifiée doc) : responsive mobile+web, écran d'entrée
      custom (splash Phase 7 ✔), **pas de scroll inline**, compréhensible immédiatement
      (onboarding Phase 7 ✔), testé depuis plusieurs comptes (dev / mod / user).
- [ ] Subreddit de démo **public < 200 membres** (r/kleos_arena_dev actuel ou dédié) + post
      du jour jouable, épinglé.
- [ ] `npm run launch` (= deploy + `devvit publish`) **au plus tard 2026-07-08** ; suivre la
      review (email / Modmail), corriger et re-publier si feedback.
- [ ] Vidéo démo < 1 min (optionnelle Devpost mais recommandée — montre la boucle complète).
- [ ] Soumission Devpost : tous les champs requis + catégorie + sous-défis, avant la deadline ;
      (optionnel) survey feedback + repo public.

## Verify
- App **approuvée** et post public jouable, auto-explicatif, accessible aux juges sans restriction.
- README conforme devvit_rules (non-template, changelog inclus).
- Soumission Devpost validée **avant 2026-07-15 18:00 PT** (viser le 14).

## Handoff
(liens app / subreddit / post / vidéo, checklist Devpost cochée, statut de la review Reddit)
