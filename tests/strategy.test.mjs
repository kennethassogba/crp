import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  HOUR,
  DAY,
  RULES,
  snapshotAt,
  simulate,
  position,
  replay,
  validateBars,
} from "../lib/strategy.mjs";
import {
  MODELS,
  requestBody,
  parseDecision,
  reservation,
  actualCost,
} from "../lib/models.mjs";
const market = JSON.parse(
  readFileSync(new URL("../public/data/market.json", import.meta.url)),
);
const at = market.assets.BTC.bars[500].t;
test("snapshot cannot read the next candle or later funding", () => {
  const a = snapshotAt(market, at),
    changed = structuredClone(market);
  for (const s of Object.values(changed.assets)) {
    for (const b of s.bars) if (b.t >= at) b.c *= 10;
    for (const f of s.funding) if (f.t >= at) f.rate = 99;
  }
  assert.deepEqual(a, snapshotAt(changed, at));
  for (const asset of Object.values(a.assets)) assert.ok(asset.fundingAt < at);
});
test("gaps and duplicate hours fail closed", () => {
  const s = market.assets.BTC.bars.slice(0, 30);
  assert.throws(() => validateBars(s.filter((_, i) => i !== 15)), /missing/);
  assert.throws(() => validateBars([...s, s.at(-1)]), /duplicate/);
});
test("risk sizing limits account notional and stop risk", () => {
  const s = snapshotAt(market, at);
  for (const action of ["BTC_1X", "BTC_2X", "ETH_1X", "ETH_2X"]) {
    const p = position({ action }, s);
    assert.ok(p.notional <= 20000);
    assert.ok(p.collateral <= 10000);
    assert.ok(p.notional * (p.stopPct + 0.0014) <= 200.00001);
  }
});
function fixture({ gap = false, liquidation = false, funding = 0.0001 } = {}) {
  const entryAt = at + HOUR,
    bars = Array.from({ length: 25 }, (_, i) => ({
      t: entryAt + i * HOUR,
      o: 100,
      h: 101,
      l: 99.9,
      c: 100,
      v: 10,
    }));
  if (gap) Object.assign(bars[2], { o: 90, h: 91, l: 89, c: 90 });
  const marks = bars.map((b) => ({ ...b, l: liquidation ? 1 : b.l }));
  return {
    assets: {
      BTC: {
        bars,
        marks,
        funding: [{ t: entryAt + HOUR, rate: funding, mark: 100 }],
      },
    },
  };
}
const snapshot = { at, assets: { BTC: { price: 100, stopPct: 0.01 } } };
test("funding and fees reduce a flat trade", () => {
  const m = fixture(),
    t = simulate({ action: "BTC_2X" }, snapshot, m);
  assert.ok(t.pnl < 0);
  assert.ok(t.funding > 0);
  assert.equal(t.fundingPayments, 1);
  assert.equal(t.status, "expired");
  assert.ok(t.fees > 0);
});
test("entry uses the next hour and never the decision candle", () => {
  const m = fixture();
  assert.equal(simulate({ action: "BTC_1X" }, snapshot, m).entryAt, at + HOUR);
});
test("stop gap uses worse opening price", () => {
  const t = simulate({ action: "BTC_2X" }, snapshot, fixture({ gap: true }));
  assert.equal(t.status, "stopped");
  assert.ok(t.exit < 91);
  assert.ok(t.pnl < -200);
});
test("liquidation loses isolated collateral, never the whole account", () => {
  const t = simulate(
    { action: "BTC_2X" },
    snapshot,
    fixture({ liquidation: true }),
  );
  assert.equal(t.status, "liquidated");
  assert.equal(t.pnl, -t.collateral);
  assert.ok(t.equity >= 0);
});
test("negative funding is a credit and missing future candles stay unsettled", () => {
  const t = simulate(
    { action: "BTC_1X" },
    snapshot,
    fixture({ funding: -0.001 }),
  );
  assert.ok(t.funding < 0);
  assert.equal(
    simulate({ action: "BTC_1X" }, snapshot, {
      assets: { BTC: { bars: [], funding: [] } },
    }),
    null,
  );
});
test("cash holds equity unchanged", () =>
  assert.equal(
    simulate({ action: "CASH" }, snapshot, {}).equity,
    RULES.capital,
  ));
test("all models have a finite reservation exceeding estimated bounded usage", () => {
  const s = snapshotAt(market, at);
  for (const m of MODELS) {
    assert.ok(
      reservation(m, s) >
        actualCost(m, { input_tokens: 2000, output_tokens: m.maxOutput }),
    );
    assert.equal(requestBody(m, s).model, m.provider);
  }
  assert.throws(() => actualCost(MODELS[0], {}));
});
test("invalid, refused and incomplete model responses are not trading decisions", () => {
  assert.throws(() => parseDecision(MODELS[0], { status: "incomplete" }));
  assert.throws(() =>
    parseDecision(MODELS[1], { answers: [{ type: "refusal" }] }),
  );
  assert.equal(
    parseDecision(MODELS[1], { answers: [{ choice: "CASH" }] }).action,
    "CASH",
  );
});
test("budget reservation is atomic, unique and refuses an overdraft", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const reserve = (id, amount) => {
    db.exec("BEGIN IMMEDIATE");
    db.prepare(
      "UPDATE budget SET committed=committed+? WHERE id=1 AND committed+?<=cap AND NOT EXISTS(SELECT 1 FROM runs WHERE id=?)",
    ).run(amount, amount, id);
    db.prepare(
      "INSERT INTO runs(id,cohort,model,snapshot_at,status,snapshot,reservation) SELECT ?,'test','luna',0,'reserved','{}',? WHERE changes()=1",
    ).run(id, amount);
    db.exec("COMMIT");
  };
  reserve("a", 14);
  reserve("a", 14);
  reserve("b", 2);
  assert.equal(db.prepare("SELECT committed FROM budget").get().committed, 14);
  assert.equal(db.prepare("SELECT count(*) n FROM runs").get().n, 1);
});
test("historical benchmark is deterministic, includes hold references and cost stress", () => {
  const a = replay(market, 90),
    b = replay(market, 90);
  assert.deepEqual(a, b);
  assert.ok(a.days >= 85 && a.days <= 90);
  assert.ok(a.results.some((r) => r.name === "BTC hold"));
  assert.ok(a.results[0].stressReturnPct < a.results[0].returnPct);
  assert.ok(a.to <= market.to);
});
