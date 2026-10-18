import { HOUR, DAY, validateBars } from "./strategy.mjs";
export const SOURCE = "Binance USD-M public REST";
const FUTURES = "https://fapi.binance.com";
export async function fetchJSON(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: "application/json", "User-Agent": "CRP/1.0 (+https://crp.keff.uk)" },
  });
  if (!response.ok)
    throw new Error(`Market source returned HTTP ${response.status}`);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > 4_000_000) throw new Error("Market response exceeds size limit");
  const text = await response.text();
  if (text.length > 4_000_000)
    throw new Error("Market response exceeds size limit");
  const json = JSON.parse(text);
  if (json.code && json.code < 0)
    throw new Error("Market source rejected request");
  return json;
}
const convert = (r) => ({
  t: Number(r[0]),
  o: Number(r[1]),
  h: Number(r[2]),
  l: Number(r[3]),
  c: Number(r[4]),
  v: Number(r[5]),
});
async function candles(symbol, start, end, kind = "bars") {
  const host = kind === "spot" ? "https://data-api.binance.vision" : FUTURES;
  const path =
    kind === "spot"
      ? "/api/v3/klines"
      : kind === "marks"
        ? "/fapi/v1/markPriceKlines"
        : "/fapi/v1/klines";
  const rows = [];
  let cursor = start;
  while (cursor < end) {
    const data = await fetchJSON(
      `${host}${path}?symbol=${symbol}USDT&interval=1h&startTime=${cursor}&endTime=${end - 1}&limit=1000`,
    );
    if (!Array.isArray(data) || !data.length)
      throw new Error(`Missing ${symbol} ${kind}`);
    rows.push(
      ...data.map(convert).filter((b) => b.t >= start && b.t + HOUR <= end),
    );
    const next = Number(data.at(-1)[0]) + HOUR;
    if (next <= cursor) throw new Error("Market pagination did not advance");
    cursor = next;
  }
  return validateBars(rows);
}
export async function collect(days = 100) {
  const clock = await fetchJSON(`${FUTURES}/fapi/v1/time`);
  const end = Math.floor(clock.serverTime / HOUR) * HOUR;
  const start = end - days * DAY;
  const assets = {};
  for (const symbol of ["BTC", "ETH"]) {
    const bars = await candles(symbol, start, end);
    const marks = await candles(symbol, start, end, "marks");
    const spot = await candles(symbol, start, end, "spot");
    const raw = await fetchJSON(
      `${FUTURES}/fapi/v1/fundingRate?symbol=${symbol}USDT&startTime=${start - DAY}&endTime=${end - 1}&limit=1000`,
    );
    if (!Array.isArray(raw) || !raw.length)
      throw new Error("Funding history missing");
    const funding = raw.map((f) => ({
      t: Number(f.fundingTime),
      rate: Number(f.fundingRate),
      mark: Number(f.markPrice),
    }));
    if (
      !funding.every(
        (f) => Number.isFinite(f.t) && Number.isFinite(f.rate) && f.mark > 0,
      )
    )
      throw new Error("Invalid funding history");
    assets[symbol] = { bars, marks, spot, funding };
  }
  return {
    source: SOURCE,
    collectedAt: Date.now(),
    exchangeTime: clock.serverTime,
    from: start,
    to: end,
    assets,
  };
}
