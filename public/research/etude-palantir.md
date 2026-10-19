# Étude exploratoire de warrants — 19 octobre 2026

Conclusion : Z377S affiche une espérance positive dans le modèle historique sur cinq ans, mais cet avantage ne résiste pas à tous les contrôles. Aucune espérance réelle positive n'est démontrée. La recherche couvre des calls sur Nasdaq-100, Nvidia, Tesla, AMD et Palantir, sans prétendre couvrir toute l'offre Bourso.

## Produit et cotation vérifiée

- Z377S, ISIN DE000FG35JX0, call Palantir, strike 225 USD, parité 20:1, non quanto.
- Échéance : 18 décembre 2026 ; règlement : 28 décembre 2026.
- SG : bid 0,25 EUR / ask 0,26 EUR, 350 000 unités de chaque côté, vendredi 16 octobre à 21:57:41. Bourso affiche aussi 0,25 / 0,26 et le badge BoursoMarkets 0 EUR.
- Marchés fermés au moment de la recherche. Ce prix ne confirme pas une exécution à l'ouverture du lundi.
- [Bourso](https://www.boursorama.com/bourse/produits-de-bourse/cours/warrants/3rPDE000FG35JX0) ; [émetteur](https://www.sgbourse.fr/product-details/z377s) ; [DIC officiel](https://kid.sgmarkets.com/public/api/kid/isin/DE000FG35JX0?lang=fre).
- [Tarifs Bourso](https://www.boursorama.com/content/brochure_tarifaire/boursorama_bt.pdf) : courtage des produits BoursoMarkets nul. Hypothèse de compte sans abonnement additionnel occasionné par cette position.
- [Résultats Palantir le 2 novembre après clôture](https://investors.palantir.com/news-details/2026/Palantir-Announces-Date-of-Third-Quarter-2026-Earnings-Release-and-Webcast/). Le résultat de cette publication n'est pas prédit par le modèle.

## Position de 3 000 EUR

11 538 warrants à 0,26 EUR = 2 999,88 EUR, reliquat de 0,12 EUR.
Perte maximale de la position : 2 999,88 EUR. Achat payé intégralement, sans appel de marge ni barrière désactivante.
Écart achat/vente immédiat : 115,38 EUR. Il est déjà pris en compte par l'achat au prix vendeur ; aucun second spread de revente n'est soustrait à un remboursement à échéance.

Remboursement unitaire à échéance : max(cours final USD - 225, 0) / (20 × EURUSD).
Hypothèse constante EURUSD = 1,124 ; résultats avant fiscalité, sans défaut de l'émetteur ni événement extraordinaire.

- Rentabilité à partir de 230.8448 USD, soit 24.09 % au-dessus de 186.03 USD.
- Warrant ×5 à partir de 254.2240 USD, soit 36.66 % ; remboursement 1,30 EUR/unité et bénéfice 11 999,52 EUR.
- Palantir à 240 USD : bénéfice 4 698,96 EUR ; 260 USD : 14 964,09 EUR ; 225 USD ou moins : perte intégrale.

## Méthode statistique

Source : séries quotidiennes publiques Yahoo Finance, requête chart range=5y, interval=1d, téléchargées le 19 octobre. Fichiers JSON figés inclus. 1 255 clôtures par actif, du 18 octobre 2021 au 16 octobre 2026 ; prix ajustés des splits par le fournisseur, dividendes non réinvestis.

Pour Palantir : 1 212 variations glissantes sur 43 séances, approximation des 60 jours calendaires jusqu'au 18 décembre. Chaque facteur de variation est divisé par la moyenne des facteurs, pour imposer un rendement moyen nul de l'action. Cela évite d'extrapoler mécaniquement sa hausse historique. Application du remboursement exact du warrant à chaque scénario, conversion FX fixe et soustraction du prix vendeur payé.

Ce ne sont pas 1 212 essais indépendants. L'incertitude est approchée par 5 000 rééchantillonnages de blocs de 43 observations successives, avec recentrage de chaque échantillon. Cet intervalle ne couvre ni toute l'incertitude de modèle, ni le biais de sélection après comparaison de plusieurs produits. Aucun historique complet des cotations de warrants n'a été obtenu : il ne s'agit pas d'un backtest de transactions réellement exécutables ni d'une validation hors échantillon.

## Résultats

Modèle empirique cinq ans, hausse moyenne retirée :

- Probabilité de profit : 16.50 %.
- Probabilité de remboursement au moins ×5 : 9.74 %.
- Probabilité de perte intégrale : 80.94 %.
- Espérance nette : 833.67 EUR.
- Intervalle bootstrap conditionnel à 95 % sur cette espérance : [-882.16 ; 2426.12] EUR.

Même méthode sur la dernière année : espérance -15,32 EUR ; profit 18,57 % ; ×5 8,10 %.
Autre modèle lognormal, rendement moyen nul : avec volatilité du dernier mois 42,10 %, espérance -1 807,42 EUR ; avec volatilité des trois derniers mois 71,99 %, +1 721,39 EUR ; avec celle de la dernière année 58,96 %, +27,90 EUR.

Le signe de l'espérance dépend donc du régime futur. Un résultat favorable conditionnel ne prouve pas un avantage exploitable. Les probabilités ci-dessus concernent le remboursement final ; atteindre un prix de revente ×5 avant l'échéance nécessite aussi un modèle d'évolution de la volatilité et des spreads. Un euro plus fort réduit le remboursement en euros. Les interruptions de cotation peuvent empêcher une sortie.

## Reproduction

Python 3, bibliothèque standard uniquement : `python3 analyse.py` dans ce dossier. Le programme lit les cinq JSON figés et écrit `resultats.json`. Tous les scénarios sont avant impôts et coûts d'opportunité.
