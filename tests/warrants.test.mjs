import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  analyze,
  empirical,
  payoff,
  position,
  grossReturns,
  gbm,
  bootstrap,
  parseCSV,
  validateProduct,
  tradingDays,
} from "../lib/warrants.mjs";
import { htmlEntry, legacyRedirect } from "../lib/site-routing.mjs";
const data = JSON.parse(
  await readFile(new URL("../public/research/snapshot.json", import.meta.url)),
);
const p = data.products.find((p) => p.id === "Z377S"),
  h = data.assets.PLTR;

test("contract settlement includes FX, ratio, fees and whole units", () => {
  assert.equal(position(p, 3000).quantity, 11538);
  assert.equal(position(p, 3000).cost, 2999.88);
  assert.equal(payoff(p, 225, 1.124), 0);
  assert.ok(Math.abs(payoff(p, 254.224, 1.124) - 1.3) < 1e-12);
  assert.ok(Math.abs(position(p, 3000).spreadCost - 115.38) < 1e-8);
  const charged = { ...p, commission: 9.95, commissionPct: 0.1 };
  const pos = position(charged, 3000);
  assert.ok(pos.cost <= 3000 && pos.cash >= 0);
  assert.ok(pos.quantity < 11538);
  const bourso = position(
    { ...p, commission: 0, commissionPct: 0.1, commissionMin: 9.95 },
    3000,
  );
  assert.ok(Math.abs(bourso.cost - bourso.quantity * p.ask - 9.95) < 1e-8);
});
test("put payoff, total-loss boundary and attainable multiples", () => {
  const put = { ...p, direction: "put", strike: 200, ratio: 0.1, ask: 2 };
  assert.equal(payoff(put, 210, 1), 0);
  assert.equal(payoff(put, 150, 1), 5);
  assert.equal(gbm(put, 200, 0.2, 30, 3000, 1, 100).multiple, 0);
});
test("reproduces independent Python study within rounding of source prices", () => {
  const r = analyze(p, h, {
    budget: 3000,
    fx: 1.124,
    multiple: 5,
    asOf: "2026-10-19",
  });
  assert.equal(r.horizon, 43);
  assert.equal(r.long.samples, 1212);
  assert.ok(Math.abs(r.long.expected - 833.6674) < 0.1);
  assert.ok(Math.abs(r.long.profit - 0.1650165) < 1e-6);
  assert.ok(Math.abs(r.long.multiple - 0.0973597) < 1e-6);
  assert.ok(Math.abs(r.long.zero - 0.80940594) < 1e-6);
  assert.ok(Math.abs(r.short.expected + 15.3238) < 0.1);
  assert.ok(r.model20.expected < -1800);
  assert.equal(r.status, "Non robuste");
  assert.ok(Math.abs(r.multipleThreshold - 254.224) < 1e-8);
});
test("bootstrap deterministic, overlapping observations not assumed independent", () => {
  const raw = grossReturns(h.closes, 43, 1254, false);
  const options = { repetitions: 200, block: 43, seed: 20261019 };
  const a = bootstrap(p, h.closes.at(-1), raw, 3000, 1.124, options);
  assert.deepEqual(a, bootstrap(p, h.closes.at(-1), raw, 3000, 1.124, options));
  assert.ok(a.lower < 0 && a.upper > 0);
});
test("invalid, expired, stale and unaffordable instruments are explicit", () => {
  assert.ok(validateProduct({ ...p, bid: 2, ask: 1 }).length);
  assert.ok(validateProduct({ ...p, style: "turbo" }).length);
  assert.ok(analyze(p, h, { asOf: "2027-01-01" }).error);
  assert.ok(analyze(p, h, { asOf: "invalid" }).error);
  assert.ok(analyze(p, h, { budget: -1 }).error);
  assert.equal(
    analyze(p, h, { budget: 10, asOf: "2026-10-19" }).status,
    "Budget insuffisant",
  );
  assert.equal(
    analyze(p, h, { asOf: "2026-11-01" }).status,
    "Historique ancien",
  );
  assert.ok(analyze(p, null).error);
});
test("CSV roundtrip accepts semicolons/decimals and rejects duplicates", () => {
  const fields =
    "id;isin;underlying;direction;strike;ratio;bid;ask;currency;expiry;quoteAt";
  const row =
    "Z377S;DE000FG35JX0;PLTR;call;225;0,05;0,25;0,26;USD;2026-12-18;2026-10-16";
  const imported = parseCSV(fields + "\n" + row);
  assert.equal(imported[0].ask, 0.26);
  assert.deepEqual(validateProduct(imported[0]), []);
  assert.throws(() => parseCSV(fields + "\n" + row + "\n" + row), /dupliqué/);
  assert.throws(() => parseCSV("isin,ask\nx,1"), /Colonnes/);
});
test("legacy hostname redirects to scoped CRP, keeping API and query paths", () => {
  assert.equal(
    legacyRedirect(new URL("https://crp.keff.uk/?view=1")),
    "https://fin.keff.uk/crp/?view=1",
  );
  assert.equal(
    legacyRedirect(new URL("https://crp.keff.uk/api/state?x=1")),
    "https://fin.keff.uk/api/state?x=1",
  );
  assert.equal(legacyRedirect(new URL("https://fin.keff.uk/")), null);
  assert.equal(htmlEntry("/crp/"), "/crp.html");
  assert.equal(htmlEntry("/warrants/methode/"), "/index.html");
  assert.equal(htmlEntry("/not-a-page"), null);
});
