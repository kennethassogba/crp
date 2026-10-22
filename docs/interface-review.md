# Revue du 22 octobre 2026

Périmètre : application Warrants, de la sélection quotidienne à la comparaison des clôtures. Cette passe reprend les annotations utilisateur sur l’en-tête, l’actualisation, la note de bas de page et le défilement.

Compétences appliquées : better-interface et ses six domaines (accessibilité, structure, rédaction, typographie, couleurs, composants), avoid-ai-writing et Impeccable polish. Le contrôle rédactionnel français est une relecture, pas un score de détection d’auteur.

## Corrections

- Application à hauteur de fenêtre. Listes paginées, analyse côte à côte sur ordinateur, retour explicite et navigation basse sur mobile.
- Suppression de l’en-tête redondant, du bouton d’actualisation et des petites notes. Texte de 16 px minimum, graphique compris.
- Prévision et probabilité regroupées. Explication à côté du gain, fiches Position et Prévision en feuilles accessibles, source nommée.
- Graphique à hauteur disponible : données réelles, prix et date au pointeur, au toucher et au clavier, périodes et zoom. Historique antérieur atténué et suivi bleu.
- Lecture automatique des données chaque minute, au retour en ligne et au premier plan ; nouvelle tentative après panne. Aucune cotation temps réel revendiquée.
- Style sombre, police système / Public Sans, gains bleus et pertes rouges ; aucune bordure latérale colorée. Alignement du code warrant et regroupement des métriques corrigés pendant la passe visuelle. Défilement interne thématisé pour les feuilles et le texte agrandi.
- README recentré sur le protocole, les hypothèses et l’évaluation du modèle.

## Vérification

- TypeScript, build Vite, 30 tests de calcul et de collecte.
- 24 états aux formats 2407 × 1260, 1440 × 900, 390 × 844 et 320 × 568 : quatre routes, instrument sélectionné et aide à la prévision. Pas de défilement du document, pas de texte visible sous 16 px, pas de violation axe WCAG A/AA détectée.
- Graphique au clavier et au pointeur, changements de série et période, zoom, recherche, filtres, pagination mobile, retour et fermeture des feuilles avec restitution du focus.
- Contrôle du minuteur de synchronisation, échec HTTP puis reprise automatique ; PWA hors ligne puis récupération au retour en ligne. Les données financières ne sont pas mises en cache par le service worker.
- Analyse mécanique Impeccable : aucun signalement sur les composants examinés, aucune suppression ajoutée.
- 13 paires de contraste mesurées. Installation silencieuse à la première visite, engagement préalable et masquage mémorisé.

Captures : output/playwright/fullscreen-list-2407.png, fullscreen-chart-390.png et fullscreen-chart-320.png. Inspection groupée ordinateur et mobile, puis confirmation après corrections. Aucune validation matérielle VoiceOver/NVDA ou iPhone n’est revendiquée.

## Limites

Prix publics indicatifs, heure émetteur inconnue. DIC lié mais non validé juridiquement par le moteur. Les résultats prospectifs ne sont pas encore suffisants pour valider le classement. La synchronisation de l’interface ne change pas la fréquence quotidienne de collecte. Le nombre de nouvelles sélections dépend des données et de l’éligibilité.

## Français / English

Interrupteur visible sur chaque écran et dans la fiche mobile. Préférence mémorisée, sélection conservée, noms accessibles et langue du document synchronisés. Traduction des états, feuilles, étapes de méthode, aide d’installation, dates, montants et graphiques. Les horaires et données financières ne changent pas. README principal en anglais ; contenu français conservé dans README.fr.md avec liens réciproques.

Contrôles dédiés : scripts/check-i18n.mjs (couverture des traductions, formats 1440 × 900, 390 × 844 et 320 × 568, clavier, persistance, aides et erreurs). Résultat : 25 états anglais et 24 états français validés, sans défilement du document ni violation axe détectée ; navigation, reconnexion et installation existantes passent aussi.
