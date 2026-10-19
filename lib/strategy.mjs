export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const RULES = Object.freeze({
  version: "1.1.0",
  capital: 10_000,
  risk: 0.02,
  fee: 0.0005,
  slippage: 0.0002,
  maintenance: 0.005,
  maxLeverage: 2,
  horizonHours: 24,
});
export const ACTIONS = ["CASH", "BTC_1X", "BTC_2X", "ETH_1X", "ETH_2X"];
const round = (x, n = 6) => Number(x.toFixed(n));
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

export function validateBars(bars) {
  if (!Array.isArray(bars) || !bars.length)
    throw new Error("Missing market candles");
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (
      ![b.t, b.o, b.h, b.l, b.c, b.v].every(Number.isFinite) ||
      b.o <= 0 ||
      b.l <= 0 ||
      b.h < Math.max(b.o, b.c) ||
      b.l > Math.min(b.o, b.c) ||
      b.v < 0
    )
      throw new Error("Invalid market candle");
    if (i && b.t !== bars[i - 1].t + HOUR)
      throw new Error("Market history has a missing or duplicate hour");
  }
  return bars;
}

export function snapshotAt(market, at) {
  const assets = {};
  for (const symbol of ["BTC", "ETH"]) {
    const series = market.assets[symbol];
    const past = series.bars.filter((b) => b.t + HOUR <= at);
    if (past.length < 169 || past.at(-1).t + HOUR !== at)
      throw new Error(`Incomplete ${symbol} snapshot`);
    const closes = past.map((b) => b.c),
      price = closes.at(-1);
    const ret = (hours) => round(price / closes.at(-1 - hours) - 1);
    const returns = closes
      .slice(-25)
      .slice(1)
      .map((c, i) => Math.log(c / closes.slice(-25)[i]));
    const avg = mean(returns);
    const volatility = Math.sqrt(mean(returns.map((r) => (r - avg) ** 2)) * 24);
    const ranges = past.slice(-14).map((b, i) => {
      const previous = past[past.length - 15 + i].c;
      return Math.max(
        b.h - b.l,
        Math.abs(b.h - previous),
        Math.abs(b.l - previous),
      );
    });
    const funding = series.funding.filter((f) => f.t < at).at(-1);
    assets[symbol] = {
      price,
      ret1h: ret(1),
      ret4h: ret(4),
      ret24h: ret(24),
      ret7d: ret(168),
      trend: round(mean(closes.slice(-24)) / mean(closes.slice(-72)) - 1),
      volatility24h: round(volatility),
      stopPct: round(Math.max(0.01, (2 * mean(ranges)) / price)),
      volumeRatio: round(
        mean(past.slice(-24).map((b) => b.v)) /
          mean(past.slice(-168).map((b) => b.v)),
      ),
      lastFunding: funding?.rate ?? null,
      fundingPeriodHours: series.fundingPeriodHours ?? 8,
      fundingAt: funding?.t ?? null,
      closes4h: past
        .slice(-48)
        .filter((_, i) => i % 4 === 3)
        .map((b) => round(b.c, 2)),
    };
  }
  return {
    version: RULES.version,
    at,
    assets,
    source: market.source,
    quote: market.quote ?? "USDT",
  };
}

export function momentum(snapshot) {
  const eligible = Object.entries(snapshot.assets).filter(
    ([, a]) =>
      a.trend > 0.002 &&
      a.ret24h > 0 &&
      a.lastFunding !== null &&
      a.lastFunding * (8 / (a.fundingPeriodHours ?? 8)) <= 0.0005,
  );
  eligible.sort((a, b) => b[1].trend - a[1].trend);
  return {
    action: eligible.length ? `${eligible[0][0]}_1X` : "CASH",
    reason: eligible.length
      ? "Positive 24-hour return and 24/72-hour trend."
      : "No asset passes the trend and funding filters.",
  };
}

export function position(
  decision,
  snapshot,
  equity = RULES.capital,
  entry = null,
) {
  if (!ACTIONS.includes(decision.action)) throw new Error("Unknown action");
  if (decision.action === "CASH")
    return {
      action: "CASH",
      notional: 0,
      collateral: 0,
      quantity: 0,
      leverage: 0,
      risk: 0,
    };
  const [asset, lev] = decision.action.split("_"),
    leverage = Number(lev[0]);
  const price = entry ?? snapshot.assets[asset].price;
  const stopPct = snapshot.assets[asset].stopPct;
  if (stopPct >= 0.15 || !Number.isFinite(price) || price <= 0)
    throw new Error("Position exceeds volatility limits");
  const collateral = Math.min(
    equity,
    (equity * RULES.risk) /
      (leverage * (stopPct + 2 * (RULES.fee + RULES.slippage))),
  );
  const notional = collateral * leverage;
  return {
    asset,
    action: decision.action,
    leverage,
    collateral,
    notional,
    quantity: notional / price,
    entry: price,
    stop: price * (1 - stopPct),
    stopPct,
    risk: RULES.risk,
    exposure: notional / equity,
  };
}

export function simulate(
  decision,
  snapshot,
  market,
  equity = RULES.capital,
  entryAt = snapshot.at + HOUR,
  costs = 1,
) {
  const end = entryAt + DAY;
  if (decision.action === "CASH")
    return {
      action: "CASH",
      entryAt,
      exitAt: end,
      pnl: 0,
      returnPct: 0,
      fees: 0,
      funding: 0,
      status: "cash",
      equity,
    };
  const asset = decision.action.split("_")[0],
    series = market.assets[asset];
  if (snapshot.source && market.source && snapshot.source !== market.source)
    return null;
  const bars = series.bars.filter((b) => b.t >= entryAt && b.t < end);
  const exitBar = series.bars.find((b) => b.t === end);
  if (!exitBar || bars.length !== 24) return null;
  return evaluateWindow(
    decision,
    snapshot,
    series,
    bars,
    equity,
    entryAt,
    end,
    exitBar.o,
    "expired",
    costs,
  );
}

// Read-only valuation at the last complete source candle. It never writes a
// settlement or extends an open position with made-up future prices.
export function markPosition(
  decision,
  snapshot,
  market,
  equity = RULES.capital,
  entryAt = snapshot.at + HOUR,
) {
  if (decision.action === "CASH" || market.to <= entryAt) return null;
  if (snapshot.source !== market.source) return null;
  const end = Math.min(market.to, entryAt + DAY);
  const series = market.assets[decision.action.split("_")[0]];
  const bars = series?.bars.filter((b) => b.t >= entryAt && b.t < end) ?? [];
  if (
    !bars.length ||
    bars.length !== (end - entryAt) / HOUR ||
    bars.some((b, i) => b.t !== entryAt + i * HOUR)
  )
    return null;
  const boundary = series.bars.find((b) => b.t === end);
  const exitPrice = boundary?.o ?? bars.at(-1).c;
  return evaluateWindow(
    decision,
    snapshot,
    series,
    bars,
    equity,
    entryAt,
    end,
    exitPrice,
    end === entryAt + DAY ? "expired" : "open",
    1,
  );
}

function evaluateWindow(
  decision,
  snapshot,
  series,
  bars,
  equity,
  entryAt,
  end,
  exitPrice,
  initialStatus,
  costs,
) {
  const entry = bars[0].o * (1 + RULES.slippage * costs);
  const p = position(decision, snapshot, equity, entry);
  let exit = exitPrice,
    exitAt = end,
    status = initialStatus;
  const liquidation =
    entry * (1 - 1 / p.leverage + RULES.maintenance + RULES.fee);
  for (const b of bars) {
    const mark = series.marks?.find((m) => m.t === b.t);
    // When stop and liquidation occur inside one hourly candle, choose the worse outcome.
    if (mark && mark.l <= liquidation) {
      exit = liquidation;
      exitAt = b.t;
      status = "liquidated";
      break;
    }
    if (b.l <= p.stop) {
      exit = Math.min(b.o, p.stop);
      exitAt = b.t;
      status = "stopped";
      break;
    }
  }
  exit *= 1 - RULES.slippage * costs;
  const fees = (entry + exit) * p.quantity * RULES.fee * costs;
  // Hourly accrual excludes the next period at time exit. In an unknown stop
  // candle, charge a whole positive hour and grant no unearned negative credit.
  // Archived Binance funding is an instantaneous payment, not hourly accrual.
  const fundingRows = series.funding.filter(
    (f) =>
      f.t >= entryAt &&
      (f.accrualHours === 1
        ? f.t < exitAt ||
          (["stopped", "liquidated"].includes(status) &&
            f.t === exitAt &&
            f.absolutePerUnit > 0)
        : f.t <= exitAt),
  );
  const funding = fundingRows.reduce(
    (s, f) => s + p.quantity * (f.absolutePerUnit ?? f.mark * f.rate),
    0,
  );
  const raw = (exit - entry) * p.quantity - fees - funding;
  const pnl =
    status === "liquidated" ? -p.collateral : Math.max(-p.collateral, raw);
  return {
    ...p,
    entryAt,
    exitAt,
    exit,
    status,
    fees,
    funding,
    pnl,
    returnPct: (pnl / equity) * 100,
    equity: equity + pnl,
    fundingPayments: fundingRows.length,
  };
}

export function summarize(trades, name) {
  let equity = RULES.capital,
    peak = equity,
    drawdown = 0;
  const curve = [{ t: trades[0]?.entryAt ?? 0, equity }];
  for (const t of trades) {
    equity += t.pnl;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, (peak - equity) / peak);
    curve.push({ t: t.exitAt, equity: round(equity, 2) });
  }
  const active = trades.filter((t) => t.action !== "CASH");
  return {
    name,
    returnPct: round((equity / RULES.capital - 1) * 100, 2),
    equity: round(equity, 2),
    maxDrawdown: round(drawdown * 100, 2),
    trades: active.length,
    days: trades.length,
    winRate: active.length
      ? round((active.filter((t) => t.pnl > 0).length / active.length) * 100, 1)
      : null,
    fees: round(
      active.reduce((s, t) => s + t.fees, 0),
      2,
    ),
    funding: round(
      active.reduce((s, t) => s + t.funding, 0),
      2,
    ),
    liquidations: active.filter((t) => t.status === "liquidated").length,
    curve,
  };
}

export function replay(market, days = 90) {
  const last = Math.min(
    ...Object.values(market.assets).map((s) => s.bars.at(-1).t),
  );
  const first =
    Math.max(...Object.values(market.assets).map((s) => s.bars[0].t)) + 8 * DAY;
  const ats = market.assets.BTC.bars
    .map((b) => b.t)
    .filter(
      (t) =>
        t % DAY === 8 * HOUR &&
        t >= Math.max(first, last - days * DAY) &&
        t + 25 * HOUR <= last,
    );
  const strategies = [
    ["Momentum", momentum],
    ["BTC daily", () => ({ action: "BTC_1X" })],
    ["ETH daily", () => ({ action: "ETH_1X" })],
  ];
  const results = strategies.map(([name, choose]) => {
    let equity = RULES.capital;
    const trades = [];
    for (const at of ats) {
      const snapshot = snapshotAt(market, at),
        decision = choose(snapshot),
        t = simulate(decision, snapshot, market, equity);
      if (t) {
        trades.push({ ...t, at });
        equity = t.equity;
      }
    }
    let stressedEquity = RULES.capital;
    const stressed = [];
    for (const at of ats) {
      const snapshot = snapshotAt(market, at),
        t = simulate(
          choose(snapshot),
          snapshot,
          market,
          stressedEquity,
          at + HOUR,
          2,
        );
      if (t) {
        stressed.push(t);
        stressedEquity = t.equity;
      }
    }
    return {
      ...summarize(trades, name),
      stressReturnPct: summarize(stressed, name).returnPct,
      journal: trades,
    };
  });
  // Passive unlevered spot references use the separately observed spot candles.
  const passive = ["BTC", "ETH"].flatMap((asset) => {
    const bars = market.assets[asset].spot;
    const start = bars?.find((b) => b.t === ats[0] + HOUR),
      finish = bars?.find((b) => b.t === ats.at(-1) + 25 * HOUR);
    if (!start || !finish) return [];
    const qty =
      RULES.capital / (start.o * (1 + RULES.slippage) * (1 + RULES.fee));
    const curve = bars
      .filter((b) => b.t >= start.t && b.t <= finish.t)
      .filter((_, i) => i % 24 === 0)
      .map((b) => ({ t: b.t, equity: round(qty * b.o, 2) }));
    let peak = RULES.capital,
      dd = 0;
    for (const p of curve) {
      peak = Math.max(peak, p.equity);
      dd = Math.max(dd, (peak - p.equity) / peak);
    }
    const equity = qty * finish.o * (1 - RULES.slippage) * (1 - RULES.fee);
    return [
      {
        name: `${asset} hold`,
        equity: round(equity, 2),
        returnPct: round((equity / RULES.capital - 1) * 100, 2),
        maxDrawdown: round(dd * 100, 2),
        trades: 1,
        days: ats.length,
        winRate: null,
        curve,
      },
    ];
  });
  return {
    version: RULES.version,
    from: ats[0],
    to: ats.at(-1) + 25 * HOUR,
    days: ats.length,
    rules: RULES,
    results: [...results, ...passive],
    caveat:
      "Hourly execution proxy. Stops can gap. Liquidation model uses a fixed 0.5% maintenance margin. Historical model replay is separate from prospective performance.",
  };
}
