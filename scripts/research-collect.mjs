import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { parseCSV } from "../lib/warrants.mjs";

const args = process.argv.slice(2);
const arg = (key, fallback) =>
  args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const input = resolve(arg("--input", "public/research/snapshot.json"));
const output = resolve(arg("--output", "public/research/snapshot.json"));
const data = JSON.parse(await readFile(input, "utf8"));
const failures = [];
for (const [id, old] of Object.entries(data.assets)) {
  try {
    if (!/^[A-Za-z0-9^=.\-]{1,25}$/.test(old.symbol))
      throw Error("Unsupported source symbol");
    const url = new URL(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(old.symbol)}`,
    );
    url.search = new URLSearchParams({ range: "5y", interval: "1d" });
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "fin-research/1.0 personal-research" },
    });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const source = (await response.json()).chart?.result?.[0];
    if (!source?.timestamp || !source.indicators?.quote?.[0]?.close)
      throw Error("Invalid chart response");
    const session = source.meta?.currentTradingPeriod?.regular;
    const pairs = source.timestamp
      .map((t, i) => [t, source.indicators.quote[0].close[i]])
      .filter(
        ([t, c]) =>
          Number.isFinite(c) &&
          c > 0 &&
          (!session || Date.now() / 1000 >= session.end || t < session.start),
      );
    if (pairs.length < 252) throw Error("Insufficient complete daily prices");
    data.assets[id] = {
      ...old,
      dates: pairs.map(([t]) => new Date(t * 1000).toISOString().slice(0, 10)),
      closes: pairs.map(([, c]) => c),
      sourceUrl: url.href,
      collectedAt: new Date().toISOString(),
    };
    console.log(
      `${id}: ${pairs.length} complete closes, through ${data.assets[id].dates.at(-1)}`,
    );
  } catch (error) {
    failures.push(id);
    console.error(`${id}: ${error.message}; previous history retained`);
  }
}
if (args.includes("--quotes")) {
  const rows = parseCSV(await readFile(resolve(arg("--quotes")), "utf8"));
  data.products = rows;
  data.quoteDate = rows
    .map((p) => p.quoteAt.slice(0, 10))
    .sort()
    .at(-1);
}
// Updating historical data must NEVER turn frozen quotes into live quotes.
data.analysisDate = arg("--as-of", new Date().toISOString().slice(0, 10));
data.collectedAt = new Date().toISOString();
data.collection = {
  failedAssets: failures,
  quoteRefresh: args.includes("--quotes") ? "explicit CSV import" : "unchanged",
  historySource: "Yahoo Finance chart API",
};
await writeFile(`${output}.tmp`, JSON.stringify(data));
await rename(`${output}.tmp`, output);
if (failures.length) process.exitCode = 1;
