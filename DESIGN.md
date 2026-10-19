# Fin

Application de recherche financière en français. Une navigation commune pour Warrants et CRP ; le tableau conduit au détail du contrat ou de la décision.

- Public Sans, mode sombre uniquement (#101113), surfaces #161719 et accent violet discret. La demande explicite de mode sombre remplace le fond blanc antérieur. Ne pas réintroduire Geist.
- Le nom Fin reste du texte. Pas de symbole décoratif, monogramme ni faux sélecteur d’espace.
- Une seule entrée React, `src/fin/main.tsx`, et une feuille de styles commune.
- Les résultats et les actions passent avant les explications. Mettre les calculs et les limites détaillés dans Méthode ou dans un volet explicite.
- Les graphiques donnent une valeur au survol, au toucher et au clavier. Les informations restent lisibles sans couleur.
- Les données portent leur date et leur source. « Relevé » désigne l’heure de lecture, pas une garantie de cotation.
- Les contrôles, tableaux et dialogues restent utilisables à 320 px et avec le texte agrandi. Les tableaux qui défilent sont nommés et accessibles au clavier.

Ces choix suivent la demande du 20 octobre 2026 : interface sobre inspirée de Linear, textes courts, Warrants et CRP réunis, retrait de l’ancienne police et des logos décoratifs.
