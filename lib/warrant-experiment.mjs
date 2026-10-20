import { position, tradingDays, validateProduct } from "./warrants.mjs";

// A comparison unit, not a EUR 100 executable order. Source positions obey
// whole-unit sizing and the catalog's minimum order, then scale by 100/3000.
export const WARRANT_EXPERIMENT = Object.freeze({
  version: 1,
  capital: 100,
  sourceCapital: 3000,
  currency: "EUR",
  basis: "normalized-return",
  taxesIncluded: false,
});
const feeTerms = (p) =>
  p.venueVerified === true
    ? { commission: 0, commissionPct: 0, commissionMin: 0 }
    : {
        commission: p.commission ?? 0,
        commissionPct: Math.max(0.1, p.commissionPct ?? 0),
        commissionMin: Math.max(9.95, p.commissionMin ?? 0),
      };
const fee = (p, value) =>
  Math.max(
    (p.commission ?? 0) + (value * (p.commissionPct ?? 0)) / 100,
    p.commissionMin ?? 0,
  );
const quote = (p) => ({
  at: p.quoteAt,
  bid: p.bid,
  ask: p.ask,
  kind: p.observedAt ? "observation" : "reference",
  source: p.sourceUrl ?? p.brokerUrl ?? null,
  ...feeTerms(p),
});
export function recordWarrantQuotes(
  previous = { contracts: [] },
  products = [],
) {
  const contracts = structuredClone(previous.contracts ?? []);
  for (const p of products) {
    if (validateProduct(p).length || p.quoteAt.slice(0, 10) > p.expiry)
      continue;
    let item = contracts.find((c) => c.product.isin === p.isin);
    if (!item) {
      item = { product: { ...p }, quotes: [] };
      contracts.push(item);
    }
    for (const key of [
      "underlying",
      "direction",
      "strike",
      "ratio",
      "currency",
      "expiry",
    ])
      if (item.product[key] !== p[key])
        throw Error(`Contract changed: ${p.isin} ${key}`);
    const q = quote(p),
      old = item.quotes.find((x) => Date.parse(x.at) === Date.parse(q.at));
    if (old) {
      if (old.bid !== q.bid || old.ask !== q.ask)
        throw Error(`Conflicting quote: ${p.isin} ${q.at}`);
      continue; // A failed refresh retained the same timestamp: no invented point.
    }
    if (
      item.quotes.length &&
      Date.parse(q.at) < Date.parse(item.quotes.at(-1).at)
    )
      throw Error(`Out-of-order quote: ${p.isin}`);
    if (q.at.slice(0, 10) <= p.expiry) item.quotes.push(q);
  }
  return { ...WARRANT_EXPERIMENT, contracts };
}
export function compareWarrants(dataset) {
  const archive = dataset.warrantExperiment;
  const asOf = dataset.quotesCollection?.at ?? dataset.collectedAt;
  const failures = new Set(
    (dataset.quotesCollection?.failures ?? []).map((f) => f.scope),
  );
  const scale = WARRANT_EXPERIMENT.capital / WARRANT_EXPERIMENT.sourceCapital;
  return {
    ...WARRANT_EXPERIMENT,
    asOf,
    contracts: (archive?.contracts ?? []).map(({ product: p, quotes }) => {
      const entry = quotes[0],
        latest = quotes.at(-1);
      const pos = position(
        { ...p, ...entry, ...feeTerms(p), ask: entry.ask },
        WARRANT_EXPERIMENT.sourceCapital,
      );
      const eligible =
        pos.quantity > 0 && pos.quantity * entry.ask >= (p.minOrder ?? 0);
      const curve = eligible
        ? quotes.map((q) => {
            const proceeds = pos.quantity * q.bid;
            const exitFee = Math.min(proceeds, fee(q, proceeds));
            return {
              at: q.at,
              capital: (pos.cash + proceeds - exitFee) * scale,
              bid: q.bid,
              exitFee: exitFee * scale,
              kind: q.kind,
            };
          })
        : [];
      const expired = dataset.analysisDate > p.expiry;
      const stale =
        failures.has(p.isin) ||
        tradingDays(latest.at, dataset.analysisDate) > 1;
      const status = !eligible
        ? "blocked"
        : expired
          ? "settlement-missing"
          : stale
            ? "stale"
            : latest.kind === "reference"
              ? "reference"
              : "observed";
      const capital = !eligible || expired ? null : curve.at(-1).capital;
      return {
        id: p.id,
        isin: p.isin,
        underlying: p.underlying,
        direction: p.direction,
        expiry: p.expiry,
        brokerUrl: p.brokerUrl,
        status,
        startedAt: entry.at,
        entryKind: entry.kind,
        entryAsk: entry.ask,
        entryBid: entry.bid,
        valuationAt: latest.at,
        bid: latest.bid,
        capital,
        pnl: capital === null ? null : capital - WARRANT_EXPERIMENT.capital,
        sourceQuantity: pos.quantity,
        sourceCost: pos.cost,
        cash: pos.cash * scale,
        entryFee: (pos.cost - pos.quantity * entry.ask) * scale,
        exitFee: curve.at(-1)?.exitFee ?? null,
        maxLoss: pos.cost * scale,
        curve,
        source: latest.source,
      };
    }),
  };
}
