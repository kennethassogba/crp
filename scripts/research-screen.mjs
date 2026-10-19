import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  analyze,
  bootstrap,
  grossReturns,
  ENGINE_VERSION,
} from "../lib/warrants.mjs";

const args = process.argv.slice(2);
const arg = (key, fallback) =>
  args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const data = JSON.parse(
  await readFile(
    resolve(arg("--input", "public/research/snapshot.json")),
    "utf8",
  ),
);
const options = {
  budget: Number(arg("--budget", 3000)),
  fx: Number(arg("--fx", data.fx)),
  multiple: Number(arg("--multiple", 5)),
  asOf: arg("--as-of", data.analysisDate),
  neutral: !args.includes("--keep-drift"),
};
const results = [];
const cache = new Map();
for (const product of data.products) {
  const history = data.assets[product.underlying];
  const result = analyze(product, history, { ...options, cache });
  let interval = null;
  if (
    !result.error &&
    result.long?.expected > 0 &&
    args.includes("--bootstrap")
  ) {
    interval = bootstrap(
      product,
      result.spot,
      grossReturns(history.closes, result.horizon, 1254, false),
      options.budget,
      options.fx,
      {
        repetitions: Number(arg("--repetitions", 2000)),
        block: result.horizon,
        neutral: options.neutral,
      },
    );
  }
  if (result.long) delete result.long.net;
  if (result.short) delete result.short.net;
  results.push({ product, result, interval });
}
results.sort(
  (a, b) =>
    (b.result.pessimistic ?? -Infinity) - (a.result.pessimistic ?? -Infinity),
);
const report = {
  engine: ENGINE_VERSION,
  createdAt: new Date().toISOString(),
  options,
  universeSize: data.products.length,
  selection:
    "Exploratory; multiple-comparison selection is not corrected. No predictive edge validated.",
  results,
};
const output = resolve(arg("--output", "output/research-screen.json"));
const { mkdir } = await import("node:fs/promises");
await mkdir(resolve(output, ".."), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2));
console.table(
  results.map(({ product: p, result: r }) => ({
    code: p.id,
    underlying: p.underlying,
    ask: p.ask,
    expiry: p.expiry,
    expected: Math.round(r.long?.expected ?? 0),
    worstModel: Math.round(r.pessimistic ?? 0),
    p5: r.long?.multiple?.toFixed(3) ?? "n/a",
    status: r.error ?? r.status,
  })),
);
console.log(`Saved ${results.length} analyses to ${output}`);
