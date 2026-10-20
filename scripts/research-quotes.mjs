import { recordWarrantQuotes } from "../lib/warrant-experiment.mjs";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  BOURSO,
  SEARCH,
  UNIVERSE,
  parseSearch,
  parseProduct,
} from "../lib/warrant-feed.mjs";
const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const path = option("--input", "public/research/snapshot.json");
const output = option("--output", path);
const data = JSON.parse(await readFile(path, "utf8"));
const at = new Date().toISOString(),
  failed = [],
  candidates = [],
  evidence = [];
await mkdir("output/research-sources", { recursive: true });
async function source(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "fin.keff.uk personal research; daily public price observation",
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  const html = await r.text();
  const sha256 = createHash("sha256").update(html).digest("hex");
  evidence.push({ url, at: new Date().toISOString(), sha256 });
  await writeFile(`output/research-sources/${sha256}.html`, html);
  return html;
}
for (const [id, name] of Object.entries(UNIVERSE)) {
  try {
    const found = [];
    for (let page = 1; page <= 2; page++) {
      const url = new URL(SEARCH, BOURSO);
      url.search = new URLSearchParams({
        "warrant_filter[underlyingName][]": name,
        "warrant_filter[issuer]": "soge",
        page: String(page),
      });
      found.push(...parseSearch(await source(url), id));
    }
    // Bounded discovery, diversified by direction. This is not a full-market scan.
    for (const direction of ["call", "put"])
      candidates.push(
        ...found
          .filter((p) => p.direction === direction)
          .sort((a, b) => (a.ask - a.bid) / a.ask - (b.ask - b.bid) / b.ask)
          .slice(0, 3),
      );
    console.log(`${id}: ${found.length} eligible rows observed`);
  } catch (e) {
    failed.push({ scope: `discovery:${id}`, error: e.message });
  }
}
const known = new Map(data.products.map((p) => [p.isin, p]));
const work = new Map(
  data.products
    .filter((p) => Date.parse(p.expiry) > Date.now())
    .map((p) => [p.isin, p]),
);
for (const p of candidates)
  if (!work.has(p.isin) && work.size < 100) work.set(p.isin, p);
const products = [],
  refreshed = [],
  added = [];
for (const [isin, p] of work) {
  try {
    const next = parseProduct(await source(p.brokerUrl), p);
    products.push(next);
    refreshed.push(isin);
    if (!known.has(isin)) added.push(isin);
    console.log(`${next.id}: ${next.bid}/${next.ask} EUR`);
  } catch (e) {
    failed.push({ scope: isin, error: e.message });
    if (known.has(isin)) products.push(known.get(isin));
    console.error(`${isin}: ${e.message}; previous observation retained`);
  }
}
if (!refreshed.length)
  throw Error("No warrant refreshed; published dataset left unchanged");
data.warrantExperiment = recordWarrantQuotes(
  recordWarrantQuotes(data.warrantExperiment, data.products), products,
);
data.products = products;
data.quoteDate = at.slice(0, 10);
data.quotesCollection = {
  at,
  cadence: "Chaque jour ouvré à 22 h 30 UTC",
  source: "Pages publiques Boursorama",
  universe: Object.keys(UNIVERSE),
  pagesPerAsset: 2,
  maxContracts: 100,
  observed: refreshed.length,
  added: added.length,
  addedIsins: added,
  failures: failed,
  timestamps:
    "Heure de lecture de la page. Heure de cotation émetteur non fournie ; ce relevé ne garantit pas une exécution.",
  discovered: candidates.length,
  evidence,
};
await writeFile(`${output}.tmp`, JSON.stringify(data));
await rename(`${output}.tmp`, output);
await writeFile(
  "output/research-sources/provenance.json",
  JSON.stringify(data.quotesCollection, null, 2),
);
console.log(
  JSON.stringify({
    observed: refreshed.length,
    added: added.length,
    failures: failed.length,
  }),
);
