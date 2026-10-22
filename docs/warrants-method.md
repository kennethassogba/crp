# Warrants — sélection et test prospectif

Version : warrants-20s-v1. Première cohorte : 22 octobre 2026. Une simulation indépendante de 1 000 € par sélection, avant impôts. Aucun ordre transmis. Aucun avantage prédictif validé.

## Collecte quotidienne

Le workflow GitHub `Daily warrant research` est planifié lundi–vendredi à 21 h 30 UTC, après la clôture régulière américaine. GitHub peut retarder un lancement. La date d’un lot est la date à Paris de son calcul. Week-ends et jours fériés NYSE ne créent pas de lot. Une même journée ne peut contenir qu’un lot publié, au maximum trois sélections. Un ISIN n’est jamais repris, même après clôture.

L’univers est limité aux warrants Société Générale standard sur NDX, NVDA, TSLA, AMD et PLTR. Ce n’est pas un recensement de tous les warrants BoursoBank. Le collecteur visite les premières pages et fait tourner quatre pages de recherche supplémentaires chaque jour. Il confirme l’ISIN, le sous-jacent, le sens, le strike, la devise, la parité, l’échéance, l’absence de quanto et le statut actif sur chaque fiche produit. Les positions ouvertes sont prioritaires dans le rafraîchissement.

Les bid/ask publics sont horodatés à la lecture de la page. L’heure de cotation émetteur est inconnue : ce n’est pas un flux exécutable. Un échec conserve le précédent prix avec sa date initiale. Les pages sources sont sauvegardées avec SHA-256 dans les artefacts du workflow pendant 14 jours ; les prix archivés restent dans Git et snapshot.json. Chaque lot conserve le SHA-256 exact du snapshot utilisé.

Yahoo Finance fournit cinq années de clôtures complètes, le prix récent du sous-jacent et EUR/USD. Les clôtures incomplètes sont exclues. Le prix récent et son heure sont distincts des clôtures. Une absence ou un échec de collecte interdit la sélection de l’actif concerné.

## Filtre avant classement

- Achat simulé de 1 000 €, unités entières et ordre d’au moins 500 €.
- Badge BoursoMarkets confirmé sur la fiche ; frais d’achat et de vente simulés à 0 €. Le spread est payé. Les autres tarifications sont exclues de ce test.
- Bid strictement positif, spread relatif `(ask-bid)/ask` au maximum 8 %.
- Relevé du warrant depuis moins de deux heures ; prix du sous-jacent depuis moins de quatre heures, décalage maximal de quatre heures. Le relevé peut être postérieur à la fermeture du marché ; aucune synchronisation d’exécution n’est garantie.
- Au moins 500 clôtures valides, chronologiques, sans date future, avec une dernière clôture vieille d’au plus une séance.
- Échéance après la vingtième séance + sept jours calendaires, et à moins de 120 jours.
- Change valide et daté depuis moins de quatre jours, sans horodatage futur.

Les caractéristiques sont extraites des pages Bourso. Le modèle suppose un exercice européen standard, sans validation juridique automatique du DIC. Le DIC fourni par l’émetteur est lié dans chaque analyse. Les frais réels et les caractéristiques contractuelles doivent être vérifiés avant tout ordre réel.

## Prévision avant échéance

Il faut réévaluer le warrant après vingt séances, pas utiliser son seul paiement final. Le moteur calibre une volatilité implicite sur le milieu du bid/ask par inversion de Black–Scholes. Les taux et dividendes sont supposés nuls. Un prix qui ne permet pas cette inversion est exclu.

Chaque fenêtre historique de vingt rendements quotidiens du sous-jacent est rejouée à partir de son prix récent. La moyenne des rendements logarithmiques de la fenêtre d’apprentissage est retirée, pour ne pas supposer la répétition de la tendance passée. Les trajectoires conservent les successions de rendements historiques et peuvent se chevaucher ; elles ne sont pas des observations indépendantes.

À chaque séance simulée, le temps restant jusqu’à échéance diminue. Le warrant est réévalué avec sa volatilité implicite initiale, puis le demi-spread initial est soustrait pour obtenir un bid théorique, borné à zéro. La conversion USD/EUR, les taux, les dividendes et le spread restent constants. Ce sont des hypothèses de recherche : ni un prix de revente certain ni une distribution calibrée de résultats futurs.

Trois variantes sont calculées : environ cinq ans d’historique, un an, et cinq ans avec volatilité implicite réduite de 20 %. Les statistiques principales viennent de la première. Le score de classement est :

    0.5 × gain net P90 + 0.5 × min(espérance 5 ans, espérance 1 an, espérance stress)

Les trois meilleurs scores sur des sous-jacents différents sont retenus. Une espérance négative reste affichée comme négative. Les filtres ne forcent jamais trois sélections si les données manquent. Ni le score ni une espérance simulée positive ne démontrent un avantage prédictif. Le choix des filtres et du score peut lui-même surajuster les historiques ; seul le suivi futur teste cette règle.

## Entrée et valorisation

Pour chaque sélection :

    quantité = floor(1 000 / ask)
    espèces = 1 000 − quantité × ask
    valeur de sortie = espèces + quantité × bid − frais de vente
    gain net = valeur de sortie − 1 000

L’entrée, les caractéristiques, la prévision et la règle sont figées dans `tracker.json`. Une nouvelle observation n’autorise ni réachat, ni modification du prix d’entrée, ni réallocation vers un gagnant. Les frais sont de zéro uniquement pour les fiches BoursoMarkets confirmées. Le moteur générique gère aussi les frais minimaux et proportionnels pour les tests.

Les 1 000 € sont une mise virtuelle par position, et non un capital global renouvelé. Trois sélections signifient donc trois simulations indépendantes de 1 000 €, pas trois achats avec une enveloppe unique de 1 000 €.

## Sortie confirmée par l’utilisateur

Sortie au premier relevé qui atteint 2 000 € (+100 %) ou tombe à 500 € (−50 %), sinon à partir de la vingtième séance américaine. Le calendrier prend en compte les jours fériés réguliers NYSE, pas les fermetures exceptionnelles imprévues.

Le prix est le bid effectivement observé, avec les frais du relevé. Un gap peut dépasser l’objectif ou la perte de 50 %. Le relevé quotidien ne détecte pas les franchissements intrajournaliers. Une sortie théorique dans un scénario quotidien n’est pas une promesse d’ordre stop exécutable. La perte maximale est le montant engagé ; les espèces restantes sont conservées.

Un prix absent ne clôture pas une position à zéro. Une absence à la sortie prévue reste une sortie en attente jusqu’au prochain prix valide avant échéance. Après échéance, si le remboursement réel manque, la valorisation devient indisponible ; aucun paiement théorique ne remplace un paiement observé. Les positions manquantes sont comptées séparément, jamais supprimées du journal.

## Mesure du modèle

Les résultats ne portent que sur les nouvelles sélections prospectives. L’ancienne simulation Q433S et les historiques observés avant cette version ne deviennent pas des recommandations rétrospectives.

- Gain réalisé, rendement sur le capital des positions clôturées et gain moyen après spread et courtage, avant impôts.
- Part des clôtures gagnantes, avec leur nombre.
- Probabilité de gain initiale comparée au résultat binaire positif/négatif.
- Brier = moyenne de `(probabilité initiale − résultat binaire)^2`. Une prévision constante à 50 % vaut 0,25. Plus bas est mieux ; cela ne mesure pas à lui seul le profit.
- Tableau de calibration en cinq tranches de probabilités.

Avant trente clôtures, l’échantillon est déclaré insuffisant. Trente ne constituent pas un seuil de preuve. Les positions sur un même marché et à des dates proches sont corrélées. Les résultats manquants peuvent biaiser l’échantillon : leur nombre reste visible. Les gains ouverts et les prévisions ne sont jamais des gains réalisés.

## Graphiques

Les courbes utilisent les prix réels archivés du warrant ou les cours du sous-jacent, au choix. Les deux séries ne sont jamais confondues. Avant sélection, la courbe est atténuée ; à partir du jour de sélection elle prend la couleur du suivi. Aucun capital simulé n’est calculé avant l’entrée. Les historiques quotidiens du sous-jacent sont datés au jour, sans heure fabriquée. L’interaction suit les références [Apple Bourse](https://support.apple.com/en-euro/guide/iphone/iph1ac0b1bc/26/ios/26) et [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/). Les graphiques gardent une lecture au clavier et au toucher.

## Reproduire

Node.js 24 et Python 3. Aucun appel de modèle payant.

    npm ci
    npm test
    npm run research:quotes
    npm run research:collect
    npm run research:track
    npm run research:package

La collecte exige le réseau. Les tests utilisent des données figées ou synthétiques, distinctes du journal public. Les fichiers de données et chaque lot restent versionnés dans Git. L’API et MCP sont en lecture seule. Toute modification de la règle exige une migration explicite et une nouvelle version, sans réécrire les résultats des cohortes précédentes.

## Références

[Tarifs BoursoBank](https://www.boursobank.com/content/brochure_tarifaire/boursorama_bt.pdf), [offre BoursoMarkets](https://www.boursobank.com/bourse/boursomarkets-courtage-bourse-gratuit), [guide warrants Société Générale](https://www.sgbourse.fr/SiteContent/5/5/2/923/96/Guide_Warrants.pdf).
