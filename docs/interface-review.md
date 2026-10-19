# Revue de l’interface Fin — 20 octobre 2026

## Scope and coverage

Périmètre : vue d’ensemble, liste et détail des warrants, import, simulateur de remboursement, modèles, contrat, analyses enregistrées, décisions/modèles/historique/règles CRP, données et installation. Chargement, erreur, liste vide, suppression annulable, navigation mobile et reprise hors ligne inclus. React 19, TypeScript, CSS partagé, Public Sans et Lucide. `AGENTS.md`, `DESIGN.md` et le brief du 20 octobre définissent les conventions. Aucun changement de stack.

Les six compétences better-* ont été chargées. La revue porte sur l’interface rendue et ses parcours ; ce n’est pas une certification de rentabilité ou d’accessibilité sur tous les appareils.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | `src/fin/Charts.tsx`, dialogues natifs, régions de tableaux nommées et focusables ; parcours clavier et axe dans `scripts/check-fin.mjs`, `check-ui.mjs`, `check-install.mjs`, `check-pwa.mjs` | Aucun HIGH restant dans Chromium testé |
| Layout | Neuf routes à 1440, 768, 390 et 320 px ; captures du tableau, du détail et de CRP ; texte agrandi à 200 %, miroir RTL | Aucun débordement de page dans ces cas |
| Writing | Textes de navigation et d’actions, dates des relevés, modèles, erreurs avec action, annulation de suppression ; réponses des modèles préservées | Textes français relus et abrégés |
| Typography | Public Sans chargé ; valeurs tabulaires, formulaires et axes ; captures et famille calculée du navigateur | Geist retirée ; valeurs du graphique lisibles dans le composant redimensionné |
| Color | Six paires calculées depuis les styles rendus dans `output/playwright/contrast.json`, plus les scans axe | Paires contrôlées conformes aux seuils AA applicables |
| UI polish | Survol/toucher/clavier des graphiques, changement de scénario, états de filtre, dialogue/Escape, suivi/Annuler et navigation SPA | Parcours testés fonctionnels |

## Findings

Constats résolus pendant la refonte, classés par impact. Les changements de police et de marque suivent la demande explicite ; ils ne sont pas présentés comme des violations objectives de l’ancienne charte.

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Accessibility | `src/fin/Crp.tsx`, `src/fin/Detail.tsx`, `.table-scroll` | Le tableau mobile défilait sans région clavier focusable ; axe a signalé `scrollable-region-focusable` à 390 px | Région nommée, tabindex=0 et indication de défilement | Le contenu débordant doit rester atteignable au clavier |
| MEDIUM | Layout | `vite.config.ts`, `src/fin/main.tsx` | Deux entrées HTML et deux systèmes de navigation/styles | Une entrée React, une navigation et un style communs ; liens internes sans rechargement | Changer d’outil doit garder le contexte de recherche |
| MEDIUM | Layout | `src/fin/Screener.tsx`, `src/fin/Detail.tsx` | Catalogue et fiche détaillée visibles simultanément, nombreuses explications sur l’écran initial | Tableau de dix lignes, tri/filtres, fiche à la demande, explications repliées | La liste sert à choisir ; le détail sert à comprendre le contrat |
| MEDIUM | Accessibility | `src/fin/Charts.tsx` | Barres statiques et titres SVG, sans lecture des tranches au clavier | Lecture chiffrée stable au survol, au toucher et avec les flèches ; largeur du graphe mesurée | Une barre doit indiquer la tranche de gain et sa fréquence |
| MEDIUM | Writing | `src/fin/main.tsx`, `src/fin/Method.tsx` | Les modalités de mise à jour étaient réparties entre avertissement et documentation | Page Données, distinction heure de relevé / heure de cotation, erreurs sources visibles | Permettre de savoir quels prix ont changé et quand |
| MEDIUM | Typography | `src/fin/style.css`, `DESIGN.md` | Geist et styles CRP séparés | Public Sans partagé ; ancienne dépendance et exception retirées | Appliquer le choix de police demandé sur toute l’application |
| LOW | UI polish | `src/fin/main.tsx`, icônes d’installation | Marque décorative et faux sélecteur d’espace | Nom Fin en texte, sans symbole ni sélecteur factice | Retirer les éléments sans action utile |

## Verification

Contrôles exécutés :

- `npm run check`, `npm test` : typage et 28 tests financiers, de collecte et de données.
- `npm run test:fin` : 36 combinaisons de routes/largeurs ; histogramme clavier, simulateur, modèles, source DIC, fermeture/restauration du focus, budget, import valide/invalide, persistance du suivi, Annuler, navigation et retour navigateur, erreur récupérable, agrandissement de texte et RTL.
- `npm run test:ui` : cinq issues de décisions CRP en fixtures de navigateur, plans, export, graphiques au pointeur/clavier, changement d’actif et historique à trois largeurs. Aucune décision fictive n’est écrite dans D1.
- `npm run test:install` : six groupes de contrôles, dont les cinq largeurs, le délai, le refus, iOS simulé et le focus.
- `npm run test:pwa` : installabilité Chromium, chargement/erreur/vide, fonctionnement de Réessayer après retour du réseau. Les données financières ne sont pas servies comme actuelles hors ligne.
- `npm run build` et `CRP_URL=http://127.0.0.1:5185 node scripts/smoke.mjs` : build unique et API publique.

Mesures rendues sur blanc : texte 15,27:1 ; secondaire 5,84:1 ; perte 6,27:1 ; barres positives 4,25:1 ; barre de perte active 6,27:1 ; bordure d’entrée 3,46:1. Les seuils appliqués sont 4,5:1 pour le texte et 3:1 pour les graphiques et limites de contrôles.

Écriture : deux passes sur les textes d’interface ; relecture française manuelle. 115 segments JSX modifiés ont été isolés du code, des URL et des réponses de modèles, puis passés à `normalize-quotes.js` avec le texte initial comme référence. Aucune différence de ponctuation n’a été nécessaire. Les règles du détecteur anglais ne sont pas présentées comme une validation automatique du français. Les formules, sources, prix datés et réponses enregistrées restent distincts des textes réécrits.

Not verified : installation sur appareil physique, VoiceOver/TalkBack, zoom natif de chaque navigateur et traduction dans d’autres langues. Les tests ne prouvent ni l’exécution d’un ordre aux prix relevés ni un avantage prédictif.

## Verdict

Approve dans le périmètre Chromium, routes et états inspectés ci-dessus. Les limites matérielles et d’assistance listées restent hors de cette validation.
