# Fin · Expérience warrants

[Sélections](https://fin.keff.uk/) · [Positions](https://fin.keff.uk/positions/) · [Résultats](https://fin.keff.uk/resultats/) · [Protocole](docs/warrants-method.md)

Le modèle classe des warrants accessibles chez BoursoBank. L’expérience mesure ensuite leurs résultats réels observés et la qualité de ses prévisions, figées avant la sélection. Le suivi prospectif commence le **22 octobre 2026**. Aucune rentabilité n’est encore démontrée.

## L’expérience

| Règle | Application |
| --- | --- |
| Sélection | Jusqu’à trois nouveaux warrants par jour ouvré, sur des sous-jacents différents. Un même ISIN n’est pas sélectionné deux fois. |
| Mise | **1 000 € par warrant**, indépendamment des autres positions. Aucun capital global réinvesti. |
| Entrée | Unités entières au prix vendeur (ask), courtage déduit et espèces restantes conservées. |
| Suivi | Valeur au prix acheteur (bid), après frais de sortie, avant impôts. |
| Clôture | Après **20 séances américaines**, ou au premier relevé quotidien à **+100 % / −50 %**. |
| Traçabilité | Prix d’entrée, prévision et règle de sortie figés. Les observations suivantes sont ajoutées au journal. |

Les seuils sont constatés au relevé, sans exécution intrajournalière : une perte peut dépasser −50 %. Le capital investi dans le warrant peut être perdu entièrement. Aucun ordre réel n’est envoyé.

## Le modèle

Le moteur réévalue chaque warrant avant son échéance sur des trajectoires de vingt séances tirées de l’historique du sous-jacent. La moyenne des rendements logarithmiques est retirée : le classement ne suppose pas que la tendance passée continue.

La volatilité implicite est calibrée sur le milieu de la fourchette bid/ask initiale, avec Black–Scholes. Chaque trajectoire applique les règles de sortie et les frais de la simulation. Trois variantes sont calculées : historique d’environ cinq ans, historique d’un an, et volatilité implicite diminuée de 20 %.

Le score, en euros nets pour 1 000 € engagés, est :

```text
score = 0,5 × gain au percentile 90
      + 0,5 × min(gain moyen sur cinq ans,
                  gain moyen sur un an,
                  gain moyen avec volatilité diminuée de 20 %)
```

Le score favorise un gain élevé dans les scénarios favorables, en pénalisant une espérance fragile. Il ne garantit ni un gain ni une espérance positive. Les probabilités affichées sont des fréquences de scénarios du modèle, pas des probabilités établies de marché. Aucun LLM ne choisit les positions.

### Quels produits sont admis ?

Le catalogue suivi couvre NDX, NVDA, TSLA, AMD et PLTR. La découverte de produits est limitée et renouvelée par rotation ; elle ne couvre pas tous les warrants BoursoBank.

Le moteur exige notamment une offre BoursoMarkets confirmée, un ordre d’au moins 500 €, un spread d’au plus 8 %, un prix relevé depuis moins de deux heures, un sous-jacent observé depuis moins de quatre heures et au moins 500 clôtures historiques complètes. L’échéance doit laisser vingt séances et sept jours de marge, sans dépasser 120 jours. Les cours de change nécessaires doivent être disponibles.

Les frais de courtage sont nuls uniquement pour les produits dont l’offre BoursoMarkets est confirmée. Le spread reste payé. Si les données ou les produits admissibles manquent, le lot contient moins de trois sélections, éventuellement aucune.

## Comment juger les résultats

Les prévisions initiales restent visibles face aux valeurs observées. Les positions ouvertes et clôturées sont séparées. Un prix manquant reste indisponible, jamais remplacé par zéro.

Les clôtures permettent de comparer le gain net moyen, la fréquence des gains et la calibration des probabilités. Le score de Brier mesure l’écart entre la probabilité de gain annoncée et l’issue observée ; plus il est bas, mieux c’est. Annoncer 50 % à chaque fois donne 0,25. Une bonne calibration ne suffit pas à rendre une stratégie rentable.

Les trajectoires historiques se recouvrent et les sélections peuvent être corrélées. Leur nombre ne correspond donc pas à autant d’essais indépendants. Le faible nombre de clôtures au début de l’expérience ne permet aucune conclusion solide. Les tests de calcul vérifient le programme, pas son avantage financier.

## Données et limites

Les prix et caractéristiques proviennent des fiches publiques BoursoBank ; les historiques des sous-jacents proviennent de Yahoo Finance. Les horodatages indiquent l’heure de lecture : l’heure de cotation de l’émetteur n’est pas connue. Ce sont des prix indicatifs, sans garantie d’exécution.

La collecte est prévue chaque jour ouvré à **21 h 30 UTC** ; un retard ou un échec reste possible. L’application consulte automatiquement les données publiées toutes les minutes et au retour en ligne. Cela ne transforme pas les relevés quotidiens en cotations temps réel.

Le modèle suppose des taux et dividendes nuls, ainsi qu’un change et un spread constants pendant chaque prévision. Il ne prévoit pas les annonces, les changements de liquidité ni les décisions de l’émetteur. Le DIC est lié depuis la fiche mais n’est pas validé juridiquement par le moteur.

## Reproduire et examiner

- [Moteur de sélection, prévisions, sorties et statistiques](lib/warrant-tracker.mjs).
- [Journal des sélections et des observations](public/research/tracker.json).
- [Catalogue, prix et historiques utilisés](public/research/snapshot.json).
- [Protocole complet et hypothèses](docs/warrants-method.md).
- [Tests de calcul et de suivi](tests/), avec un [jeu de référence figé](tests/fixtures/reference-snapshot.json). Le moteur de référence à échéance est distinct du classement à vingt séances.

L’[API publique](https://fin.keff.uk/openapi.json) et l’[accès MCP en lecture seule](https://fin.keff.uk/mcp) exposent les sélections, positions, résultats et catalogue. Les données de l’expérience peuvent être examinées sans passer par l’interface.

[Licences et attributions](THIRD_PARTY_NOTICES.md).
