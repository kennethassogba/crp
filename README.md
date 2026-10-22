**English** · [Français](README.fr.md)

# Fin · Warrant experiment

[Selections](https://fin.keff.uk/) · [Positions](https://fin.keff.uk/positions/) · [Results](https://fin.keff.uk/resultats/) · [Full protocol (French)](docs/warrants-method.md)

The model ranks warrants available through BoursoBank. The experiment then measures their observed outcomes and the quality of forecasts fixed before selection. Prospective tracking starts on **22 October 2026**. Profitability has not been demonstrated.

## The experiment

| Rule | Implementation |
| --- | --- |
| Selection | Up to three new warrants per business day, on different underlyings. An ISIN is never selected twice. |
| Investment | **€1,000 per warrant**, independently of other positions. There is no shared capital pool to reinvest. |
| Entry | Whole units at the ask price, with brokerage fees deducted and remaining cash kept. |
| Tracking | Value at the bid price, after exit fees, before tax. |
| Exit | After **20 US trading sessions**, or at the first daily observation at **+100% / −50%**. |
| Audit trail | Entry price, forecast and exit rule are fixed. Subsequent observations are appended to the journal. |

Thresholds are checked at each observation, without intraday execution: a loss can exceed −50%. The entire amount invested in the warrant can be lost. No real orders are sent.

## The model

The engine reprices each warrant before expiry along twenty-session paths drawn from the underlying’s history. Mean log returns are removed: the ranking does not assume the past trend will continue.

Implied volatility is calibrated to the initial bid/ask midpoint using Black–Scholes. Each path applies the simulation’s exit rules and fees. Three variants are calculated: roughly five years of history, one year of history, and implied volatility reduced by 20%.

The score, in net euros for a €1,000 investment, is:

```text
score = 0.5 × profit at the 90th percentile
      + 0.5 × min(mean profit over five years,
                  mean profit over one year,
                  mean profit with volatility reduced by 20%)
```

The score favours high profit in favourable scenarios while penalising a fragile expected return. It guarantees neither a profit nor positive expected profit. Displayed probabilities are model scenario frequencies, not established market probabilities. No LLM selects the positions.

### Which products qualify?

The tracked catalogue covers NDX, NVDA, TSLA, AMD and PLTR. Product discovery is bounded and refreshed by rotation; it does not cover every warrant available at BoursoBank.

The engine requires, among other conditions, a confirmed BoursoMarkets offer, an order of at least €500, a spread of at most 8%, a price collected within the past two hours, an underlying observed within the past four hours and at least 500 complete historical closes. Expiry must allow twenty sessions plus seven days, without exceeding 120 days. Required exchange rates must be available.

Brokerage fees are zero only for products with a confirmed BoursoMarkets offer. The spread is still paid. If data or eligible products are missing, the batch contains fewer than three selections, possibly none.

## How to assess the results

Initial forecasts remain visible alongside observed values. Open and closed positions are separate. A missing price stays unavailable; it is never replaced with zero.

Closed positions allow comparison of mean net profit, the frequency of profits and probability calibration. The Brier score measures the difference between forecast profit probability and observed outcome; lower is better. Forecasting 50% every time gives 0.25. Good calibration alone does not make a strategy profitable.

Historical paths overlap and selections may be correlated. Their count therefore does not represent as many independent trials. The small number of exits at the start of the experiment cannot support a firm conclusion. Calculation tests verify the program, not its financial edge.

## Data and limits

Prices and contract terms come from public BoursoBank product pages; underlying histories come from Yahoo Finance. Timestamps record the collection time: the issuer’s quote time is unknown. Prices are indicative, with no execution guarantee.

Collection is scheduled each business day at **21:30 UTC**; delays and failures remain possible. The app checks published data automatically every minute and when connectivity returns. Daily observations do not become real-time quotes.

The model assumes zero rates and dividends, and constant FX and spread within each forecast. It does not predict announcements, liquidity changes or issuer decisions. The KID is linked from the product sheet but is not legally validated by the engine.

## Reproduce and inspect

- [Selection, forecasting, exit and statistics engine](lib/warrant-tracker.mjs).
- [Journal of selections and observations](public/research/tracker.json).
- [Catalogue, prices and market histories used](public/research/snapshot.json).
- [Full protocol and assumptions (French)](docs/warrants-method.md).
- [Calculation and tracking tests](tests/), with a [frozen reference dataset](tests/fixtures/reference-snapshot.json). The expiry-based reference engine is separate from the twenty-session ranking.

The [public API](https://fin.keff.uk/openapi.json) and [read-only MCP endpoint](https://fin.keff.uk/mcp) expose selections, positions, results and the catalogue. The experiment’s data can be examined without the interface.

[Licences and attribution](THIRD_PARTY_NOTICES.md).
