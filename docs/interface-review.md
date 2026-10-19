# Revue Fin — inspiration Apple Bourse, 20 octobre 2026

## Scope and coverage

Périmètre : liste et sélection des trois modèles CRP, détail du portefeuille, périodes et comparaison des courbes, raccourcis des sous-jacents Warrants, thème partagé et PWA. Les neuf routes existantes ont été contrôlées à quatre largeurs. React, TypeScript, CSS partagé, navigation, API/MCP et moteur financier conservés. Conventions lues : `AGENTS.md` et `DESIGN.md` ; les six compétences better-* ont été chargées pour cette revue.

Référence consultée : [Apple Bourse, liste et graphiques](https://support.apple.com/en-ie/guide/iphone/iph1ac0b1bc/ios). Le fond noir, les listes compactes, les montants alignés et la sélection qui conduit à un graphique reprennent cette direction. Les gains restent bleus selon la préférence sans vert. Aucun actif Apple n’est distribué avec l’application.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Boutons natifs avec état sélectionné, graphique clavier/toucher/pointeur, dialogues, région de défilement et scans axe dans `check-ui.mjs` et `check-fin.mjs` | Aucun critical/serious dans les états Chromium testés |
| Layout | Neuf routes à 1440, 768, 390 et 320 px ; CRP à trois largeurs, texte à 200 %, RTL | Deux panneaux lorsque le contenu tient, empilement sinon ; aucun débordement restant dans les contrôles |
| Writing | Période des variations, capital estimé/clôturé, dates des clôtures, textes d’erreur et écrans vides | Textes courts et relus ; les raisons archivées des modèles sont conservées |
| Typography | Police système Apple si disponible, Public Sans ailleurs, grandes valeurs tabulaires et niveaux de titres | Sans-serif conservé ; aucune police Apple téléchargée |
| Color | Onze paires mesurées dans `output/playwright/contrast-dark.json`, scans axe et mode sombre forcé | Seuils AA vérifiés ; variations signées en plus de la couleur |
| UI polish | Sélection instantanée, périodes, comparaison, filtre par sous-jacent, détails et restauration du focus | Interactions contrôlées ; graphiques sans animation décorative |

## Findings

Constats résolus pendant l’implémentation, sans présenter la direction précédente comme une violation objective.

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Layout | `src/fin/style.css:2067`, `src/fin/MarketStrip.tsx:63` | Le texte masqué d’un bouton hors champ débordait du document à 390 px, son contenant de positionnement étant la page | Contenant positionné à l’intérieur de la liste défilante, région nommée et focusable, indication de défilement | Le contenu hors champ doit rester dans son propre défilement |
| MEDIUM | Layout | `src/fin/Comparison.tsx:125` | Comparatif pleine largeur, suivi d’une courbe unique en dessous | Trois lignes de suivi et panneau sélectionné avec grande valeur et graphique ; empilement mobile | Lire les trois résultats, puis explorer un seul modèle sans ouvrir un dialogue |
| MEDIUM | Writing | `src/fin/MarketStrip.tsx:48` | Première version : courbe sur 20 clôtures, variation chiffrée sur une seule séance | Courbe et variation sur les mêmes 20 séances, à partir de 21 clôtures, période visible | La variation et la courbe doivent représenter le même intervalle |
| MEDIUM | Accessibility | `scripts/check-pwa.mjs:16`, `scripts/check-install.mjs:53` | Le nouveau titre CRP était aussi celui du chargement : l’attente du titre pouvait valider un écran non chargé | Les vérifications attendent la liste des modèles chargée avant de continuer | La reprise réseau doit être confirmée par des données, pas seulement par un titre |

## Verification

- Typage et build réussis ; 37 tests financiers/de collecte/de routage réussis. Le moteur et les règles de normalisation à 100 € ne changent pas.
- `test:fin` : 36 combinaisons de routes/largeurs, filtre par raccourci de sous-jacent et retour à Tous, détails, simulateur, imports, analyses enregistrées, annulation et navigation.
- `test:ui` : valeurs positives/négatives de fixtures, sélection des modèles, périodes, comparaison des trois courbes, cinq issues de décision, volet, focus, clavier, survol, toucher, historique, texte à 200 % et RTL.
- `test:theme` : onze paires. Texte 18,25:1 ; secondaire 8,44:1 sur page et 7,58:1 sur panneau ; badge de perte 5,57:1 ; bouton primaire 6,40:1 ; limite de contrôle 3,29:1.
- `test:install` : six groupes de cas ; `test:pwa` : installabilité Chromium, chargement, erreur, absence de décisions et reprise hors ligne. Manifest et barre du système noirs.
- Smoke API/MCP : endpoints en lecture seule, comparaison à 100 €, catalogue et rejet des paramètres invalides.

Captures et sorties dans `output/playwright/`. Les captures `fixture` utilisent des scénarios de test sans écriture D1. Les aperçus `stocks-preview` emploient les données publiques de production dans le rendu local ; ils ne sont pas des preuves de déploiement. Les captures `production` sont séparées.

Écriture : une passe sur les libellés ajoutés, puis relecture française avec les consignes avoid-ai-writing. Aucun score anglais ne sert de validation du français. Les montants, dates, sources et réponses de modèles restent des données.

Not verified : installation sur appareil physique, Safari/VoiceOver et TalkBack. Les courbes relient les points enregistrés ; elles ne reproduisent pas un historique intrahoraire. Les données des sous-jacents sont des clôtures et les cotations de warrants des relevés datés.

## Verdict

Approve dans le périmètre Chromium inspecté. Aucun avertissement masqué. Aucune requête de modèle déclenchée par les tests.


### Suivi du hook — état sélectionné

Les deux signalements `side-tab` de la ligne de modèle sélectionnée (sens normal et RTL) ont été corrigés : suppression des ombres internes latérales de 3 px. Le fond sélectionné est conservé, accompagné d’une coche Lucide décorative. L’état accessible reste fourni par `aria-pressed`. Aucun ignore ajouté.
