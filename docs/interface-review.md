# Revue du 22 octobre 2026

Périmètre : application Warrants, de la sélection quotidienne à la comparaison des clôtures. CRP retiré du client, des routes, des outils agent et du Worker ; D1 conservée sans accès applicatif.

Compétences appliquées : better-interface et ses six domaines (accessibilité, structure, rédaction, typographie, couleurs, composants), avoid-ai-writing pour les libellés et le protocole. Le contrôle rédactionnel français est une relecture, pas un score de détection d’auteur.

## Changements

- Trois destinations : Sélection, Positions, Résultats. Méthode en accès secondaire ; raccourci mobile.
- Sélections figées, mise indépendante de 1 000 € chacune, achat ask / valorisation bid, frais et espèces visibles.
- Prévision distincte du suivi constaté. Une absence de prix ne devient pas un gain nul.
- Graphiques TradingView Lightweight Charts : périodes, zoom, déplacement, curseur, clavier. Historique réel du sous-jacent, bid du warrant et capital accessibles comme séries distinctes. Partie antérieure à la sélection atténuée.
- Suppression des anciens graphiques, composants CRP, doubles parcours, libellé générique « Détails » et historique rétrospectif présenté comme test du nouveau modèle.
- Police système / Public Sans, mode sombre, gains bleus et pertes rouges, sans vert ni bordure latérale colorée.

## Vérification locale

- TypeScript, build Vite, 30 tests de calcul et de collecte.
- 16 vues : quatre routes aux largeurs 1440, 1024, 390 et 320 px, sans débordement horizontal ni violation axe WCAG A/AA détectée.
- Graphique au clavier et au pointeur, changements de série et période, zoom, filtres, recherche, navigation mobile et récupération après panne de données.
- 13 paires de contraste mesurées.
- Invitation d’installation silencieuse à la première visite, engagement préalable et masquage mémorisé.
- PWA : shell hors ligne, données financières non mises en cache, retour en ligne explicite.
- Analyse mécanique Impeccable des nouveaux composants : aucune finding, aucune suppression ajoutée. Les anciennes bordures latérales ont disparu avec la feuille de styles remplacée.

Captures : output/playwright/warrants-1440.png et warrants-390.png. Deux passages visuels, corrections groupées entre les deux : densité du panneau, libellé de probabilité, accès à la méthode sur mobile, lien identifiable sans couleur. La relecture ne remplace pas un test VoiceOver/NVDA matériel ; aucune validation avec ces lecteurs d’écran n’est revendiquée.

## Limites produit

Premier lot prospectif, aucune clôture. Cotations publiques indicatives, heure émetteur inconnue. DIC lié mais non validé juridiquement par le moteur. Le classement n’a pas encore de validation prospective. Le nombre quotidien est limité par les données et l’éligibilité, pas forcé à trois en cas de panne.
