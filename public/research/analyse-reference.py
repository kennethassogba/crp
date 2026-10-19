"""Exploratory warrant study; Python standard library only.

Run beside the frozen public Yahoo Finance chart JSON files.
Probabilities describe settlement, not intraperiod resale prices.
The empirical model removes the historical mean gross return; it does
not assume Palantir's exceptional historical appreciation repeats.
This is not a backtest of historical warrant trades or an out-of-sample
validation of an investment edge. Quotes are closed-market indications.
"""
import json
import math
import random
import statistics as st
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FX = 1.124  # Scenario assumption: USD per EUR remains constant.
BUDGET = 3000.0
HORIZON = 43  # Trading-day approximation to 19 Oct -> 18 Dec 2026.
P = {"mnemonic": "Z377S", "isin": "DE000FG35JX0", "strike": 225.,
     "parity": 20., "ask": .26, "bid": .25, "expiry": "2026-12-18",
     "payment": "2026-12-28", "quote_date": "2026-10-16",
     "commission": 0., "source": "https://www.sgbourse.fr/product-details/z377s",
     "bourso": "https://www.boursorama.com/bourse/produits-de-bourse/cours/warrants/3rPDE000FG35JX0"}
QTY = math.floor(BUDGET / P["ask"])
COST = QTY * P["ask"]

def read_history(symbol):
    raw = ROOT / (symbol + '.json')
    if not raw.exists():
        reference = ROOT.parent.parent / 'tests' / 'fixtures' / 'reference-snapshot.json'
        asset = json.loads((reference if reference.exists() else ROOT / 'snapshot.json').read_text())['assets'][symbol]
        return asset['dates'], asset['closes']
    z = json.loads(raw.read_text())["chart"]["result"][0]
    pairs = [(t, c) for t, c in zip(z['timestamp'], z['indicators']['quote'][0]['close']) if c is not None]
    return [datetime.fromtimestamp(t, timezone.utc).date().isoformat() for t, _ in pairs], [c for _, c in pairs]

DATES, C = read_history('PLTR')
SPOT = C[-1]

def quantile(v, p):
    v = sorted(v)
    k = (len(v)-1)*p
    lo = math.floor(k)
    hi = math.ceil(k)
    return v[lo] + (v[hi]-v[lo])*(k-lo)

def payoff(spot):
    return max(spot - P['strike'], 0.) / (P['parity'] * FX)

def empirical(gross, neutral=True):
    scale = sum(gross)/len(gross) if neutral else 1.
    payouts = [payoff(SPOT*x/scale) for x in gross]
    return {"observations_overlapping": len(gross),
            "historical_mean_gross": sum(gross)/len(gross),
            "net_expected_eur": QTY * (sum(payouts)/len(payouts)-P['ask']),
            "p_profit": sum(x > P['ask'] for x in payouts)/len(payouts),
            "p_fivefold": sum(x >= 5*P['ask'] for x in payouts)/len(payouts),
            "p_total_loss": sum(x == 0 for x in payouts)/len(payouts)}

def block_bootstrap(gross, repetitions=5000, block=43):
    # Resample contiguous blocks to account for overlapping return windows.
    # Recenter each resample to preserve the zero expected stock-return assumption.
    rng = random.Random(20261019)
    output = {k: [] for k in ['net_expected_eur', 'p_profit', 'p_fivefold', 'p_total_loss']}
    n = len(gross)
    for _ in range(repetitions):
        sample = []
        while len(sample) < n:
            start = rng.randrange(n-block+1)
            sample.extend(gross[start:start+block])
        r = empirical(sample[:n])
        for k in output:
            output[k].append(r[k])
    return {k: [quantile(v, .025), quantile(v, .975)] for k, v in output.items()}

def normal_cdf(x):
    return .5*(1+math.erf(x/math.sqrt(2)))

def gbm(vol, days=60, mu=0.):
    t = days/365
    a = vol*math.sqrt(t)
    d2 = (math.log(SPOT/P['strike'])+(mu-.5*vol**2)*t)/a
    expected = (SPOT*math.exp(mu*t)*normal_cdf(d2+a)-P['strike']*normal_cdf(d2))/(P['parity']*FX)
    def tail(b):
        return normal_cdf((math.log(SPOT/b)+(mu-.5*vol**2)*t)/a)
    return {"vol_annual": vol, "mu_annual": mu,
            "net_expected_eur": QTY*(expected-P['ask']),
            "p_profit": tail(P['strike']+P['ask']*P['parity']*FX),
            "p_fivefold": tail(P['strike']+5*P['ask']*P['parity']*FX),
            "p_total_loss": 1-tail(P['strike'])}

def main():
    gross5 = [C[i+HORIZON]/C[i] for i in range(len(C)-HORIZON)]
    gross1 = [C[i+HORIZON]/C[i] for i in range(len(C)-253, len(C)-HORIZON)]
    logs = [math.log(b/a) for a, b in zip(C, C[1:])]
    comparison = {}
    for sym in ['NDX', 'NVDA', 'TSLA', 'AMD', 'PLTR']:
        ds, cs = read_history(sym)
        rs = [math.log(b/a) for a, b in zip(cs, cs[1:])]
        comparison[sym] = {"rows": len(cs), "first": ds[0], "last": ds[-1], "close": cs[-1],
                           "annual_realized_vol": {str(w): st.stdev(rs[-w:])*math.sqrt(252) for w in [20, 60, 252, len(rs)]}}
    result = {"quote": P, "quantity": QTY, "cost": COST, "cash": BUDGET-COST,
              "fx_assumption": FX, "spot": SPOT, "data": comparison,
              "empirical_5y_zero_mean": empirical(gross5),
              "empirical_1y_zero_mean": empirical(gross1),
              "bootstrap_95_interval_5y_zero_mean": block_bootstrap(gross5),
              "gbm_sensitivity": {str(w): gbm(st.stdev(logs[-w:])*math.sqrt(252)) for w in [20, 60, 252, len(logs)]},
              "threshold_profit_usd": P['strike']+P['ask']*P['parity']*FX,
              "threshold_fivefold_usd": P['strike']+5*P['ask']*P['parity']*FX,
              "immediate_spread_loss_eur": QTY*(P['ask']-P['bid']),
              "settlement_scenarios_net_eur": {str(s): QTY*payoff(s)-COST for s in [225, 230, 235, 240, 250, 254.224, 260, 275]},
              "limitations": ["Frozen Friday indicative quotes, not executable Monday quotes.",
                  "No proven forecasting edge; exploratory candidate selection.",
                  "Historical overlapping return windows are not independent trades.",
                  "43 trading days approximates the calendar horizon; historical regimes may not recur.",
                  "Bootstrap interval is conditional on empirical model and does not capture all model or selection uncertainty.",
                  "FX held constant; no issuer default, tax, extraordinary termination, account-plan or opportunity costs modeled.",
                  "At settlement no resale spread is added; issuer costs are embedded in the purchase quote.",
                  "Interim x5 resale probabilities require a separate volatility and spread process."]}
    (ROOT/'resultats.json').write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
