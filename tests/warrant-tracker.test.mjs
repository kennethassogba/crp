import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  RULE,
  addSessions,
  isSession,
  optionPrice,
  impliedVol,
  advanceTracker,
  trackerView,
  rankCandidates,
  eligibility,
} from "../lib/warrant-tracker.mjs";
import { position } from "../lib/warrants.mjs";
const at = "2026-10-22T19:00:00.000Z";
function fixture() {
  const days = [],
    closes = [];
  for (
    let t = Date.parse("2023-01-01");
    t <= Date.parse("2026-10-21");
    t += 86400000
  ) {
    const d = new Date(t).toISOString().slice(0, 10);
    if (isSession(d)) {
      days.push(d);
      closes.push(
        100 *
          Math.exp(
            0.06 * Math.sin(days.length / 7) +
              0.001 * Math.cos(days.length / 2),
          ),
      );
    }
  }
  const p = {
    id: "TEST",
    isin: "DE000FG32YX6",
    underlying: "NDX",
    direction: "call",
    strike: 100,
    ratio: 0.1,
    bid: 1.1,
    ask: 1.12,
    currency: "EUR",
    expiry: "2026-12-18",
    quoteAt: at,
    venueVerified: true,
    style: "european",
    commission: 0,
    commissionPct: 0,
    commissionMin: 0,
    minOrder: 500,
    sourceUrl: "https://www.boursorama.com/test",
    kidUrl: "https://kid.sgmarkets.com/test",
  };
  return {
    products: [p],
    assets: { NDX: { dates: days, closes, spot: 100, spotAt: at } },
    fx: 1.12,
    fxAt: at,
    quotesCollection: { failures: [] },
    collection: { failedAssets: [] },
  };
}
test("NYSE calendar counts twenty actual scheduled sessions and holidays", () => {
  assert.equal(isSession("2026-11-26"), false);
  assert.equal(isSession("2026-04-03"), false);
  assert.equal(isSession("2026-06-19"), false);
  assert.equal(isSession("2026-05-25"), false);
  assert.equal(isSession("2026-12-25"), false);
  assert.equal(addSessions("2026-10-22", 20), "2026-11-19");
  assert.equal(addSessions("2026-11-25", 1), "2026-11-27");
});
test("pricing respects put-call parity, expiry and recovers implied volatility", () => {
  const p = fixture().products[0],
    c = optionPrice(p, 110, 0.4, 60, 1.12),
    put = optionPrice({ ...p, direction: "put" }, 110, 0.4, 60, 1.12);
  assert.ok(Math.abs(c - put - 1) < 1e-7);
  const mid = optionPrice(p, 100, 0.4, 60, 1.12);
  assert.ok(
    Math.abs(
      impliedVol({ ...p, bid: mid - 0.001, ask: mid + 0.001 }, 100, 60, 1.12) -
        0.4,
    ) < 1e-6,
  );
  assert.equal(optionPrice(p, 110, 0.4, 0, 1.12), 1);
});
test("selection has no backfill, freezes forecast, whole units, ask and cash; same-day rerun is idempotent", () => {
  const d = fixture(),
    l = advanceTracker(null, d, at),
    p = l.positions[0];
  assert.equal(l.batches.length, 1);
  assert.equal(p.day, "2026-10-22");
  assert.equal(p.quantity, 892);
  assert.ok(Math.abs(p.cash - 0.96) < 1e-8);
  assert.ok(Math.abs(p.marks[0].value - 982.16) < 1e-7);
  const before = structuredClone(l);
  d.products[0].ask = 2;
  const next = advanceTracker(l, d, at);
  assert.deepEqual(l, before);
  assert.deepEqual(next.positions, l.positions);
  assert.deepEqual(next.batches, l.batches);
});
test("daily pick limit and underlying diversification; never select the same ISIN twice", () => {
  const d = fixture();
  d.products = Array.from({ length: 6 }, (_, i) => ({
    ...d.products[0],
    isin: `DE000FG32Y${i}6`,
    id: "T" + i,
    underlying: "U" + Math.floor(i / 2),
  }));
  d.assets = Object.fromEntries(
    ["U0", "U1", "U2"].map((k) => [k, structuredClone(fixture().assets.NDX)]),
  );
  const l = advanceTracker(null, d, at);
  assert.equal(l.positions.length, 3);
  assert.equal(new Set(l.positions.map((p) => p.product.underlying)).size, 3);
  const later = "2026-10-23T19:00:00.000Z";
  d.products = d.products.map((p) => ({ ...p, quoteAt: later }));
  d.fxAt = later;
  Object.values(d.assets).forEach((h) => {
    h.spotAt = later;
    h.dates.push("2026-10-22");
    h.closes.push(100);
  });
  const n = advanceTracker(l, d, later);
  assert.equal(
    new Set(n.positions.map((p) => p.product.isin)).size,
    n.positions.length,
  );
  assert.ok(n.positions.length <= 6);
});
test("stale, failed, costly spread, unconfirmed fees, missing spot and future inputs cannot become new entries", () => {
  for (const change of [
    (d) => (d.products[0].quoteAt = "2026-10-21T00:00:00Z"),
    (d) => (d.products[0].venueVerified = false),
    (d) => (d.products[0].bid = 0.5),
    (d) => delete d.assets.NDX.spotAt,
    (d) => d.assets.NDX.dates.push("2026-10-23"),
    (d) => d.quotesCollection.failures.push({ scope: d.products[0].isin }),
  ]) {
    const d = fixture();
    change(d);
    assert.ok(eligibility(d.products[0], d, at).length);
    assert.equal(advanceTracker(null, d, at).positions.length, 0);
  }
});
test("stop executes at observed bid after gaps, never at an invented stop price", () => {
  const d = fixture(),
    l = advanceTracker(null, d, at),
    p = l.positions[0];
  d.products[0].quoteAt = "2026-10-23T19:00:00Z";
  d.products[0].bid = 0.1;
  d.products[0].ask = 0.11;
  const n = advanceTracker(l, d, d.products[0].quoteAt),
    x = n.positions[0];
  assert.equal(x.exit.reason, "stop");
  assert.ok(x.exit.value < 500);
  assert.ok(Math.abs(x.exit.value - (p.quantity * 0.1 + p.cash)) < 1e-8);
  assert.equal(l.positions[0].exit, null);
  const v = trackerView(n, d.products[0].quoteAt);
  assert.equal(v.stats.closed, 1);
  assert.equal(v.stats.winRate, 0);
  assert.equal(v.stats.realizedPnl, x.exit.pnl);
  assert.equal(v.stats.brier, p.prediction.profit ** 2);
});
test("profit and time exits use actual observations; a closed position is immutable", () => {
  for (const reason of ["target", "time"]) {
    const d = fixture(),
      l = advanceTracker(null, d, at),
      p = l.positions[0];
    const later =
      reason === "target" ? "2026-10-23T19:00:00Z" : p.dueDay + "T19:00:00Z";
    d.products[0] = {
      ...d.products[0],
      quoteAt: later,
      bid: reason === "target" ? 3 : 1.2,
      ask: reason === "target" ? 3.01 : 1.21,
    };
    const n = advanceTracker(l, d, later);
    assert.equal(n.positions[0].exit.reason, reason);
    d.products[0].bid = 10;
    assert.deepEqual(advanceTracker(n, d, later).positions[0], n.positions[0]);
  }
});
test("missing prices never count as a zero result or expiry settlement", () => {
  const d = fixture(),
    l = advanceTracker(null, d, at);
  d.products = [];
  const later = "2026-12-21T19:00:00Z",
    n = advanceTracker(l, d, later),
    v = trackerView(n, later);
  assert.equal(v.positions[0].value, null);
  assert.equal(v.positions[0].pnl, null);
  assert.equal(v.stats.closed, 0);
  assert.equal(v.stats.winRate, null);
  assert.equal(v.stats.brier, null);
  assert.equal(n.positions[0].marks.length, 1);
});
test("changed contract and failed feed cannot change a position; out-of-order jobs fail", () => {
  const d = fixture(),
    l = advanceTracker(null, d, at);
  d.products[0].strike = 102;
  d.products[0].quoteAt = "2026-10-23T19:00:00Z";
  assert.deepEqual(
    advanceTracker(l, d, d.products[0].quoteAt).positions[0],
    l.positions[0],
  );
  assert.throws(
    () => advanceTracker(l, d, "2026-10-21T19:00:00Z"),
    /Out-of-order/,
  );
});
test("daily collector preserves rule and ledger; deployment cannot invoke a paid provider", () => {
  const worker = fs.readFileSync("worker/index.js", "utf8"),
    config = fs.readFileSync("cloudflare.config.ts", "utf8");
  assert.ok(!worker.includes("scheduled("));
  assert.ok(!config.includes("OPENAI_API_KEY"));
  assert.ok(!config.includes("triggers.scheduled"));
  assert.ok(!worker.includes("env.DB"));
  const workflow = fs.readFileSync(
    ".github/workflows/research-daily.yml",
    "utf8",
  );
  assert.ok(workflow.includes("research:track"));
  assert.ok(workflow.includes("public/research/tracker.json"));
  assert.equal(RULE.capital, 1000);
});
