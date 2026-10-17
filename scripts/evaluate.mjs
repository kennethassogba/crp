import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  snapshotAt,
  simulate,
  summarize,
  HOUR,
  DAY,
  RULES,
} from "../lib/strategy.mjs";
import { MODELS, callModel, reservation } from "../lib/models.mjs";
const vars = await readFile(".dev.vars", "utf8");
const key = vars
  .split("\n")
  .find((l) => l.startsWith("OPENAI_API_KEY="))
  ?.slice("OPENAI_API_KEY=".length)
  .trim()
  .replace(/^["']|["']$/g, "");
if (!key) throw Error("Set OPENAI_API_KEY in .dev.vars.");
const market = JSON.parse(await readFile("public/data/market.json", "utf8"));
await mkdir("data/private", { recursive: true });
let store;
try {
  store = JSON.parse(await readFile("data/private/evaluation.json", "utf8"));
} catch {
  store = { runs: [], budget: { actual: 0, committed: 0, cap: 15 } };
}
async function save() {
  await writeFile("data/private/evaluation.json", JSON.stringify(store), {
    mode: 0o600,
  });
  await writeFile("public/data/models.json", JSON.stringify(store));
}
async function run(at, cohort) {
  const snapshot = snapshotAt(market, at);
  for (const model of MODELS) {
    const id = `${cohort}:${at}:${model.id}`;
    if (store.runs.some((r) => r.id === id)) continue;
    const hold = reservation(model, snapshot);
    if (store.budget.committed + hold > store.budget.cap) {
      console.log("Budget limit reached");
      return;
    }
    const r = {
      id,
      cohort,
      model: model.id,
      snapshot_at: at,
      status: "reserved",
      snapshot,
      reservation: hold,
    };
    store.budget.committed += hold;
    store.runs.push(r);
    await save();
    try {
      const result = await callModel(model, snapshot, key);
      const published = Date.now();
      Object.assign(r, {
        decision: result.decision,
        usage: result.usage,
        cost: result.cost,
        latency_ms: result.latencyMs,
        published_at: published,
        entry_after: at + HOUR,
        status:
          cohort === "live" && published >= at + HOUR ? "late" : "completed",
      });
      if (result.cost > hold) throw Error("Cost exceeds reservation");
      store.budget.committed += result.cost - hold;
      store.budget.actual += result.cost;
      console.log(
        JSON.stringify({
          cohort,
          model: model.name,
          status: r.status,
          cost: result.cost,
          latencyMs: result.latencyMs,
        }),
      );
    } catch (e) {
      Object.assign(r, {
        status: "failed",
        error: e.message,
        published_at: Date.now(),
        cost: 0,
      });
      console.log(
        JSON.stringify({
          cohort,
          model: model.name,
          status: "failed",
          error: e.message,
        }),
      );
    }
    await save();
  }
}
// Start with a prospective observation while its next-hour entry is still in the future.
if (Date.now() < market.to + 50 * 60_000) await run(market.to, "live");
const ats = market.assets.BTC.bars
  .map((b) => b.t)
  .filter((t) => t % DAY === 8 * HOUR && t + 25 * HOUR <= market.to - HOUR)
  .slice(-14);
for (const at of ats) await run(at, "replay");
for (const model of MODELS) {
  let equity = RULES.capital;
  for (const r of store.runs
    .filter((r) => r.model === model.id && r.cohort === "replay")
    .sort((a, b) => a.snapshot_at - b.snapshot_at)) {
    if (r.status !== "completed") continue;
    const t = simulate(r.decision, r.snapshot, market, equity, r.entry_after);
    if (t) {
      r.result = t;
      equity = t.equity;
    }
  }
}
await save();
console.log(
  JSON.stringify(
    {
      budget: store.budget,
      runs: store.runs.length,
      completed: store.runs.filter((r) => r.status === "completed").length,
      summaries: MODELS.map((m) =>
        summarize(
          store.runs
            .filter(
              (r) => r.model === m.id && r.cohort === "replay" && r.result,
            )
            .map((r) => r.result),
          m.name,
        ),
      ),
    },
    null,
    2,
  ),
);
