import test from "node:test";
import assert from "node:assert/strict";
import { compareCrp } from "../lib/crp-performance.mjs";
import { MODELS } from "../lib/models.mjs";
import { HOUR, DAY, simulate, markPosition } from "../lib/strategy.mjs";
const at = 1700000000000,
  entryAt = at + HOUR;
const snapshot = {
  at,
  source: "test",
  assets: { BTC: { price: 100, stopPct: 0.01 } },
};
const fixture = (hours = 24) => ({
  source: "test",
  to: entryAt + hours * HOUR,
  assets: {
    BTC: {
      bars: Array.from({ length: 25 }, (_, i) => ({
        t: entryAt + i * HOUR,
        o: 100 + i * 0.1,
        h: 101 + i * 0.1,
        l: 99.9 + i * 0.1,
        c: 100 + (i + 1) * 0.1,
        v: 1,
      })),
      marks: Array.from({ length: 25 }, (_, i) => ({
        t: entryAt + i * HOUR,
        l: 99.9 + i * 0.1,
      })),
      funding: Array.from({ length: 25 }, (_, i) => ({
        t: entryAt + i * HOUR,
        absolutePerUnit: 0.001,
        accrualHours: 1,
      })),
    },
  },
});
const run = (id, model, action = "CASH", result = null, overrides = {}) => ({
  id,
  model,
  cohort: "live",
  snapshot_at: at,
  entry_after: entryAt,
  status: "completed",
  decision: { action },
  snapshot,
  result,
  ...overrides,
});
test("only Luna, Luna Decision and Sol receive future provider requests", () => {
  assert.deepEqual(
    MODELS.map((m) => m.id),
    ["luna", "decision", "sol"],
  );
});
test("each active portfolio starts at EUR 100, without erasing archived runs", () => {
  const records = [
    run("old", "astra", "BTC_1X", { equity: 20000, pnl: 10000 }),
  ];
  const before = JSON.stringify(records),
    result = compareCrp(MODELS, records);
  assert.equal(result.currency, "EUR");
  assert.equal(result.fxIncluded, false);
  assert.equal(result.providerCostsIncluded, false);
  assert.deepEqual(
    result.models.map((m) => [m.settledCapital, m.totalPnl]),
    [
      [100, 0],
      [100, 0],
      [100, 0],
    ],
  );
  assert.equal(JSON.stringify(records), before);
});
test("zero cash result differs from open gains and unavailable prices", () => {
  const records = [
    run("l", "luna"),
    run("d", "decision", "BTC_1X"),
    run("s", "sol", "BTC_1X"),
  ];
  const unavailable = compareCrp(MODELS, records);
  assert.equal(unavailable.models[0].totalPnl, 0);
  assert.equal(unavailable.models[1].totalPnl, null);
  const result = compareCrp(MODELS, records, fixture(4));
  assert.equal(result.models[0].estimatedCapital, 100);
  assert.ok(result.models[1].pendingPnl > 0);
  assert.equal(result.models[1].settledPnl, 0);
  assert.ok(result.models[1].estimatedCapital > 100);
});
test("EUR 100 rebase preserves compounded net returns and counts only actual trades in win rate", () => {
  const rows = [
    run("1", "luna", "BTC_1X", {
      action: "BTC_1X",
      equity: 11000,
      pnl: 1000,
      fees: 10,
      funding: 5,
      exitAt: entryAt + DAY,
    }),
    run(
      "2",
      "luna",
      "CASH",
      {
        action: "CASH",
        equity: 11000,
        pnl: 0,
        fees: 0,
        funding: 0,
        exitAt: entryAt + 2 * DAY,
      },
      { snapshot_at: at + DAY },
    ),
    run(
      "3",
      "luna",
      "BTC_1X",
      {
        action: "BTC_1X",
        equity: 10450,
        pnl: -550,
        fees: 11,
        funding: 2,
        exitAt: entryAt + 3 * DAY,
      },
      { snapshot_at: at + 2 * DAY },
    ),
    run(
      "late",
      "luna",
      "BTC_1X",
      { action: "BTC_1X", equity: 99999, pnl: 99 },
      { status: "late", snapshot_at: at + 3 * DAY },
    ),
    run(
      "replay",
      "luna",
      "BTC_1X",
      { action: "BTC_1X", equity: 25000, pnl: 15000 },
      { cohort: "replay" },
    ),
  ];
  const m = compareCrp(MODELS, rows).models[0];
  assert.equal(m.settledCapital, 104.5);
  assert.equal(m.settledPnl, 4.5);
  assert.equal(m.fees, 0.21);
  assert.equal(m.funding, 0.07);
  assert.equal(m.trades, 2);
  assert.equal(m.winRate, 0.5);
  assert.deepEqual(
    m.curve.map((p) => p.equity),
    [100, 110, 110, 104.5],
  );
});
test("open valuation matches exact settlement at the horizon, including fees and funding", () => {
  const market = fixture(),
    decision = { action: "BTC_2X" };
  assert.deepEqual(
    markPosition(decision, snapshot, market),
    simulate(decision, snapshot, market),
  );
  const normalized = markPosition(decision, snapshot, market, 100);
  const original = simulate(decision, snapshot, market, 10000);
  assert.ok(Math.abs(normalized.pnl - original.pnl * 0.01) < 1e-12);
});
test("valuation uses no future candle or future funding, and rejects gaps or a changed venue", () => {
  const market = fixture(4),
    decision = { action: "BTC_1X" };
  const before = markPosition(decision, snapshot, market);
  const changed = structuredClone(market);
  for (const b of changed.assets.BTC.bars)
    if (b.t > market.to) {
      b.o = 1;
      b.l = 0.1;
    }
  for (const f of changed.assets.BTC.funding)
    if (f.t >= market.to) f.absolutePerUnit = 999;
  assert.deepEqual(markPosition(decision, snapshot, changed), before);
  const gap = structuredClone(market);
  gap.assets.BTC.bars.splice(2, 1);
  assert.equal(markPosition(decision, snapshot, gap), null);
  assert.equal(
    markPosition(decision, snapshot, { ...market, source: "elsewhere" }),
    null,
  );
  assert.equal(
    markPosition(decision, snapshot, { ...market, to: entryAt }),
    null,
  );
});
test("intrahour stops and liquidation stay conservative in provisional valuation", () => {
  for (const liquidation of [false, true]) {
    const m = fixture();
    Object.assign(m.assets.BTC.bars[2], { o: 90, h: 91, l: 89, c: 90 });
    if (liquidation) m.assets.BTC.marks[2].l = 1;
    const expected = simulate({ action: "BTC_2X" }, snapshot, m);
    m.to = entryAt + 4 * HOUR;
    const actual = markPosition({ action: "BTC_2X" }, snapshot, m);
    assert.deepEqual(actual, expected);
    assert.equal(actual.status, liquidation ? "liquidated" : "stopped");
  }
});
test("overlapping unsettled positions never produce an invented aggregate", () => {
  const result = compareCrp(
    MODELS,
    [run("a", "luna", "BTC_1X"), run("b", "luna", "BTC_2X")],
    fixture(4),
  );
  assert.equal(result.models[0].estimatedCapital, null);
  assert.equal(result.models[0].valuationStatus, "unavailable");
});
