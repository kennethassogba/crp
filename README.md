# CRP

Daily BTC and ETH paper positions, with five OpenAI configurations and a recorded outcome for each decision.

[Open CRP](https://crp.keff.uk) · [Method](https://crp.keff.uk/method.md) · [Public API](https://crp.keff.uk/openapi.json)

![CRP interface](https://crp.keff.uk/social-card.png)

## What it does

At 08:00 UTC, each configuration receives the same market snapshot and chooses cash, BTC or ETH, with 1× or 2× isolated margin leverage. Entry is scheduled for 09:00 UTC, after the response is recorded. The position closes 24 hours later or at its stop. The first prospective observation can start at another full hour.

The site displays the recorded decision, reference levels, historical evaluations, provider cost and settlement journal. It connects to no exchange account and places no orders. Reference levels are not executable quotes. Derivatives availability depends on your location and exchange.

## Data and evaluation

- Market data: public Binance spot, USD-M perpetual, mark price and funding APIs, tested without authentication. The initial dataset contains 2,400 hourly candles per asset in each price series and 303 funding records per asset. [Access evidence](docs/data-access.json).
- Rule benchmark: 89 completed daily sessions, using fixed parameters and past-only features. Momentum is compared with daily BTC/ETH positions and passive spot holding. A second run doubles fees and slippage.
- Model replay: 14 shared historical snapshots for all five configurations. These retrospective results are exploratory and are never merged into prospective performance.
- Forward journal: decisions are stored before entry and settled against subsequent prices. Late, missing and failed responses do not become positions. No rule substitutes for a model response.

The initial 75 successful provider requests cost $0.242856, based on returned token usage and the documented standard rates. This includes five prospective decisions and 70 historical replay decisions. The current run and cost records are in [models.json](public/data/models.json).

There is no fitted model, parameter search or claimed predictive advantage. Fourteen replay days are insufficient to establish profitability. Historical model replay can also be contaminated by information in model training; prospective observations are needed to assess performance. News and analyst consensus are outside this version.

Archived inputs keep their original version. Snapshot version 1.0.1 corrects the seven-day feature to span 168 hourly intervals; version 1.0.0 used 167. The trend benchmark does not use that feature. Recorded model decisions are not regenerated.

## Position rules

| Parameter | Value |
| --- | --- |
| Starting paper equity | 10,000 USDT per strategy and cohort |
| Instruments | BTCUSDT and ETHUSDT USD-M perpetuals; cash |
| Direction | Long only |
| Isolated margin leverage | 1× or 2× |
| Stop distance | Greater of 1% and twice hourly ATR14 / entry price |
| Position sizing | Estimated stop loss plus execution costs capped at 2% of equity |
| Maximum notional | 2× account equity; collateral never exceeds equity |
| Taker fee assumption | 0.05% each side |
| Slippage assumption | 0.02% adverse each side |
| Funding | Subsequent observed payments, including negative-rate credits |
| Time exit | 24 hours after entry |

Risk sizing usually makes account exposure lower than the selected margin leverage. Stops can gap and funding can increase losses beyond the 2% sizing budget. Liquidation is approximated using mark-price candles and a fixed 0.5% maintenance margin. If a stop and liquidation occur within the same hourly candle, the engine takes the worse outcome. Real exchange margin tiers, liquidation fees, intrahour order sequence and fills are not reproduced. USDT is treated as the account unit without modelling a depeg.

Entries use the next hourly open after the snapshot and include adverse slippage. Stop gaps use the worse of the stop and candle open. Drawdown is measured on settled equity, not continuous intraday account value. Model API costs are reported separately from trading P&L.

## Models and spending

| Configuration | Provider identifier | Reasoning |
| --- | --- | --- |
| Luna | `gpt-6-luna` | none |
| Luna Decision | `gpt-6-luna`, Decisions API | typed choice |
| Terra | `gpt-5.6-terra` | none |
| Sol | `gpt-6-sol` | none |
| Astra | `gpt-6-astra` | low |

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
node scripts/evaluate.mjs    # paid: five models, 14 replay dates; resumes its ledger
```

Do not run the evaluator against an already funded production journal without reconciling its local and D1 spending ledgers. The initial seed command is idempotent and will not reset an existing production budget.

## Deployment and daily updates

The frontend is React, TypeScript and CSS. A Cloudflare Worker serves the app and read-only APIs; D1 stores decisions, settlement results and the spending ledger. A scheduled handler checks every 15 minutes, refreshes market history at most hourly and records the daily decisions once. Public visitors cannot trigger a model run. Missing credentials or unavailable market data leave the prior records intact.

GitHub Actions checks types, financial tests, the production build and browser behavior in Chromium. Cloudflare Workers Builds runs the checked build and deploys pushes to `main` using the existing account integration. The deployed Worker secret is configured separately and is preserved across source deployments.

For another account, replace the account, database and domain in `cloudflare.config.ts`; initialize D1; configure `OPENAI_API_KEY` as a Worker secret; then run `npm run deploy`. Use a Cloudflare deployment token supplied through your CI secret store, or connect the repository through Workers Builds. No OpenAI secret belongs in GitHub source or public assets.

## Interface and agent access

Install CRP from the browser’s app installation menu. On iOS, use Share → Add to Home Screen.

The PWA uses a single viewport at normal desktop and phone sizes, native selects and dialogs, safe-area insets, reduced-motion support and a mobile bottom navigation. Short screens and zoom may scroll so that controls remain reachable. The service worker caches the shell and static assets, while API responses remain network-only to avoid presenting offline decisions as current.

- JSON: `/api/state`, `/api/backtest`, `/api/decisions`
- OpenAPI: `/openapi.json`
- Markdown negotiation: request `/` with `Accept: text/markdown`
- Discovery: `/.well-known/api-catalog`, `/.well-known/mcp/server-card.json`, `/.well-known/agent-skills/index.json`
- Read-only MCP: `/mcp`, tools `get_daily_decisions` and `get_backtest`
- WebMCP: `read_crp_positions` when supported by the browser

All agent tools are read-only and share the same recorded data as the interface. They cannot place orders, spend provider credit or mutate records. Nine applicable discovery checks passed the Cloudflare Agent Readiness Scanner; the selected checks and full response are saved in [agent-readiness.json](docs/agent-readiness.json). This scoped scan excludes authentication and commerce features that the app does not offer.

## Sources

[Binance public archives](https://github.com/binance/binance-public-data) · [USD-M market API](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Kline-Candlestick-Data) · [Funding history](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Get-Funding-Rate-History) · [Cloudflare Workers](https://developers.cloudflare.com/workers/) · [Cloudflare CLI](https://developers.cloudflare.com/cf/)

Code: [MIT](LICENSE). Third-party data and dependencies retain their own terms.
