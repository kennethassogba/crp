import { collect } from "../lib/market.mjs";
import { mkdir, writeFile } from "node:fs/promises";
const market = await collect(100);
await mkdir("public/data", { recursive: true });
await writeFile("public/data/market.json", JSON.stringify(market));
const evidence = {
  checkedAt: new Date().toISOString(),
  authenticated: false,
  source: market.source,
  from: market.from,
  to: market.to,
  assets: Object.fromEntries(
    Object.entries(market.assets).map(([k, s]) => [
      k,
      {
        candles: s.bars.length,
        markCandles: s.marks.length,
        spotCandles: s.spot.length,
        fundingPayments: s.funding.length,
      },
    ]),
  ),
  endpoints: [
    "https://fapi.binance.com/fapi/v1/klines",
    "https://fapi.binance.com/fapi/v1/markPriceKlines",
    "https://fapi.binance.com/fapi/v1/fundingRate",
    "https://data-api.binance.vision/api/v3/klines",
  ],
};
await writeFile(
  "docs/data-access.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(JSON.stringify(evidence));
