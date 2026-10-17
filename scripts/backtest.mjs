import { readFile, writeFile } from "node:fs/promises";
import { replay } from "../lib/strategy.mjs";
const market = JSON.parse(await readFile("public/data/market.json", "utf8"));
const result = replay(market, 90);
await writeFile("public/data/backtest.json", JSON.stringify(result));
console.log(
  JSON.stringify(
    {
      from: result.from,
      to: result.to,
      days: result.days,
      results: result.results.map(({ curve, journal, ...x }) => x),
    },
    null,
    2,
  ),
);
