# Fin

[Application](https://fin.keff.uk/) · [Warrants](https://fin.keff.uk/warrants/) · [CRP](https://fin.keff.uk/crp/) · [Sources et dates](https://fin.keff.uk/donnees/)

Une application React, une navigation, une feuille de styles et un dépôt public pour Warrants et CRP. Le Worker `crp-keff`, la base D1 et le journal CRP restent en place. `crp.keff.uk` redirige vers `fin.keff.uk/crp/` ; les APIs gardent leurs chemins `/api/`.

## Warrants

Le tableau compare prix d’achat, probabilité de multiple, gain moyen net et risque de perte totale. Ouvrir un contrat pour explorer la distribution au pointeur, au toucher ou au clavier, tester un cours final, comparer cinq modèles et enregistrer l’analyse. Le suivi reste local au navigateur et permet d’annuler une suppression. Les imports CSV/JSON restent locaux et ne sont pas remplacés par le rafraîchissement automatique.

Les calculs portent sur le remboursement à l’échéance, après frais et avant impôts. Ils ne prédisent pas une revente anticipée. Les nouveaux contrats supposent un warrant européen standard ; le DIC reste à vérifier. Une espérance positive n’est pas un avantage rentable démontré.

## Mises à jour

| Données | Collecte | Ce qui évolue |
| --- | --- | --- |
| Warrants | GitHub Actions, 22 h 30 UTC du lundi au vendredi | Bid/ask des contrats suivis, nouveaux candidats, clôtures des cinq sous-jacents et EUR/USD |
| Recherche de contrats | Deux pages Bourso par sous-jacent | Jusqu’à trois calls et trois puts par actif, au spread relatif le plus faible ; suivi limité à 100 contrats |
| Crypto | Worker toutes les 15 minutes, bougies complètes au plus une fois par heure | Cours, financement et résultat des positions simulées |
| Modèles CRP | Une décision par jour à 08 h UTC | Trois configurations actives, journal et résultats après sortie |
| Affichage | Au chargement, puis toutes les cinq minutes au premier plan | Dernier jeu publié ; aucun nouvel appel de modèle |

Le sous-jacent réel de chaque fiche doit correspondre au filtre demandé. Les quotes absentes, les produits inactifs ou quanto et les fourchettes incohérentes sont rejetés. L’heure publiée pour un warrant est celle de lecture de la page publique, pas un horodatage de cotation de l’émetteur. Le relevé ne garantit pas l’exécution. Les anciens prix gardent leur date en cas d’échec. Le périmètre ne couvre pas tout le catalogue Bourso.

La tâche [Daily warrant research](.github/workflows/research-daily.yml) conserve les réponses sources et leurs empreintes dans un artefact de 14 jours. Elle publie les relevés par commit, puis Workers Builds déploie le jeu de données. GitHub peut retarder une exécution programmée ; la date visible fait foi. Aucun secret supplémentaire ni appel LLM n’est utilisé pour cette collecte.

```sh
npm run research:quotes       # relever les prix et chercher des contrats
npm run research:collect      # actualiser clôtures et change
npm run research:screen       # analyser le catalogue en lot
npm run research:package      # préparer le moteur et les données téléchargeables
npm run test:research         # reproduire la référence financière figée
```

La référence du 16 octobre 2026 reste dans `tests/fixtures/reference-snapshot.json`. Les tests ne changent pas leurs résultats attendus à chaque nouveau cours. [Protocole complet](docs/warrants-method.md).

## Interface

Interface inspirée d’Apple Bourse : liste compacte, mini-courbes issues des données, montants alignés et grand graphique du modèle sélectionné. Police système Apple si disponible, Public Sans ailleurs, mode sombre uniquement. Le bleu remplace le vert pour les gains. Une seule entrée HTML, `index.html`. Les anciennes routes CRP et les liens `#models`, `#backtest` et `#method` restent lisibles. L’installation concerne désormais Fin ; les préférences et les analyses locales sont conservées.

---

# CRP

Daily BTC and ETH paper positions, with three active OpenAI configurations and a recorded outcome for each decision.

[Open CRP](https://fin.keff.uk/crp/) · [Method](https://fin.keff.uk/method.md) · [Public API](https://fin.keff.uk/openapi.json)

![CRP interface](https://fin.keff.uk/social-card.png)

## What it does

At 08:00 UTC, each configuration receives the same market snapshot and chooses cash, BTC or ETH, with 1× or 2× isolated margin leverage. Entry is scheduled for 09:00 UTC, after the response is recorded. The position closes 24 hours later or at its stop. The first prospective observation can start at another full hour.

The comparison starts each model at EUR 100 and distinguishes settled gains from provisional open-position valuation. Open a decision for its reasoning and position levels; History contains separate historical evaluations. Provider usage remains available in the public journal and API. It connects to no exchange account and places no orders. Reference levels are not executable quotes. Derivatives availability depends on your location and exchange.

## Installing the app

An optional **Installer** action appears in the header on the third visit, or after three minutes with the page visible. Visits must be separated by at least 30 minutes; quick reloads do not count. Dismissing the invitation hides it for 14 days. Counts and preferences stay in the browser’s local storage, with no analytics request or user account.

Supporting browsers open their installation prompt only after a click. On iPhone and iPad, the action opens instructions for adding Fin to the Home Screen. The invitation is hidden in standalone mode and after a recorded installation. If storage is blocked, the time-based invitation still works, but the dismissal cannot persist across visits.

Implementation references: [browser install prompt](https://web.dev/articles/customize-install) and [Apple Home Screen instructions](https://support.apple.com/en-euro/guide/iphone/iphea86e5236/ios). Browser policy tests simulate the installation event; physical device installation remains unverified.

## Data and evaluation

- Historical data: public Binance spot, USD-M perpetual, mark price and funding APIs, tested without authentication. The initial dataset contains 2,400 hourly candles per asset in each price series and 303 funding records per asset. [Access evidence](docs/data-access.json).
- Rule benchmark: 89 completed daily sessions, using fixed parameters and past-only features. Momentum is compared with daily BTC/ETH positions and passive spot holding. A second run doubles fees and slippage.
- Model replay: 14 shared historical snapshots for all five configurations. These retrospective results are exploratory and are never merged into prospective performance.
- Forward journal: decisions are stored before entry and settled against subsequent prices. Late, missing and failed responses do not become positions. No rule substitutes for a model response.

Daily collection uses public Kraken Futures trade, mark and index candles and hourly funding. Binance rejected requests from the deployed Cloudflare runtime with HTTP 403; Kraken was selected for prospective observations. The archive remains on its original venue, and non-cash positions cannot settle against prices from another venue. The five initial prospective Binance decisions were all cash.

The initial 75 successful provider requests cost $0.242856, based on returned token usage and the documented standard rates. This includes five prospective decisions and 70 historical replay decisions. The current run and cost records are in [models.json](public/data/models.json).

There is no fitted model, parameter search or claimed predictive advantage. Fourteen replay days are insufficient to establish profitability. Historical model replay can also be contaminated by information in model training; prospective observations are needed to assess performance. News and analyst consensus are outside this version.

Archived inputs keep their original version. Snapshot version 1.0.1 corrects the seven-day feature to span 168 hourly intervals; version 1.0.0 used 167. The trend benchmark does not use that feature. Recorded model decisions are not regenerated. Version 1.1.0 adds venue and funding-period handling for daily Kraken observations.

## Position rules

| Parameter | Value |
| --- | --- |
| Starting paper equity | 10,000 account units per strategy and cohort |
| Instruments | Live: Kraken PF_XBTUSD / PF_ETHUSD; archive: Binance BTCUSDT / ETHUSDT; cash |
| Direction | Long only |
| Isolated margin leverage | 1× or 2× |
| Stop distance | Greater of 1% and twice hourly ATR14 / entry price |
| Position sizing | Estimated stop loss plus execution costs capped at 2% of equity |
| Maximum notional | 2× account equity; collateral never exceeds equity |
| Taker fee assumption | 0.05% each side |
| Slippage assumption | 0.02% adverse each side |
| Funding | Kraken published USD funding per base unit; archived Binance mark × rate; negative-rate credits included |
| Time exit | 24 hours after entry |

Risk sizing usually makes account exposure lower than the selected margin leverage. Stops can gap and funding can increase losses beyond the 2% sizing budget. Liquidation is approximated using mark-price candles and a fixed 0.5% maintenance margin. If a stop and liquidation occur within the same hourly candle, the engine takes the worse outcome. Real exchange margin tiers, liquidation fees, intrahour order sequence and fills are not reproduced. Live accounts use USD; the Binance archive uses USDT without modelling a depeg. Funding periods are explicit: Kraken hourly, Binance eight-hour. The trend filter normalizes its funding threshold to eight hours. Kraken accrual includes held full hours and excludes the period beginning at time exit. Since hourly candles do not reveal an intrahour stop time, the stop hour is charged in full when funding is positive and receives no negative-rate credit.

Entries use the next hourly open after the snapshot and include adverse slippage. Stop gaps use the worse of the stop and candle open. Drawdown is measured on settled equity, not continuous intraday account value. Model API costs are reported separately from trading P&L.

## Models and spending

| Configuration | Provider identifier | Reasoning |
| --- | --- | --- |
| Luna | `gpt-6-luna` | none |
| Luna Decision | `gpt-6-luna`, Decisions API | typed choice |
| Sol | `gpt-6-sol` | none |

The server reserves a conservative request-cost bound atomically in D1 before making a call. The lifetime limit is $15. Successful requests reconcile against returned usage. Failed or ambiguous requests keep their reservation and are not automatically retried. There are no public endpoints that invoke a paid model or increase the budget. Historical replay is an explicit local command and is never run by CI.

See the official documentation for [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Decisions](https://developers.openai.com/api/docs/guides/decisions), [Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [Sol](https://developers.openai.com/api/docs/models/gpt-6-sol) and [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra).

## Run locally

Requires Node.js 24 and Python 3 with Pillow for regenerating icons.

```sh
npm ci
npm run check
npm test
npm run dev
```

The Worker needs a D1 database initialized with [schema.sql](schema.sql). For a local copy of the included evaluation, run `node scripts/seed.mjs`, start the dev server once to create local storage, then run `node scripts/seed-local.mjs`. The latter seeds the project-local SQLite databases only. Refresh the page afterward.

Place an existing OpenAI key in `.dev.vars` as `OPENAI_API_KEY=...` for local model calls. This file is ignored by Git. It is never served to the browser. Browsing the app, running tests and reading the API do not call OpenAI.

Explicit data and evaluation commands:

```sh
npm run data                 # free public market requests
npm run backtest             # local deterministic calculation
node scripts/evaluate.mjs    # paid: three active models, 14 replay dates; resumes its ledger
```

Do not run the evaluator against an already funded production journal without reconciling its local and D1 spending ledgers. The initial seed command is idempotent and will not reset an existing production budget.

## Deployment and daily updates

The frontend is React, TypeScript and CSS. A Cloudflare Worker serves the app and read-only APIs; D1 stores decisions, settlement results and the spending ledger. A scheduled handler checks every 15 minutes, refreshes market history at most hourly and records the daily decisions once. Public visitors cannot trigger a model run. Missing credentials or unavailable market data leave the prior records intact.

GitHub Actions checks types, financial tests, the production build and browser behavior in Chromium. Cloudflare Workers Builds runs the checked build and deploys pushes to `main` using the existing account integration. The deployed Worker secret is configured separately and is preserved across source deployments.

For another account, replace the account, database and domain in `cloudflare.config.ts`; initialize D1; configure `OPENAI_API_KEY` as a Worker secret; then run `npm run deploy`. Use a Cloudflare deployment token supplied through your CI secret store, or connect the repository through Workers Builds. No OpenAI secret belongs in GitHub source or public assets.

## Interface and agent access

Install Fin from the browser’s app installation menu. On iOS, use Share → Add to Home Screen.

The shared dark interface uses [History](https://fin.keff.uk/crp/historique/) for historical evaluations and separates retrospective replay from prospective results.

The PWA uses a responsive document with native selects and dialogs, reduced-motion support and a mobile navigation drawer. Short screens and zoom may scroll so that controls remain reachable. The service worker caches the shell and static assets, while API responses remain network-only to avoid presenting offline decisions as current.

- JSON: `/api/state`, `/api/backtest`, `/api/decisions`, `/api/source-health`
- OpenAPI: `/openapi.json`
- Markdown negotiation: request `/` with `Accept: text/markdown`
- Discovery: `/.well-known/api-catalog`, `/.well-known/mcp/server-card.json`, `/.well-known/agent-skills/index.json`
- Read-only MCP: `/mcp`, tools `get_crp_comparison`, `get_daily_decisions`, `get_backtest` and `get_warrant_catalog`

All agent tools are read-only and share the same recorded data as the interface. They cannot place orders, spend provider credit or mutate records. Nine applicable discovery checks passed the Cloudflare Agent Readiness Scanner; the selected checks and full response are saved in [agent-readiness.json](docs/agent-readiness.json). This scoped scan excludes authentication and commerce features that the app does not offer.

## Sources

[Kraken public candles](https://docs.kraken.com/api/docs/futures-api/charts/candles) · [Kraken funding history](https://docs.kraken.com/api/docs/futures-api/trading/historical-funding-rates/) · [Binance public archives](https://github.com/binance/binance-public-data) · [USD-M market API](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Kline-Candlestick-Data) · [Funding history](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Get-Funding-Rate-History) · [Cloudflare Workers](https://developers.cloudflare.com/workers/) · [Cloudflare CLI](https://developers.cloudflare.com/cf/)

Code: [MIT](LICENSE). Third-party data and dependencies retain their own terms.


### Comparaison CRP à 1 000 €

Luna, Luna Decision et Sol restent actifs. Astra et Terra ne reçoivent plus de requêtes ; leurs archives D1 sont conservées. Chaque portefeuille est comparé sur une base initiale de 1 000 €. Le journal USD à 10 000 est conservé : les montants sont multipliés par 0,1, ce qui préserve les rendements et les frais proportionnels. Ce choix ne simule pas le change EUR/USD ni les minimums de négociation d’un compte réel.

Le capital estimé additionne le capital clôturé et les positions ouvertes valorisées à la dernière heure complète Kraken, avec frais de sortie, glissement et financement observé. L’estimation respecte les mêmes stops, limites de collatéral et règles de financement que le moteur de clôture. Une source manquante donne une valeur indisponible, jamais un gain inventé. Les réponses tardives et échouées sont exclues. Le taux de réussite exclut les décisions en espèces. Les coûts des modèles restent séparés en USD.

L’API `/api/crp/comparison` est la source de l’écran. Le MCP public `https://fin.keff.uk/mcp` expose `get_crp_comparison`, `get_daily_decisions`, `get_backtest` et `get_warrant_catalog`. Les outils n’envoient aucun ordre et ne déclenchent aucun appel payant. Contrats dans `/openapi.json`, guide dans `/index.md`.

Fin utilise uniquement le mode sombre, y compris la PWA installée. Le service worker conserve l’interface pour le hors connexion, mais ne met pas en cache les données financières.


### Navigation inspirée de Bourse

Sur CRP, choisir une ligne affiche le portefeuille et sa courbe. Les périodes filtrent les points enregistrés ; « Comparer les 3 » superpose les modèles. Les valeurs restent lisibles au survol, au toucher et au clavier. Le panneau de décision conserve le plan et le journal d’origine.

Sur Warrants, les raccourcis des sous-jacents affichent le dernier cours de clôture et la variation sur 20 séances, calculée entre les 21 dernières clôtures. Ils filtrent le catalogue. Ils ne représentent pas un historique du prix des warrants.

Référence visuelle : [Apple Bourse](https://support.apple.com/en-ie/guide/iphone/iph1ac0b1bc/ios). Aucun actif graphique Apple n’est embarqué.


## Portefeuille Warrants à J1 — 1 000 €

L’accueil `/` compare les quatre simulations dans la même interface : le portefeuille Warrants
et les trois modèles CRP. `/warrants/experience/` et `/crp/` filtrent cette vue commune.
Capital, gain/perte et courbe restent visibles ; positions et règles sont dans Détails.
Le catalogue, les analyses enregistrées et le journal d’origine restent accessibles.

Le portefeuille Warrants commence avec 1 000 € à J1, le 16 octobre 2026 :
689 Q433S (DE000FG32YX6) au prix vendeur de référence de 1,45 €, soit 999,05 € ;
0,95 € restent en espèces. La quantité est fixe, sans réinvestissement ni ajout des nouveaux contrats.
Q433S était le premier contrat et la sélection par défaut du suivi original. Ce choix est figé
par cette version après la publication des relevés ; ce n’est pas une sélection prospective prouvant un avantage.
Valeur = espèces + 689 × dernier bid − frais de sortie simulés. Gain = valeur − 1 000 €.
Aucune normalisation à partir de 3 000 € pour ce portefeuille. Frais simulés inclus, impôts exclus.
L’achat source respecte le minimum de 500 €. Les prix de référence ne prouvent pas une exécution réelle.

La collecte quotidienne ajoute des points à l’archive, sans modifier le prix d’entrée.
Une panne conserve la date du dernier relevé. Après l’échéance, sans remboursement enregistré,
le capital final reste indisponible. Aucun zéro ni remboursement inventé.

API de la vue Warrants : `/api/warrants/portfolio` ; MCP : `get_warrant_experiment`.
API CRP : `/api/crp/comparison`, base de 1 000 € normalisée depuis le journal USD 10 000,
sans simulation du change. L’ancienne API `/api/warrants/comparison` reste disponible pour compatibilité :
elle contient les comparaisons individuelles en base 100 € et ne représente plus le portefeuille de l’application.
