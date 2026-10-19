import { readFile, mkdir, writeFile } from "node:fs/promises";
import { analyze } from "../lib/warrants.mjs";
const data = JSON.parse(
  await readFile("public/research/snapshot.json", "utf8"),
);
const count = Number(process.argv[2] ?? 10000);
if (!Number.isInteger(count) || count < 1 || count > 100000)
  throw Error("Count must be 1–100000");
const cache = new Map(),
  start = performance.now();
for (let i = 0; i < count; i++) {
  const p = data.products[i % data.products.length];
  const r = analyze(p, data.assets[p.underlying], {
    asOf: data.analysisDate,
    cache,
  });
  if (r.error || !Number.isFinite(r.long?.expected))
    throw Error("Invalid benchmark evaluation");
}
const result = {
  at: new Date().toISOString(),
  node: process.version,
  count,
  elapsedMs: performance.now() - start,
  peakRssMiB: process.resourceUsage().maxRSS / 1024,
  scenarioGroups: cache.size,
  scope:
    "Repeated evaluations of the six reference contracts, five models per evaluation, shared scenarios; excludes bootstrap, network, browser rendering and a genuinely distinct 10000-contract universe.",
};
await mkdir("output", { recursive: true });
await writeFile(
  "output/research-benchmark.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
