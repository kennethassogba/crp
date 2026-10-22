// Prospective, append-only simulations. Prices in EUR; strike currency may differ.
import { normalCDF, position, quantile, validateProduct } from "./warrants.mjs";
export const RULE = Object.freeze({
  version: "warrants-20s-v1",
  capital: 1000,
  sessions: 20,
  takeProfit: 1,
  stopLoss: -0.5,
  dailyLimit: 3,
});
const DAY = 86400000;
export const parisDay = (at) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
const date = (t) => new Date(t).toISOString().slice(0, 10);
const observed = (year, month, day) => {
  const t = Date.UTC(year, month, day),
    w = new Date(t).getUTCDay();
  return date(t + (w === 6 ? -1 : w === 0 ? 1 : 0) * DAY);
};
const nth = (y, m, w, n) => {
  const f = new Date(Date.UTC(y, m, 1)).getUTCDay();
  return date(Date.UTC(y, m, 1 + ((w - f + 7) % 7) + 7 * (n - 1)));
};
function easter(y) {
  const a = y % 19,
    b = Math.floor(y / 100),
    c = y % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    v = h + l - 7 * m + 114;
  return Date.UTC(y, Math.floor(v / 31) - 1, (v % 31) + 1);
}
export function isSession(d) {
  const t = Date.parse(d),
    y = new Date(t).getUTCFullYear(),
    w = new Date(t).getUTCDay();
  if (!Number.isFinite(t) || w === 0 || w === 6) return false;
  const holidays = [
    observed(y, 0, 1),
    observed(y + 1, 0, 1),
    nth(y, 0, 1, 3),
    nth(y, 1, 1, 3),
    date(easter(y) - 2 * DAY),
    nth(y, 4, 1, 5),
    observed(y, 6, 4),
    nth(y, 8, 1, 1),
    nth(y, 10, 4, 4),
    observed(y, 11, 25),
  ];
  // Last Monday in May, rather than fifth Monday if the month has only four.
  holidays[5] = date(
    Date.UTC(y, 5, 0) -
      ((new Date(Date.UTC(y, 5, 0)).getUTCDay() + 6) % 7) * DAY,
  );
  if (y >= 2022) holidays.push(observed(y, 5, 19));
  return !holidays.includes(d);
}
export function addSessions(d, n) {
  let t = Date.parse(d),
    count = 0;
  if (!Number.isFinite(t) || n < 0) throw Error("Invalid session date");
  while (count < n) {
    t += DAY;
    if (isSession(date(t))) count++;
  }
  return date(t);
}
export function sessionsBetween(a, b) {
  let n = 0;
  for (let t = Date.parse(a) + DAY; t <= Date.parse(b); t += DAY)
    if (isSession(date(t))) n++;
  return n;
}
export function optionPrice(p, spot, vol, days, fx) {
  const t = Math.max(0, days) / 365,
    intrinsic = Math.max(
      p.direction === "call" ? spot - p.strike : p.strike - spot,
      0,
    );
  if (t === 0 || vol <= 0)
    return (intrinsic * p.ratio) / (p.currency === "USD" ? fx : 1);
  const a = vol * Math.sqrt(t),
    d1 = (Math.log(spot / p.strike) + 0.5 * vol * vol * t) / a,
    d2 = d1 - a;
  const raw =
    p.direction === "call"
      ? spot * normalCDF(d1) - p.strike * normalCDF(d2)
      : p.strike * normalCDF(-d2) - spot * normalCDF(-d1);
  return (Math.max(0, raw) * p.ratio) / (p.currency === "USD" ? fx : 1);
}
export function impliedVol(p, spot, days, fx) {
  const mid = (p.ask + p.bid) / 2,
    low = optionPrice(p, spot, 0.001, days, fx),
    high = optionPrice(p, spot, 4, days, fx);
  if (mid <= low || mid >= high) return null;
  let lo = 0.001,
    hi = 4;
  for (let i = 0; i < 55; i++) {
    const v = (lo + hi) / 2;
    if (optionPrice(p, spot, v, days, fx) > mid) hi = v;
    else lo = v;
  }
  return (lo + hi) / 2;
}
function fee(p, notional) {
  return notional <= 0
    ? 0
    : Math.max(
        (p.commission ?? 0) + (notional * (p.commissionPct ?? 0)) / 100,
        p.commissionMin ?? 0,
      );
}
export function liquidation(entry, bid, terms = entry.product) {
  const gross = entry.quantity * bid;
  return entry.cash + Math.max(0, gross - fee(terms, gross));
}
function summarize(values, hit) {
  const a = values.map((v) => v - 1000);
  return {
    expected: a.reduce((x, y) => x + y, 0) / a.length,
    profit: a.filter((v) => v > 0).length / a.length,
    double: hit / a.length,
    p10: quantile(a, 0.1),
    median: quantile(a, 0.5),
    p90: quantile(a, 0.9),
    samples: a.length,
  };
}
export function forecast(p, h, fx, day) {
  const pos = position(p, 1000),
    spot = h.spot,
    days = (Date.parse(p.expiry) - Date.parse(day)) / DAY,
    iv = impliedVol(p, spot, days, fx);
  if (iv === null) throw Error("Prix incompatible avec le modèle européen");
  const entry = { ...pos, product: p },
    spreads = p.ask - p.bid;
  const remainingDays = Array.from(
    { length: 20 },
    (_, j) =>
      (Date.parse(p.expiry) - Date.parse(addSessions(day, j + 1))) / DAY,
  );
  const samples = (window, volScale) => {
    const closes = h.closes.slice(-window - 21),
      logs = closes.slice(1).map((v, i) => Math.log(v / closes[i])),
      m = logs.reduce((a, b) => a + b, 0) / logs.length;
    const values = [];
    let hit = 0;
    for (let start = 0; start + 20 <= logs.length; start++) {
      let s = spot,
        value = 1000;
      for (let j = 0; j < 20; j++) {
        // Remove historical drift. The ranking does not assume the last bull market repeats.
        s *= Math.exp(logs[start + j] - m);
        const remaining = remainingDays[j];
        const bid = Math.max(
          0,
          optionPrice(p, s, iv * volScale, remaining, fx) - spreads / 2,
        );
        value = liquidation(entry, bid);
        if (value >= 2000) {
          hit++;
          break;
        }
        if (value <= 500) break;
      }
      values.push(value);
    }
    return summarize(values, hit);
  };
  const long = samples(1254, 1),
    recent = samples(252, 1),
    stress = samples(1254, 0.8);
  const conservative = Math.min(
    long.expected,
    recent.expected,
    stress.expected,
  );
  return {
    ...long,
    recentExpected: recent.expected,
    stressExpected: stress.expected,
    conservative,
    impliedVol: iv,
    spot,
    historyThrough: h.dates.at(-1),
    spotAt: h.spotAt,
    fx,
    score: 0.5 * long.p90 + 0.5 * conservative,
    assumptions: {
      drift: 0,
      rate: 0,
      dividend: 0,
      fx: "constant",
      volatility: "constant; stress -20%",
      spread: "constant EUR",
      overlappingSamples: true,
    },
  };
}
export function eligibility(p, d, at) {
  const errors = validateProduct(p),
    day = parisDay(at),
    q = Date.parse(p.quoteAt),
    now = Date.parse(at),
    h = d.assets[p.underlying],
    fail = d.quotesCollection?.failures?.some((f) => f.scope === p.isin);
  if (fail || !Number.isFinite(q) || q > now || now - q > 2 * 3600000)
    errors.push("Prix absent ou ancien");
  if (!p.venueVerified) errors.push("Offre BoursoMarkets non confirmée");
  if (!(p.bid > 0) || (p.ask - p.bid) / p.ask > 0.08)
    errors.push("Spread supérieur à 8 % ou bid absent");
  if (!p.sourceUrl || !p.kidUrl) errors.push("Source ou DIC absent");
  if (
    !h ||
    h.closes.length < 500 ||
    h.closes.length !== h.dates.length ||
    h.dates.some((v, i) => v > day || (i && v <= h.dates[i - 1])) ||
    h.closes.some((v) => !(v > 0 && Number.isFinite(v))) ||
    sessionsBetween(h.dates.at(-1), day) > 1 ||
    d.collection?.failedAssets?.includes(p.underlying)
  )
    errors.push("Historique incomplet ou ancien");
  if (
    !h?.spotAt ||
    !(h.spot > 0) ||
    now - Date.parse(h.spotAt) > 4 * 3600000 ||
    Date.parse(h.spotAt) > now ||
    Math.abs(q - Date.parse(h.spotAt)) > 4 * 3600000
  )
    errors.push("Prix du sous-jacent absent ou désynchronisé");
  if (
    d.collection?.failedAssets?.includes("EURUSD") ||
    !d.fxAt ||
    now - Date.parse(d.fxAt) > 4 * DAY ||
    Date.parse(d.fxAt) > now ||
    !(d.fx > 0)
  )
    errors.push("Change absent ou ancien");
  if (
    p.expiry < date(Date.parse(addSessions(day, 20)) + 7 * DAY) ||
    (Date.parse(p.expiry) - Date.parse(day)) / DAY > 120
  )
    errors.push("Échéance hors horizon");
  const pos = position(p, 1000);
  if (!pos.quantity || pos.quantity * p.ask < (p.minOrder ?? 500))
    errors.push("Ordre inférieur au minimum");
  return [...new Set(errors)];
}
export function rankCandidates(d, at, excluded = new Set()) {
  const ranked = [],
    rejected = [];
  for (const p of d.products) {
    if (excluded.has(p.isin)) continue;
    const reasons = eligibility(p, d, at);
    if (reasons.length) {
      rejected.push({ isin: p.isin, reasons });
      continue;
    }
    try {
      const prediction = forecast(
        p,
        d.assets[p.underlying],
        d.fx,
        parisDay(at),
      );
      ranked.push({ product: p, prediction });
    } catch (e) {
      rejected.push({ isin: p.isin, reasons: [e.message] });
    }
  }
  ranked.sort(
    (a, b) =>
      b.prediction.score - a.prediction.score ||
      a.product.isin.localeCompare(b.product.isin),
  );
  return { ranked, rejected };
}
const sameTerms = (a, b) =>
  [
    "isin",
    "underlying",
    "direction",
    "strike",
    "ratio",
    "currency",
    "expiry",
  ].every((k) => a[k] === b[k]);
export function advanceTracker(previous, d, at = new Date().toISOString()) {
  const ledger = structuredClone(
    previous ?? {
      version: 1,
      startedAt: at,
      rule: RULE,
      positions: [],
      batches: [],
    },
  );
  if (ledger.rule.version !== RULE.version)
    throw Error("Rule change requires an explicit migration");
  if (ledger.updatedAt && at < ledger.updatedAt)
    throw Error("Out-of-order collection");
  const day = parisDay(at),
    index = new Map(d.products.map((p) => [p.isin, p]));
  for (const entry of ledger.positions) {
    if (entry.exit) continue;
    const p = index.get(entry.product.isin),
      last = entry.marks.at(-1);
    // Never manufacture a settlement after expiry, or advance an old observation clock.
    if (
      !p ||
      !sameTerms(p, entry.product) ||
      p.quoteAt <= last.at ||
      p.quoteAt > at ||
      parisDay(p.quoteAt) > entry.product.expiry ||
      Date.parse(at) - Date.parse(p.quoteAt) > 36 * 3600000 ||
      d.quotesCollection?.failures?.some((f) => f.scope === p.isin) ||
      validateProduct(p).length
    )
      continue;
    const value = liquidation(entry, p.bid, p),
      mark = {
        at: p.quoteAt,
        bid: p.bid,
        ask: p.ask,
        value,
        fee: fee(p, entry.quantity * p.bid),
        source: p.sourceUrl,
      };
    entry.marks.push(mark);
    const observedDay = parisDay(p.quoteAt),
      reason =
        value >= 2000
          ? "target"
          : value <= 500
            ? "stop"
            : observedDay >= entry.dueDay
              ? "time"
              : null;
    if (reason) entry.exit = { ...mark, reason, pnl: value - 1000 };
  }
  if (isSession(day) && !ledger.batches.some((b) => b.day === day)) {
    const { ranked, rejected } = rankCandidates(
        d,
        at,
        new Set(ledger.positions.map((p) => p.product.isin)),
      ),
      chosen = [],
      seen = new Set();
    for (const item of ranked) {
      if (seen.has(item.product.underlying)) continue;
      chosen.push(item);
      seen.add(item.product.underlying);
      if (chosen.length === 3) break;
    }
    const ids = [];
    for (const [rank, { product, prediction }] of chosen.entries()) {
      const pos = position(product, 1000),
        entry = {
          id: `${day}-${product.isin}`,
          selectedAt: at,
          day,
          rank: rank + 1,
          rule: { ...RULE },
          product: structuredClone(product),
          ...pos,
          entryFee: pos.cost - pos.quantity * product.ask,
          prediction,
          dueDay: addSessions(day, 20),
          marks: [],
          exit: null,
        };
      entry.marks.push({
        at: product.quoteAt,
        bid: product.bid,
        ask: product.ask,
        value: liquidation(entry, product.bid),
        fee: fee(product, pos.quantity * product.bid),
        source: product.sourceUrl,
      });
      ledger.positions.push(entry);
      ids.push(entry.id);
    }
    // A failed/empty scan may recover later on the same day. A published cohort is frozen.
    if (ids.length)
      ledger.batches.push({
        day,
        at,
        ids,
        universe: d.products.length,
        eligible: ranked.length,
        rejected,
      });
    ledger.scan = {
      day,
      at,
      universe: d.products.length,
      eligible: ranked.length,
      rejected,
      selected: ids.length,
    };
  }
  ledger.updatedAt = at;
  return ledger;
}
export function trackerView(ledger, at = new Date().toISOString()) {
  const day = parisDay(at),
    positions = ledger.positions.map((p) => {
      const last = p.marks.at(-1),
        stale =
          !p.exit &&
          (sessionsBetween(parisDay(last.at), day) > 1 ||
            day > p.product.expiry),
        overdue = !p.exit && day > p.dueDay;
      return {
        ...p,
        status: p.exit
          ? "closed"
          : stale
            ? "unavailable"
            : overdue
              ? "overdue"
              : "open",
        latest: last,
        value: stale ? null : last.value,
        pnl: stale ? null : last.value - 1000,
      };
    });
  const closed = positions.filter((p) => p.exit),
    open = positions.filter((p) => !p.exit),
    wins = closed.filter((p) => p.exit.pnl > 0).length;
  const pnl = closed.reduce((s, p) => s + p.exit.pnl, 0),
    predicted = closed.map((p) => p.prediction.profit),
    brier = closed.length
      ? closed.reduce(
          (s, p, i) => s + (predicted[i] - (p.exit.pnl > 0 ? 1 : 0)) ** 2,
          0,
        ) / closed.length
      : null;
  const calibration = Array.from({ length: 5 }, (_, i) => {
    const rows = closed.filter(
      (p) => Math.min(4, Math.floor(p.prediction.profit * 5)) === i,
    );
    return {
      low: i / 5,
      high: (i + 1) / 5,
      count: rows.length,
      predicted: rows.length
        ? rows.reduce((s, p) => s + p.prediction.profit, 0) / rows.length
        : null,
      observed: rows.length
        ? rows.filter((p) => p.exit.pnl > 0).length / rows.length
        : null,
    };
  });
  return {
    ...ledger,
    asOf: at,
    positions,
    health: {
      stale:
        !ledger.updatedAt ||
        sessionsBetween(parisDay(ledger.updatedAt), day) > 1 ||
        Date.parse(at) - Date.parse(ledger.updatedAt) > 96 * 3600000,
      lastScan: ledger.updatedAt,
    },
    stats: {
      selected: positions.length,
      open: open.length,
      closed: closed.length,
      unavailable: open.filter((p) => p.value === null).length,
      realizedPnl: pnl,
      winRate: closed.length ? wins / closed.length : null,
      meanPnl: closed.length ? pnl / closed.length : null,
      returnOnClosedCapital: closed.length
        ? pnl / (1000 * closed.length)
        : null,
      meanPredicted: closed.length
        ? predicted.reduce((a, b) => a + b, 0) / closed.length
        : null,
      brier,
      baselineBrier: closed.length ? 0.25 : null,
      modelStatus: closed.length < 30 ? "insufficient" : "exploratory",
      calibration,
    },
  };
}
