# Warrants : protocole de recherche reproductible

Version du moteur : 1.0.0. Publication : 19 octobre 2026.

## Objet

Comparer des warrants européens standard disponibles chez un courtier à une distribution de remboursements. Le résultat est une estimation conditionnelle, pas une espérance réelle connue ni une consigne d'achat. Le périmètre exclut barrières, turbos, cappés, warrants américains et contrats dont le DIC n'est pas vérifié.

## Entrées et provenance

Pour chaque contrat : ISIN, code, sous-jacent, sens, strike, ratio multiplicatif, devise, échéance, référence de règlement, dernier jour coté, bid, ask, quantité disponible, horodatage, émetteur, source, frais et minimum d'ordre du courtier. Une parité 20:1 correspond au ratio 0,05.

Pour chaque sous-jacent : dates strictement croissantes et clôtures positives, ajustées des splits ; source et date de collecte. Les dividendes ne sont pas réinvestis dans ces données. Pour une publication automatisée, vérifier les droits d'utilisation du fournisseur et conserver les réponses brutes avec leur empreinte.

Le jeu de référence, conservé séparément dans tests/fixtures/reference-snapshot.json, comporte six contrats et cinq historiques, du 18 octobre 2021 au 16 octobre 2026. Les cotations ont été vérifiées le 16 octobre chez SG ; Q433S, Q439S et Z377S ont aussi été vérifiés sur leur page Bourso avec le badge BoursoMarkets. La disponibilité et le tarif des autres contrats restent à vérifier chez le courtier. Le catalogue courant vient de relevés publics quotidiens. Leurs dates ne remplacent jamais celles du jeu de référence.

## Quantité et coûts

Avec B le budget, A l'ask, f le courtage fixe et c le courtage proportionnel :

    q = floor((B - f) / (A * (1 + c)))
    coût = q * A * (1 + c) + f

Si aucune unité n'est achetée, aucun courtage n'est imputé. Si un minimum de courtage m est applicable, utiliser frais = max(f + c × notionnel, m) et chercher la plus grande quantité entière dont notionnel + frais ≤ B. Le champ commissionMin exprime ce minimum ; par exemple hors BoursoMarkets : commission=0, commissionPct=0.1, commissionMin=9.95 selon la brochure du 5 octobre 2026. Respecter aussi le minimum d'ordre, hors courtage. Les calculs supposent le nombre d'unités disponible ; ils ne simulent pas la profondeur d'un carnet ni un ordre fractionné. Le spread est déjà subi par l'achat à l'ask. En cas de revente immédiate au bid, perte = q * (ask - bid), plus courtage. Un remboursement à échéance n'a pas un second spread de revente.

Les produits BoursoMarkets sélectionnés affichent 0 EUR de courtage ; hors offre, consulter la brochure en vigueur et renseigner commission/commissionPct. Les coûts de structuration sont incorporés au prix. Les résultats sont avant fiscalité, abonnement éventuel de compte et coût d'opportunité.

## Paiement contractuel

Call en USD et paiement EUR :

    V(S) = max(S - K, 0) * ratio / EURUSD
    résultat net = q * V(S) - coût

Put : remplacer S - K par K - S. EURUSD signifie dollars par euro. Pour un sous-jacent EUR, aucune conversion. Le ratio, le fixing, la date et la devise sont à confirmer dans le DIC. Le modèle ne couvre pas défaut de l'émetteur ou résiliation extraordinaire.

Seuil call rentable : K + coût/q * EURUSD/ratio. Pour un put, soustraire ce montant. Pour ×m du capital investi, multiplier coût/q par m. « ×5 » signifie récupérer cinq fois la mise, donc un bénéfice de quatre fois la mise. Il ne s'agit pas de la probabilité de toucher un cours puis revendre avant l'échéance.

## Modèle empirique

1. Estimer l'horizon en séances de bourse. L'estimateur embarqué exclut les week-ends, Thanksgiving, Noël et le jour de l'An ; les autres jours fériés et les horaires ne sont pas tous modélisés. Pour l'exécution, brancher un calendrier de place officiel.
2. Calculer G_i = clôture(i + horizon) / clôture(i), sur un an puis cinq ans.
3. Par défaut, centrer les facteurs : G'_i = G_i / moyenne(G). La moyenne des variations projetées est nulle. Cela évite de transformer la hausse passée d'une entreprise en prévision implicite.
4. Projeter S_final_i = S_actuel * G'_i, puis appliquer V.
5. Espérance = moyenne des résultats nets. P(gain) = part strictement positive. P(×5) = part des remboursements ≥ 5 * coût. P(perte totale) = part des remboursements nuls.

Les fenêtres glissantes se chevauchent : elles ne sont pas des essais indépendants. Conserver le drift historique est une variante explicitement optimiste, jamais une validation de cet optimisme. Les historiques sont exploratoires ; aucune cotation historique de chaque warrant n'est reconstituée.

## Sensibilité lognormale

Comparer une loi lognormale dont le rendement moyen du sous-jacent vaut zéro, avec la volatilité annualisée des logarithmes des variations sur 20, 60 et 252 séances (écart-type corrigé, multiplié par racine(252)). Temps = jours calendaires / 365. Les probabilités utilisent la normale cumulée et l'espérance intègre le remboursement analytique.

Ce modèle n'est pas une extraction de la distribution risque-neutre d'une surface complète d'options. La volatilité implicite affichée par un émetteur ne donne pas seule les probabilités physiques. Des sauts, une asymétrie ou un changement de régime peuvent invalider la loi.

## Incertitude

Bootstrap par blocs : tirer des blocs contigus de facteurs G_i pour obtenir autant d'observations que l'échantillon. Taille du bloc = horizon en séances. Recentrer chaque échantillon si le rendement moyen nul est demandé, puis recalculer l'espérance. Utiliser les quantiles 2,5 % et 97,5 %. Le navigateur effectue 2 000 répétitions ; la référence Python 5 000, avec des générateurs pseudo-aléatoires différents. Les valeurs peuvent donc légèrement différer.

Cet intervalle est conditionnel au modèle empirique. Il ne couvre pas tout le risque de modèle ni le biais de recherche après choix parmi plusieurs contrats. Ne pas lire « 95 % » comme une garantie de gain ou une borne sur la perte du portefeuille.

## Filtres et classement

- Rejeter données manquantes, sens/ratio/devise non pris en charge, bid > ask, échéance passée, budget insuffisant.
- Afficher âge des historiques et des prix. Plus d'une séance dans l'estimateur est signalée comme ancien ; ce n'est pas un contrôle intrajournalier de prix exécutable.
- L'écran trie par espérance empirique sur cinq ans pour explorer. Le batch trie par l'espérance minimale parmi les modèles.
- « Non robuste » signifie qu'au moins une espérance comparée n'est pas positive.
- « À valider » signifie seulement que les espérances des modèles comparés sont positives. La borne bootstrap, la sélection multiple et la validation prospective restent à examiner.

Une sélection automatique exploitable doit fixer avant les tests un spread maximal, un âge maximal en secondes, une capacité disponible, un historique minimal, une borne d'espérance après stress et une validation hors échantillon. Ne jamais desserrer ces seuils parce que la liste est vide.

## À l'échelle

Le batch local accepte un catalogue CSV. Le navigateur accepte jusqu'à 10 000 contrats, traite les calculs en Web Worker et pagine la liste. L'import reste local, sans envoi au serveur. Pour de gros univers, grouper par sous-jacent/horizon, mettre en cache les facteurs de variation, puis lancer le bootstrap sur une présélection. La version actuelle ne prétend pas posséder un flux de tous les warrants du courtier.

Mesure locale du 19 octobre 2026 : 10 000 évaluations répétées des six contrats de référence, cinq modèles chacune, cache partagé des scénarios, en 19,24 secondes et 86,6 MiB de RSS maximal sous Node 24.13.0. Réseau, bootstrap et rendu navigateur exclus ; ce test ne représente pas un univers de 10 000 contrats distincts. Script : scripts/benchmark-research.mjs ; preuve : docs/research-benchmark.json.

Architecture cible : collecteur autorisé -> archive brute horodatée -> normalisation ISIN -> vérification DIC -> scénarios partagés -> filtres fixés -> validation -> registre prospectif. Utiliser des clés d'idempotence (ISIN, timestamp, version de source). Écrire les nouveaux snapshots atomiquement. Conserver les anciennes cotations en cas de panne sans modifier leur fraîcheur. Limiter la concurrence et respecter les limites du fournisseur.

Un LLM peut extraire des champs de DIC ou rechercher une date de résultats, avec source et contrôle déterministe. Il ne doit pas inventer une cotation ou une probabilité. Warrants ne lance aucun appel LLM.

## Validation hors échantillon et comparaisons multiples

En sélectionnant des milliers de contrats, le meilleur résultat historique est souvent favorisé par le hasard. Utiliser des périodes d'apprentissage et de validation strictement séparées, des découpages chronologiques, une purge des observations dont les horizons se chevauchent et un embargo adapté. Geler le protocole avant l'évaluation.

La correction doit porter sur toute la famille effectivement explorée (contrats, fenêtres, paramètres), pas seulement sur les finalistes. Employer une procédure adaptée telle que contrôle du taux de fausses découvertes pour des tests valides, ou une méthode de rééchantillonnage de la statistique maximale. Le screener ne réalise pas cette correction et ne fournit pas de p-values de rentabilité.

Les données de clôture ne suffisent pas à un backtest d'achats/reventes de warrants : il faut l'historique de leur carnet, les expirés, les commissions de l'époque et les états de cotation. Inclure échecs de collecte, produits rejetés et pertes à zéro. Comparer à une règle préspécifiée et à l'absence de position. Mesurer les résultats après coûts, leur dispersion, leur calibration et les drawdowns.

## Suivi

Le bouton Enregistrer fige contrat, prix, instant, date d'analyse et hypothèses dans le stockage local du navigateur. Il est modifiable/effaçable et n'est pas un registre inviolable. Exporter régulièrement. Avant l'échéance, aucun résultat réalisé n'est inventé. Pour un registre auditable, utiliser un stockage serveur append-only, des empreintes et un contrôle d'accès.

## Commandes

    npm run research:collect -- --output output/nouveau-snapshot.json
    npm run research:collect -- --quotes /chemin/catalogue.csv --output output/nouveau-snapshot.json
    npm run research:screen -- --input output/nouveau-snapshot.json --bootstrap --output output/classement.json
    npm run test:research

Le collecteur historique appelle le chart API public Yahoo avec 5y/1d, refuse une réponse courte et retire une séance en cours si les métadonnées du fournisseur l'identifient. Il garde l'ancien historique en cas de panne et sort avec un code d'échec. Cette interface publique n'offre pas ici de SLA et peut refuser des requêtes. research-quotes.mjs relève séparément les fourchettes publiques Bourso et découvre des contrats, sans compte courtier. Ne pas publier un snapshot partiellement actualisé comme une référence homogène.

CSV (UTF-8, virgule ou point-virgule ; cellules avec guillemets autorisées) :

    id,isin,underlying,direction,strike,ratio,bid,ask,currency,expiry,quoteAt,commission,commissionPct,minOrder
    Z377S,DE000FG35JX0,PLTR,call,225,0.05,0.25,0.26,USD,2026-12-18,2026-10-16T21:57:41+02:00,0,0,500

JSON : schéma fourni dans schema.json. Closes et dates doivent avoir la même longueur ; le sous-jacent CSV doit exister dans assets. Historique absent : rejet du calcul, sans substitution. Les imports ne sont conservés que pendant la session ; les observations sauvegardées restent locales. Un export d'analyse peut être rouvert comme preuve ; pour réimporter le catalogue, utiliser l'export catalogue complet.

## Vérification de référence

Palantir Z377S, ask 0,26 EUR, 11 538 unités, 2 999,88 EUR investis, EURUSD 1,124, 43 séances :

- Historique centré cinq ans : espérance +833,67 EUR ; P(gain) 16,50 % ; P(×5) 9,74 % ; P(zéro) 80,94 %.
- Historique centré un an : espérance -15,32 EUR.
- Seuil rentable : 230,8448 USD ; seuil ×5 : 254,224 USD.
- Référence Python, 5 000 blocs : intervalle conditionnel d'espérance environ [-882 ; +2 426] EUR.

La positivité n'est donc pas robuste. Ce contrôle sert à empêcher le moteur de transformer cette étude en « pépite validée ».

## Sources

- Contrats et DIC : https://www.sgbourse.fr/
- DIC de référence : https://kid.sgmarkets.com/public/api/kid/isin/DE000FG35JX0?lang=fre
- Cotation Bourso : https://www.boursorama.com/bourse/produits-de-bourse/cours/warrants/3rPDE000FG35JX0
- Frais : https://www.boursorama.com/content/brochure_tarifaire/boursorama_bt.pdf
- Historique de référence : https://query1.finance.yahoo.com/v8/finance/chart/PLTR?range=5y&interval=1d
- Résultats Palantir : https://investors.palantir.com/news-details/2026/Palantir-Announces-Date-of-Third-Quarter-2026-Earnings-Release-and-Webcast/

## Migration du site

fin.keff.uk accueille les projets ; /warrants/ la recherche sur warrants et /crp/ l'application existante. crp.keff.uk redirige vers fin.keff.uk/crp/. Les APIs CRP gardent leur chemin /api/ ; le Worker, D1 et son journal sont conservés. Le stockage local et les installations PWA appartiennent à l'origine : les préférences de l'ancien domaine ne se transfèrent pas automatiquement vers le nouveau.

## Collecte quotidienne publiée

La tâche GitHub Actions research-daily.yml démarre à 22 h 30 UTC du lundi au vendredi. Elle relève les contrats suivis, puis lit les deux premières pages de résultats Société Générale pour Nasdaq-100, Nvidia, Tesla, AMD et Palantir. Elle examine les maturités de 14 à 120 jours, sélectionne jusqu’à trois calls et trois puts par actif au spread relatif le plus faible et suit jusqu’à 100 contrats. Cette présélection dépend du classement du site source ; elle ne constitue ni un scan exhaustif ni une sélection sans biais.

Chaque fiche doit confirmer l’ISIN, le sous-jacent exact, la devise, le strike, la parité, le sens, la maturité, un statut actif, l’absence de quanto et une fourchette positive non inversée. Un filtre inconnu peut être ignoré par un site ; la vérification du sous-jacent dans la fiche est donc obligatoire. Les nouveaux produits gardent contractVerified=false tant que leur DIC n’a pas été vérifié. L’exercice européen standard reste une hypothèse de calcul visible dans le détail.

quoteAt et observedAt désignent l’heure du relevé de la page. sourceQuoteAt reste nul lorsque la source ne fournit pas l’heure du carnet. Ne pas présenter ce champ comme une cotation garantie à cet instant. Les réponses brutes et leur SHA-256 sont archivés dans les artefacts GitHub pendant 14 jours. Les dates et URL de provenance sont incluses dans snapshot.json. Un relevé ancien n’est pas rajeuni en cas d’échec.

Le collecteur recharge ensuite les cinq historiques quotidiens et le taux public EURUSD=X. La source publique peut être retardée, indisponible ou modifier son HTML. Aucun contrat non reconnu n’est complété par un LLM. L’app recalcule les estimations sur le dernier jeu publié ; elle ne met pas à jour les probabilités enregistrées dans le suivi.

La collecte ne nécessite pas d’appel de modèle. CRP conserve ses propres décisions payantes et son plafond existant. Le journal local des analyses conserve son identifiant de stockage. La suppression d’une analyse offre Annuler ; un import local reste actif jusqu’au retour explicite au catalogue public.


## Warrants : expérience en base 100 €

Vue : `/warrants/experience/`. JSON identique : `/api/warrants/comparison` ; MCP : `get_warrant_experiment`.
Chaque contrat a sa propre mise de référence de 100 €, sans portefeuille global ni réinvestissement.
L'achat source est de 3 000 € : quantité entière maximale au premier ask, frais d'entrée déduits,
espèces résiduelles conservées. Valeur = (espèces + quantité × dernier bid − frais de sortie) / 30.
Gain = valeur − 100 €. Le minimum d'ordre du catalogue (500 €) s'applique à l'achat source :
un achat réel de 100 € n'est pas simulé. La perte maximale est le coût d'entrée / 30.

BoursoMarkets vérifié dans le premier relevé : frais d'entrée nuls ; sinon hypothèse prudente
au moins 0,1 %, minimum 9,95 € par ordre source. La revente reprend les hypothèses du relevé
valorisé ; frais plafonnés au produit de cession pour un warrant sans recours supplémentaire.
Le spread est inclus (ask à l'achat, bid à la valorisation). Impôts exclus.
Les frais et quantités sont affichés dans le détail ; ce sont des hypothèses, pas une facture de courtier.

Les six contrats initiaux utilisent les références du 16 octobre 2026, reprises du premier snapshot
Git publié (`6706c78`). Les 18 autres démarrent à leur première observation du 19 octobre UTC
(20 octobre à Paris). Les deux snapshots suivants (`630bf47`, `f8cc805`) ont également été archivés.
Il n'y a aucune reconstruction de cours de warrant à partir de son sous-jacent.
Les valeurs de référence ne sont pas des preuves d'exécution historique.

`warrantExperiment` dans `public/research/snapshot.json` conserve les entrées et relevés.
La collecte quotidienne ajoute les nouveaux timestamps, conserve les expirés dans cette archive,
ne duplique pas une cotation conservée après échec et refuse un changement de termes pour un même ISIN.
Une panne conserve la dernière date et affiche un ancien relevé ; elle ne transforme pas la valeur en zéro.
Après échéance, faute de remboursement enregistré, le résultat final est indisponible.
Les nouveaux contrats ont des dates d'entrée différentes. La liste complète est conservée :
ce suivi n'est ni une sélection rétrospective des gagnants ni un backtest prouvant un avantage.
