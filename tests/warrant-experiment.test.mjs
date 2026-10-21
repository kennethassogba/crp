import test from "node:test";
import assert from "node:assert/strict";
import {
  compareWarrants,
  recordWarrantQuotes,
  warrantPortfolio,
} from "../lib/warrant-experiment.mjs";
const p = {
  id: "TEST",
  isin: "DE000FG32YX6",
  underlying: "NDX",
  direction: "call",
  strike: 31000,
  ratio: 0.01,
  currency: "USD",
  expiry: "2026-11-20",
  quoteAt: "2026-10-16T20:00:00Z",
  bid: 2.9,
  ask: 3,
  venueVerified: true,
  minOrder: 500,
};
const data = (products = [p]) => ({
  analysisDate: "2026-10-19",
  collectedAt: "2026-10-19T23:00:00Z",
  warrantExperiment: recordWarrantQuotes(undefined, products),
});
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("warrant experiment fixes entry quantity, marks bid, retains cash and normalizes EUR 3000 to 100", () => {
  const d = data([{ ...p, ask: 7, bid: 6.9 }]);
  d.warrantExperiment = recordWarrantQuotes(d.warrantExperiment, [
    {
      ...p,
      ask: 10,
      bid: 9,
      quoteAt: "2026-10-19T20:00:00Z",
      observedAt: "2026-10-19T20:00:00Z",
    },
  ]);
  const r = compareWarrants(d).contracts[0];
  assert.equal(r.sourceQuantity, 428);
  near(r.cash, 4 / 30);
  near(r.capital, (428 * 9 + 4) / 30);
  near(r.pnl, r.capital - 100);
  near(r.curve[0].capital, (428 * 6.9 + 4) / 30);
  assert.equal(r.entryAsk, 7);
  assert.equal(r.status, "observed");
});
test("spread creates an immediate loss and assumed entry plus exit brokerage is included", () => {
  const d = data([{ ...p, venueVerified: false }]);
  const r = compareWarrants(d).contracts[0];
  assert.equal(r.sourceQuantity, 996);
  near(r.entryFee, 9.95 / 30);
  near(r.exitFee, 9.95 / 30);
  near(r.capital, (3000 - 996 * 3 - 9.95 + 996 * 2.9 - 9.95) / 30);
  near(r.maxLoss, (996 * 3 + 9.95) / 30);
  assert.ok(r.capital < 100);
});
test("failed observations neither reset entries nor append fabricated prices", () => {
  const d = data();
  const before = structuredClone(d.warrantExperiment);
  d.warrantExperiment = recordWarrantQuotes(d.warrantExperiment, [p]);
  assert.deepEqual(d.warrantExperiment, before);
  d.quotesCollection = {
    at: "2026-10-19T23:00:00Z",
    failures: [{ scope: p.isin }],
  };
  const r = compareWarrants(d).contracts[0];
  assert.equal(r.status, "stale");
  assert.equal(r.valuationAt, p.quoteAt);
  assert.equal(r.curve.length, 1);
  assert.ok(r.capital > 0);
});
test("expired contracts remain archived but missing reimbursement is not reported as zero or profit", () => {
  const d = data();
  d.analysisDate = "2026-11-21";
  const r = compareWarrants(d).contracts[0];
  assert.equal(r.status, "settlement-missing");
  assert.equal(r.capital, null);
  assert.equal(r.pnl, null);
  assert.equal(r.curve.length, 1);
  assert.deepEqual(
    recordWarrantQuotes(d.warrantExperiment, []),
    d.warrantExperiment,
  );
});
test("new contracts start at their own first quote, archived inputs stay immutable", () => {
  const d = data();
  const original = structuredClone(d.warrantExperiment);
  const next = {
    ...p,
    id: "NEW",
    isin: "DE000FG35JX0",
    quoteAt: "2026-10-19T20:00:00Z",
  };
  d.warrantExperiment = recordWarrantQuotes(d.warrantExperiment, [next]);
  assert.deepEqual(d.warrantExperiment.contracts[0], original.contracts[0]);
  const r = compareWarrants(d).contracts[1];
  assert.equal(r.startedAt, next.quoteAt);
  assert.equal(r.curve.length, 1);
  assert.equal(r.sourceQuantity, 1000);
});
test("archive rejects contradictory quotes and changed contract terms; source minimum is respected", () => {
  const archive = recordWarrantQuotes(undefined, [p]);
  assert.throws(
    () => recordWarrantQuotes(archive, [{ ...p, bid: 2.8 }]),
    /Conflicting quote/,
  );
  assert.throws(
    () => recordWarrantQuotes(archive, [{ ...p, strike: 32000 }]),
    /Contract changed/,
  );
  const r = compareWarrants(data([{ ...p, minOrder: 5000 }])).contracts[0];
  assert.equal(r.status, "blocked");
  assert.equal(r.capital, null);
  assert.equal(r.pnl, null);
});
test("empty history has no fictitious positions or fabricated post-expiry observations", () => {
  assert.deepEqual(
    compareWarrants({ analysisDate: "2026-10-19" }).contracts,
    [],
  );
  assert.equal(
    recordWarrantQuotes(undefined, [{ ...p, quoteAt: "2026-11-21T10:00:00Z" }])
      .contracts.length,
    0,
  );
});

test("EUR 1000 J1 portfolio buys 689 Q433S, keeps EUR 0.95 and pays the spread immediately", () => {
  const first = { ...p, ask: 1.45, bid: 1.44 };
  const d = data([first]);
  const result = warrantPortfolio(d);
  assert.equal(result.capital, 1000);
  assert.equal(result.basis, "whole-unit-buy-and-hold");
  assert.equal(result.positions[0].quantity, 689);
  near(result.cash, 0.95);
  near(result.maxLoss, 999.05);
  near(result.capitalNow, 993.11);
  near(result.pnl, -6.89);
  assert.equal(result.curve[0].equity, 1000);
  near(result.curve[1].equity, 993.11);
});
test("J1 portfolio never rebuys, reallocates to winners or resets after the next quote", () => {
  const d = data([{ ...p, ask: 1.45, bid: 1.44 }]);
  d.warrantExperiment = recordWarrantQuotes(d.warrantExperiment, [
    { ...p, ask: 1.75, bid: 1.74, quoteAt: "2026-10-19T20:00:00Z" },
    { ...p, isin: "DE000FG35JX0", bid: 9, ask: 10 },
  ]);
  const result = warrantPortfolio(d);
  assert.equal(result.positions.length, 1);
  assert.equal(result.positions[0].quantity, 689);
  assert.equal(result.startedAt, p.quoteAt);
  near(result.cash, 0.95);
  near(result.capitalNow, 1199.81);
  near(result.pnl, 199.81);
});
test("portfolio includes source fees, preserves full budget when blocked and never invents settlement", () => {
  const d = data([{ ...p, venueVerified: false }]);
  const r = warrantPortfolio(d);
  assert.equal(r.positions[0].quantity, 330);
  near(r.entryFee, 9.95);
  near(r.exitFee, 9.95);
  near(r.capitalNow, 947.1);
  near(r.cash, 0.05);
  d.analysisDate = "2026-11-21";
  assert.equal(warrantPortfolio(d).capitalNow, null);
  assert.equal(warrantPortfolio(d).status, "settlement-missing");
  const blocked = warrantPortfolio(data([{ ...p, minOrder: 2000 }]));
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.cash, 1000);
  assert.equal(blocked.maxLoss, 0);
  assert.deepEqual(blocked.positions, []);
  assert.equal(warrantPortfolio({}).status, "missing");
});
