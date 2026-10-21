# Fin

Application de recherche financière en français. Une navigation commune pour Warrants et CRP ; le tableau conduit au détail du contrat ou de la décision.

- Inspiration Apple Bourse : listes compactes avec mini-courbes, montants alignés, variation signée et panneau de détail avec grand graphique. Le modèle sélectionné reste clairement indiqué.
- Police système Apple lorsqu’elle est disponible, Public Sans ailleurs. Mode sombre uniquement (#000000), surfaces #111113, accent bleu. Gains en bleu et pertes en rouge ; pas de vert. Ne pas réintroduire Geist.
- Le nom Fin reste du texte. Pas de symbole décoratif, monogramme ni faux sélecteur d’espace.
- Une seule entrée React, `src/fin/main.tsx`, et une feuille de styles commune.
- Les résultats et les actions passent avant les explications. Mettre les calculs et les limites détaillés dans Méthode ou dans un volet explicite.
- Les graphiques donnent une valeur au survol, au toucher et au clavier. Les informations restent lisibles sans couleur.
- Les données portent leur date et leur source. « Relevé » désigne l’heure de lecture, pas une garantie de cotation.
- Les contrôles, tableaux et dialogues restent utilisables à 320 px et avec le texte agrandi. Les tableaux qui défilent sont nommés et accessibles au clavier.

Ces choix suivent la demande du 20 octobre 2026 : interface sobre, textes courts, Warrants et CRP réunis, retrait de l’ancienne police et des logos décoratifs.

La référence visuelle actuelle est [Apple Bourse](https://support.apple.com/en-ie/guide/iphone/iph1ac0b1bc/ios). La demande de s’en inspirer remplace la direction Linear initiale. Les courbes proviennent des données enregistrées : pas de mini-courbe inventée pour les warrants dont l’historique de prix manque. Le catalogue montre les historiques des sous-jacents avec une période explicite. Le portefeuille Warrants de 1 000 € utilise uniquement les bid/ask archivés, une entrée fixe par contrat et les dates réelles ; elle distingue les références initiales des observations collectées.


Le 21 octobre : même composant `PortfolioView` pour Warrants et CRP, réunis dans l’accueil.
Une position Q433S à J1, trois modèles IA, 1 000 € au départ par simulation.
Le journal CRP reste inchangé, seule sa base d’affichage devient 1 000 €.
Aucun sous-logo k_eff, double fil d’Ariane ou paragraphe d’aide permanent.
Afficher le capital, le gain/perte et la courbe ; mettre les positions, frais et limites dans Détails.
