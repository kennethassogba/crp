import type { Product } from "./types";
export type Prediction = {
  expected: number;
  profit: number;
  double: number;
  p10: number;
  median: number;
  p90: number;
  samples: number;
  recentExpected: number;
  stressExpected: number;
  conservative: number;
  impliedVol: number;
  spot: number;
  historyThrough: string;
  fx: number;
  score: number;
};
export type Mark = {
  at: string;
  bid: number;
  ask: number;
  value: number;
  fee: number;
  source: string;
};
export type Tracked = {
  id: string;
  day: string;
  selectedAt: string;
  rank: number;
  product: Product;
  quantity: number;
  cost: number;
  cash: number;
  entryFee: number;
  dueDay: string;
  prediction: Prediction;
  marks: Mark[];
  exit: (Mark & { reason: "target" | "stop" | "time"; pnl: number }) | null;
  status: string;
  latest: Mark;
  value: number | null;
  pnl: number | null;
};
export type Tracker = {
  series: {
    warrant: Record<string, { at: string; value: number }[]>;
    underlying: Record<
      string,
      { dates: string[]; closes: number[]; spot: number; spotAt: string }
    >;
  };
  version: number;
  startedAt: string;
  updatedAt: string;
  asOf: string;
  rule: {
    version: string;
    capital: number;
    sessions: number;
    takeProfit: number;
    stopLoss: number;
    dailyLimit: number;
  };
  positions: Tracked[];
  batches: {
    day: string;
    at: string;
    ids: string[];
    universe: number;
    eligible: number;
  }[];
  scan?: {
    day: string;
    at: string;
    universe: number;
    eligible: number;
    selected: number;
    rejected: { isin: string; reasons: string[] }[];
  };
  health: { stale: boolean; lastScan: string };
  stats: {
    selected: number;
    open: number;
    closed: number;
    unavailable: number;
    realizedPnl: number;
    winRate: number | null;
    meanPnl: number | null;
    returnOnClosedCapital: number | null;
    meanPredicted: number | null;
    brier: number | null;
    baselineBrier: number | null;
    modelStatus: string;
    calibration: {
      low: number;
      high: number;
      count: number;
      predicted: number | null;
      observed: number | null;
    }[];
  };
};
