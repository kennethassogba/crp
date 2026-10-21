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


### Warrants — expérience en base 100 €

Périmètre ajouté : `/warrants/experience/`, accès depuis la navigation Warrants,
comparaison par contrat, recherche, pagination, détail, export JSON et graphique.
Le catalogue et ses hypothèses restent séparés. Conventions `AGENTS.md` et `DESIGN.md` conservées.

| Domaine | Éléments contrôlés | Résultat |
| --- | --- | --- |
| Accessibilité | `WarrantExperiment.tsx`, contrôles nommés, `aria-pressed`, focus visible, clavier du graphique, états sans résultat | Aucun blocage Chromium/axe critique ou sérieux aux quatre largeurs |
| Mise en page | Liste et détail partagés avec CRP, 1440/768/390/320 px | Aucun débordement ; sur mobile, sélectionner un contrat amène au détail avec le focus |
| Écriture | Base 100 €, prix de référence, ancien relevé, remboursement inconnu, frais simulés | Le montant de comparaison est distingué d'un ordre réel de 100 €, inférieur au minimum catalogue de 500 € |
| Typographie | Police et échelle existantes, chiffres tabulaires, dates courtes sur le graphique | Les dates ne se chevauchent plus sur mobile ; heures et dates du graphique en Europe/Paris |
| Couleur | Tokens partagés, variations signées, statut textuel, sélection avec coche | Mode sombre, gains bleus, pertes rouges ; aucune nouvelle couleur ni signification par couleur seule |
| UI | Sélection, recherche sans résultat, pagination, export et récupération réseau | Contrôles fonctionnels ; le graphique suit le temps écoulé et montre le repère 100 € |

Vérification : 44 tests unitaires ; 14 tests reproduits depuis l'archive téléchargeable ;
40 combinaisons de routes/largeurs, interaction du nouveau graphique au clavier,
lecture des frais, recherche et pagination aux quatre largeurs. Régression CRP réussie,
11 paires de contraste, 6 groupes d'installation, installabilité et reprise hors ligne réussies.
Les libellés français ajoutés ont été relus manuellement avec avoid-ai-writing ; aucun score anglais revendiqué.

La première inspection a révélé les dates trop longues et espacées par indice de relevé ;
correction groupée : dates courtes en heure de Paris, extrémités uniquement et axe temporel réel.
La confirmation a réussi. Aucun avertissement masqué. Installation physique et lecteurs d'écran natifs non vérifiés.


### 21 octobre — portefeuille J1 et interface commune

Périmètre : accueil réunissant Q433S et les trois modèles IA, filtres Warrants/IA,
composants `PortfolioView` et `PortfolioChart` partagés. Conservation du catalogue,
du journal, des analyses locales, des liens API/MCP et de la PWA.

| Domaine | Évidence inspectée | Résultat |
| --- | --- | --- |
| Accessibilité | Contrôles natifs, noms, sélection `aria-pressed`, focus du détail et du dialogue, graphique au clavier/toucher | Même interaction pour les quatre portefeuilles ; les instructions restent accessibles sans texte permanent |
| Mise en page | Captures `minimal-first-1440.png` et `minimal-first-390.png`, liste et détail dans la même grille | Une navigation, suppression du fil d’Ariane dupliqué et du sous-logo ; empilement mobile |
| Écriture | Titre, simulation à 1 000 €, type de position ; chiffres et hypothèses sous Détails | Suppression des légendes permanentes, paragraphes et liens répétés ; aucune nouvelle promesse de rendement |
| Typographie | Police, échelle et chiffres tabulaires existants, dates courtes | Pas de nouvelle police ni de niveau décoratif |
| Couleur | Tokens existants, variation signée, coche de sélection | Gains bleus, pertes rouges, aucun vert ni état uniquement coloré |
| UI | Sélection, périodes, comparaison, Détails et décision via le même composant | Les variantes représentent les mêmes données, pas deux applications imbriquées |

Le choix humain retient une seule position de 1 000 €. Q433S, déjà affiché par défaut,
est figé à J1 : 689 unités et 0,95 € en espèces. Le portefeuille n’est plus une normalisation
par contrat depuis 3 000 €. Les modèles CRP restent normalisés depuis le journal USD 10 000,
désormais sur une base de 1 000 € ; aucune écriture du journal ni modification du budget fournisseur.
L’import d’un catalogue de recherche ne modifie pas le portefeuille public à J1.

47 tests financiers/de collecte/de routage réussis ; 17 tests reproduits depuis l’archive téléchargeable.
Relecture française manuelle suivant avoid-ai-writing, sans score de détection anglais.
Détecteur Impeccable : aucun signalement ; aucune suppression ajoutée.
Les états chargement, erreur, sans décision, hors ligne, les quatre largeurs, le texte à 200 %,
le RTL et les contrôles de contraste font partie des scripts de vérification du projet.
Les preuves de publication sont conservées séparément des captures locales dans `output/playwright/`.
Appareils physiques et lecteurs d’écran natifs : non vérifiés.


Correction tactile confirmée à 320 px : la barre fixe pouvait recouvrir une partie du filtre Tous
après l’exploration du graphique. Elle revient dans le flux normal ; les filtres ont une cible
minimale de 44 × 44 px. Aucun avertissement ignoré. Le contrôle ciblé à 320 px a réussi
pour les dix routes, les graphiques, le simulateur, les dialogues, les imports et la navigation.
La matrice complète des quatre largeurs reste requise par la CI avant livraison.
