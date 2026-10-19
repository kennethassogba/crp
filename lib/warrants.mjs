// Research engine v1. Frozen inputs, terminal payoffs, no trade execution.
export const ENGINE_VERSION = "1.0.0";
const DAY = 86400000;
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
export const quantile = (a, p) => {
  const b = [...a].sort((x, y) => x - y),
    i = (b.length - 1) * p;
  return b[Math.floor(i)] + (b[Math.ceil(i)] - b[Math.floor(i)]) * (i % 1);
};
export function normalCDF(x) {
  const z = Math.abs(x),
    t = 1 / (1 + 0.2316419 * z);
  const tail =
    (Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)) *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x < 0 ? tail : 1 - tail;
}
function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function tradingDays(from, to) {
  let n = 0;
  for (
    let t = Date.parse(from.slice(0, 10)) + DAY;
    t <= Date.parse(to.slice(0, 10));
    t += DAY
  ) {
    const d = new Date(t),
      weekday = d.getUTCDay(),
      month = d.getUTCMonth(),
      day = d.getUTCDate();
    // This estimator excludes weekends, US Thanksgiving, Christmas and New Year.
    // Other exchange holidays require a venue calendar in a production feed.
    if (
      weekday !== 0 &&
      weekday !== 6 &&
      !(month === 10 && weekday === 4 && day >= 22 && day <= 28) &&
      !(month === 11 && day === 25) &&
      !(month === 0 && day === 1)
    )
      n++;
  }
  return n;
}
export function validateProduct(p) {
  const errors = [];
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(p.isin ?? ""))
    errors.push("ISIN invalide");
  if (!["call", "put"].includes(p.direction)) errors.push("Sens : call ou put");
  if (!["EUR", "USD"].includes(p.currency)) errors.push("Devise : EUR ou USD");
  for (const k of ["strike", "ratio", "ask"])
    if (!(Number.isFinite(p[k]) && p[k] > 0))
      errors.push(`${k} doit être positif`);
  if (!(Number.isFinite(p.bid) && p.bid >= 0 && p.bid <= p.ask))
    errors.push("Fourchette incohérente");
  if (!p.underlying || !p.id) errors.push("Identifiant et sous-jacent requis");
  for (const k of ["expiry", "quoteAt"])
    if (!p[k] || !Number.isFinite(Date.parse(p[k])))
      errors.push(`${k} invalide`);
  for (const k of ["commission", "commissionPct", "commissionMin", "minOrder"])
    if (p[k] != null && !(Number.isFinite(p[k]) && p[k] >= 0))
      errors.push(`${k} invalide`);
  if (p.style && p.style !== "european")
    errors.push("Seuls les warrants européens standard sont pris en charge");
  return errors;
}
export function position(p, budget) {
  const fee = p.commission ?? 0,
    rate = (p.commissionPct ?? 0) / 100,
    minimum = p.commissionMin ?? 0;
  const quantity = Math.max(
    0,
    Math.floor(Math.min((budget - fee) / (1 + rate), budget - minimum) / p.ask),
  );
  const notional = quantity * p.ask;
  const cost =
    notional + (quantity ? Math.max(fee + notional * rate, minimum) : 0);
  return {
    quantity,
    cost,
    cash: budget - cost,
    spreadCost: quantity * (p.ask - p.bid),
    maxLoss: cost,
  };
}
export function payoff(p, spot, fx = 1.124) {
  return (
    (Math.max(p.direction === "call" ? spot - p.strike : p.strike - spot, 0) *
      p.ratio) /
    (p.currency === "USD" ? fx : 1)
  );
}
export function realizedVol(closes, window = 252) {
  const c = closes.slice(-window - 1),
    r = c.slice(1).map((x, i) => Math.log(x / c[i]));
  if (r.length < 20) return NaN;
  const m = mean(r);
  return Math.sqrt(
    (r.reduce((s, x) => s + (x - m) ** 2, 0) / (r.length - 1)) * 252,
  );
}
export function grossReturns(closes, horizon, window = 1254, neutral = true) {
  if (horizon < 1) return [];
  const g = [];
  for (
    let i = Math.max(0, closes.length - window - 1);
    i + horizon < closes.length;
    i++
  )
    g.push(closes[i + horizon] / closes[i]);
  const scale = neutral && g.length ? mean(g) : 1;
  return g.map((x) => x / scale);
}
export function empirical(
  p,
  spot,
  gross,
  budget = 3000,
  fx = 1.124,
  multiple = 5,
) {
  const pos = position(p, budget);
  if (!gross.length || !pos.quantity) return null;
  const values = gross.map((g) => payoff(p, spot * g, fx) * pos.quantity);
  const net = values.map((v) => v - pos.cost);
  return {
    ...pos,
    expected: mean(net),
    profit: net.filter((x) => x > 0).length / net.length,
    multiple:
      values.filter((x) => x >= multiple * pos.cost).length / values.length,
    zero: values.filter((x) => x === 0).length / values.length,
    samples: net.length,
    p05: quantile(net, 0.05),
    median: quantile(net, 0.5),
    p95: quantile(net, 0.95),
    net,
  };
}
export function gbm(
  p,
  spot,
  vol,
  days,
  budget = 3000,
  fx = 1.124,
  multiple = 5,
  mu = 0,
) {
  const pos = position(p, budget),
    t = days / 365,
    a = vol * Math.sqrt(t);
  if (!(a > 0) || !pos.quantity) return null;
  const d2 = (Math.log(spot / p.strike) + (mu - 0.5 * vol ** 2) * t) / a;
  const forward = spot * Math.exp(mu * t);
  const raw =
    p.direction === "call"
      ? forward * normalCDF(d2 + a) - p.strike * normalCDF(d2)
      : p.strike * normalCDF(-d2) - forward * normalCDF(-d2 - a);
  const unit =
    (pos.cost / pos.quantity / p.ratio) * (p.currency === "USD" ? fx : 1);
  const threshold = (m) =>
    p.strike + (p.direction === "call" ? 1 : -1) * m * unit;
  const tail = (b) =>
    b <= 0
      ? 1
      : normalCDF((Math.log(spot / b) + (mu - 0.5 * vol ** 2) * t) / a);
  const probability = (b) =>
    p.direction === "call" ? tail(b) : b <= 0 ? 0 : 1 - tail(b);
  return {
    expected:
      ((raw * p.ratio) / (p.currency === "USD" ? fx : 1)) * pos.quantity -
      pos.cost,
    profit: probability(threshold(1)),
    multiple: probability(threshold(multiple)),
    zero: p.direction === "call" ? 1 - tail(p.strike) : tail(p.strike),
    vol,
  };
}
export function bootstrap(
  p,
  spot,
  rawGross,
  budget = 3000,
  fx = 1.124,
  options = {},
) {
  const {
    repetitions = 800,
    block = 43,
    seed = 20261019,
    neutral = true,
  } = options;
  if (rawGross.length < Math.max(block * 2, 50)) return null;
  const rand = random(seed),
    estimates = [];
  const pos = position(p, budget);
  for (let b = 0; b < repetitions; b++) {
    const sample = [];
    while (sample.length < rawGross.length) {
      const start = Math.floor(rand() * (rawGross.length - block + 1));
      for (let j = 0; j < block && sample.length < rawGross.length; j++)
        sample.push(rawGross[start + j]);
    }
    const scale = neutral ? mean(sample) : 1;
    const value = mean(sample.map((g) => payoff(p, (spot * g) / scale, fx)));
    estimates.push(pos.quantity * value - pos.cost);
  }
  return {
    lower: quantile(estimates, 0.025),
    upper: quantile(estimates, 0.975),
    repetitions,
    block,
  };
}
export function analyze(p, history, options = {}) {
  const {
    budget = 3000,
    fx = 1.124,
    multiple = 5,
    asOf = new Date().toISOString(),
    neutral = true,
  } = options;
  const errors = validateProduct(p);
  if (
    !(
      budget > 0 &&
      budget <= 10000000 &&
      fx > 0 &&
      multiple >= 1 &&
      Number.isFinite(Date.parse(asOf))
    )
  )
    errors.push("Budget, date, change ou multiple invalide");
  if (errors.length) return { error: errors.join(" · ") };
  if (
    !history ||
    !Array.isArray(history.closes) ||
    !Array.isArray(history.dates) ||
    history.closes.length < 100
  )
    return { error: "Historique du sous-jacent absent ou trop court" };
  const days = Math.ceil(
    (Date.parse(p.expiry) - Date.parse(asOf.slice(0, 10))) / DAY,
  );
  if (days <= 0) return { error: "Produit arrivé à échéance" };
  if (days > 365)
    return { error: "Horizon supérieur à un an : hors périmètre du screener" };
  const horizon = tradingDays(asOf, p.expiry),
    spot = history.closes.at(-1);
  const key = `${p.underlying}:${horizon}:${neutral}`;
  let scenarios = options.cache?.get(key);
  if (!scenarios) {
    scenarios = {
      gross: grossReturns(history.closes, horizon, 1254, neutral),
      recent: grossReturns(history.closes, horizon, 252, neutral),
      vol20: realizedVol(history.closes, 20),
      vol60: realizedVol(history.closes, 60),
      vol252: realizedVol(history.closes, 252),
    };
    options.cache?.set(key, scenarios);
  }
  const { gross, recent, vol20, vol60, vol252 } = scenarios;
  const long = empirical(p, spot, gross, budget, fx, multiple);
  const short = empirical(p, spot, recent, budget, fx, multiple);
  const model20 = gbm(p, spot, vol20, days, budget, fx, multiple),
    model60 = gbm(p, spot, vol60, days, budget, fx, multiple),
    model252 = gbm(p, spot, vol252, days, budget, fx, multiple);
  const pos = position(p, budget),
    unit = pos.quantity
      ? (pos.cost / pos.quantity / p.ratio) * (p.currency === "USD" ? fx : 1)
      : 0;
  const sign = p.direction === "call" ? 1 : -1;
  const quoteAge = Math.max(0, tradingDays(p.quoteAt, asOf)),
    historyAge = Math.max(0, tradingDays(history.dates.at(-1), asOf));
  const pessimistic = Math.min(
    ...[long, short, model20, model60, model252]
      .filter(Boolean)
      .map((m) => m.expected),
  );
  return {
    ...pos,
    days,
    horizon,
    spot,
    long,
    short,
    model20,
    model60,
    model252,
    vol20,
    vol60,
    vol252,
    breakEven: p.strike + sign * unit,
    multipleThreshold: p.strike + sign * unit * multiple,
    spread: (p.ask - p.bid) / p.ask,
    quoteAge,
    historyAge,
    pessimistic,
    status:
      !pos.quantity || pos.quantity * p.ask < (p.minOrder ?? 0)
        ? "Budget insuffisant"
        : historyAge > 1
          ? "Historique ancien"
          : quoteAge > 1
            ? "Cotation ancienne"
            : long && short && pessimistic > 0
              ? "À valider"
              : "Non robuste",
  };
}
// CSV accepts RFC-style escaped quotes and either comma or semicolon separators.
export function parseCSV(text) {
  if (text.length > 2_000_000) throw Error("Fichier limité à 2 Mo");
  const first = text.split(/\r?\n/)[0],
    separator = first.includes(";") ? ";" : ",";
  const rows = [];
  let row = [],
    value = "",
    quoted = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      if (quoted && s[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === separator || c === "\n")) {
      row.push(value.trim());
      value = "";
      if (c === "\n") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else if (c !== "\r") value += c;
  }
  if (quoted) throw Error("Guillemets CSV non fermés");
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length > 10001) throw Error("10 000 produits maximum par import");
  const fields = rows.shift() ?? [];
  if (
    ![
      "id",
      "isin",
      "underlying",
      "ask",
      "bid",
      "strike",
      "ratio",
      "direction",
      "currency",
      "expiry",
      "quoteAt",
    ].every((k) => fields.includes(k))
  )
    throw Error("Colonnes requises absentes. Télécharger le modèle CSV.");
  const seen = new Set();
  return rows.map((cells, i) => {
    if (cells.length !== fields.length)
      throw Error(`Ligne ${i + 2} : nombre de colonnes incorrect`);
    const p = Object.fromEntries(fields.map((k, j) => [k, cells[j]]));
    for (const k of [
      "ask",
      "bid",
      "strike",
      "ratio",
      "commission",
      "commissionPct",
      "commissionMin",
      "minOrder",
    ])
      if (p[k] !== undefined) p[k] = Number(String(p[k]).replace(",", "."));
    if (seen.has(p.isin)) throw Error(`Ligne ${i + 2} : ISIN dupliqué`);
    seen.add(p.isin);
    const errors = validateProduct(p);
    if (errors.length) throw Error(`Ligne ${i + 2} : ${errors.join(", ")}`);
    return p;
  });
}
