import { readFile, writeFile, mkdir } from "node:fs/promises";
const schema = await readFile("schema.sql", "utf8");
const evaluation = JSON.parse(
  await readFile("public/data/models.json", "utf8"),
);
const full = JSON.parse(await readFile("public/data/market.json", "utf8"));
const market = {
  ...full,
  from: full.to - 10 * 24 * 3600000,
  assets: Object.fromEntries(
    Object.entries(full.assets).map(([k, s]) => [
      k,
      {
        bars: s.bars.slice(-240),
        marks: s.marks.slice(-240),
        spot: s.spot.slice(-240),
        funding: s.funding.filter((f) => f.t >= full.to - 11 * 24 * 3600000),
      },
    ]),
  ),
};
const batch = schema
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((sql) => ({ sql }));
const columns = [
  "id",
  "cohort",
  "model",
  "snapshot_at",
  "published_at",
  "entry_after",
  "status",
  "snapshot",
  "decision",
  "usage",
  "result",
  "cost",
  "reservation",
  "latency_ms",
  "error",
];
for (const r of evaluation.runs)
  batch.push({
    sql: `INSERT OR IGNORE INTO runs (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
    params: columns.map((k) =>
      ["snapshot", "decision", "usage", "result"].includes(k)
        ? r[k]
          ? JSON.stringify(r[k])
          : null
        : (r[k] ?? null),
    ),
  });
batch.push({
  sql: "UPDATE budget SET actual=?,committed=? WHERE id=1 AND NOT EXISTS(SELECT 1 FROM state WHERE key='initial-seed')",
  params: [evaluation.budget.actual, evaluation.budget.committed],
});
for (const [key, value] of [
  ["market", market],
  ["initial-seed", { at: Date.now(), runs: evaluation.runs.length }],
])
  batch.push({
    sql: "INSERT OR IGNORE INTO state(key,value,updated_at) VALUES (?,?,?)",
    params: [key, JSON.stringify(value), Date.now()],
  });
await mkdir("data/private", { recursive: true });
await writeFile("data/private/seed.json", JSON.stringify(batch));
const q = (v) =>
  v === null
    ? "NULL"
    : typeof v === "number"
      ? String(v)
      : `'${String(v).replaceAll("'", "''")}'`;
await writeFile(
  "data/private/seed.sql",
  batch
    .map((s) => {
      let i = 0;
      return s.sql.replaceAll("?", () => q(s.params[i++])) + ";";
    })
    .join("\n"),
);
console.log(
  JSON.stringify({
    statements: batch.length,
    runs: evaluation.runs.length,
    actual: evaluation.budget.actual,
    committed: evaluation.budget.committed,
  }),
);
