import { fetchJSON } from "./market.mjs";
import { HOUR, DAY, validateBars } from "./strategy.mjs";

export const KRAKEN_SOURCE = "Kraken Futures public REST";
const ROOT = "https://futures.kraken.com";
const SYMBOLS = { BTC: "PF_XBTUSD", ETH: "PF_ETHUSD" };
async function candles(symbol, kind, from, to) {
  const result = await fetchJSON(`${ROOT}/api/charts/v1/${kind}/${symbol}/1h?from=${from / 1000}&to=${to / 1000}&count=5000`);
  if (result.more_candles) throw new Error("Kraken candle range is incomplete");
  return validateBars((result.candles ?? []).filter(b => b.time >= from && b.time + HOUR <= to).map(b => ({
    t: Number(b.time), o: Number(b.open), h: Number(b.high), l: Number(b.low), c: Number(b.close), v: Number(b.volume),
  })));
}
export async function collectKraken(days = 10) {
  if (days < 8 || days > 100) throw new Error("Kraken range must be 8 to 100 days");
  const clock = await fetchJSON(`${ROOT}/derivatives/api/v3/tickers`);
  const exchangeTime = Date.parse(clock.serverTime);
  if (!Number.isFinite(exchangeTime) || Math.abs(Date.now() - exchangeTime) > 5 * 60_000)
    throw new Error("Kraken exchange clock is stale");
  const to = Math.floor(exchangeTime / HOUR) * HOUR, from = to - days * DAY;
  const assets = {};
  for (const [asset, symbol] of Object.entries(SYMBOLS)) {
    const bars = await candles(symbol, "trade", from, to);
    const marks = await candles(symbol, "mark", from, to);
    const spot = await candles(symbol, "spot", from, to);
    for (const series of [bars, marks, spot]) {
      if (series[0].t !== from || series.at(-1).t + HOUR !== to)
        throw new Error(`Incomplete ${asset} Kraken history`);
    }
    const raw = await fetchJSON(`${ROOT}/derivatives/api/v3/historical-funding-rates?symbol=${symbol}`);
    if (raw.result !== "success" || !Array.isArray(raw.rates)) throw new Error("Kraken funding unavailable");
    const funding = raw.rates.map(f => ({ t: Date.parse(f.timestamp), rate: Number(f.relativeFundingRate), absolutePerUnit: Number(f.fundingRate) }))
      .filter(f => f.t >= from - DAY && f.t < to);
    if (!funding.length || !funding.every(f => [f.t, f.rate, f.absolutePerUnit].every(Number.isFinite)))
      throw new Error("Invalid Kraken funding history");
    assets[asset] = { bars, marks, spot, funding, fundingPeriodHours: 1, instrument: symbol };
  }
  return { source: KRAKEN_SOURCE, quote: "USD", collectedAt: Date.now(), exchangeTime, from, to, assets };
}
