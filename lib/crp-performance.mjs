import { RULES, HOUR, markPosition } from "./strategy.mjs";

export const EXPERIMENT = Object.freeze({
  id: "crp-eur-100-v1",
  capital: 100,
  currency: "EUR",
  sourceCapital: RULES.capital,
  basis: "normalized-return",
  fxIncluded: false,
  providerCostsIncluded: false,
});

// All monetary execution costs in the source simulation are proportional to
// capital. Rebasing preserves its returns without rewriting the USD journal.
// EUR is a comparison unit here: EUR/USD movements are deliberately not modeled.
export function compareCrp(models, decisions, market = null, cohort = "live") {
  const active = decisions.filter(
    (r) => models.some((m) => m.id === r.model) && r.cohort === cohort,
  );
  const startedAt = active.length
    ? Math.min(...active.map((r) => r.snapshot_at))
    : null;
  const scale = EXPERIMENT.capital / EXPERIMENT.sourceCapital;
  return {
    ...EXPERIMENT,
    cohort,
    startedAt,
    asOf: market?.to ?? null,
    source: market?.source ?? null,
    models: models.map((model) => {
      const runs = active
        .filter((r) => r.model === model.id)
        .sort((a, b) => a.snapshot_at - b.snapshot_at);
      const completed = runs.filter((r) => r.status === "completed");
      const closed = completed.filter(
        (r) => r.result && Number.isFinite(r.result.equity),
      );
      const sourceEquity = closed.at(-1)?.result.equity ?? RULES.capital;
      const settledCapital = sourceEquity * scale;
      const trades = closed.filter((r) => r.result.action !== "CASH");
      const latest = runs.at(-1) ?? null;
      const pending = completed.filter(
        (r) => !r.result && r.decision?.action !== "CASH",
      );
      let valuation = null;
      if (cohort === "live" && pending.length === 1 && market) {
        const run = pending[0];
        // Do not value overlapping positions or skip an unsettled predecessor.
        if (!closed.some((r) => r.snapshot_at > run.snapshot_at)) {
          try {
            valuation = markPosition(
              run.decision,
              run.snapshot,
              market,
              sourceEquity,
              run.entry_after ?? run.snapshot_at + HOUR,
            );
          } catch {
            /* Missing or invalid source data remains explicitly unavailable. */
          }
        }
      }
      const waitingEntry =
        pending.length === 1 &&
        market &&
        market.to <= (pending[0].entry_after ?? pending[0].snapshot_at + HOUR);
      const pendingPnl = valuation
        ? valuation.pnl * scale
        : pending.length && !waitingEntry
          ? null
          : 0;
      const estimatedCapital =
        pendingPnl === null ? null : settledCapital + pendingPnl;
      const curve =
        startedAt === null
          ? []
          : [
              { t: startedAt, equity: EXPERIMENT.capital },
              ...closed.map((r) => ({
                t: r.result.exitAt,
                equity: r.result.equity * scale,
              })),
            ];
      if (
        !pending.length &&
        market &&
        cohort === "live" &&
        curve.length &&
        market.to > curve.at(-1).t
      )
        curve.push({ t: market.to, equity: settledCapital });
      if (valuation)
        curve.push({
          t: valuation.exitAt,
          equity: estimatedCapital,
          provisional: true,
        });
      return {
        id: model.id,
        name: model.name,
        provider: model.provider,
        settledCapital,
        settledPnl: settledCapital - EXPERIMENT.capital,
        pendingPnl,
        estimatedCapital,
        totalPnl:
          estimatedCapital === null
            ? null
            : estimatedCapital - EXPERIMENT.capital,
        returnPct:
          estimatedCapital === null
            ? null
            : (estimatedCapital / EXPERIMENT.capital - 1) * 100,
        decisions: completed.length,
        settledDecisions: closed.length,
        trades: trades.length,
        wins: trades.filter((r) => r.result.pnl > 0).length,
        winRate: trades.length
          ? trades.filter((r) => r.result.pnl > 0).length / trades.length
          : null,
        fees: closed.reduce((sum, r) => sum + (r.result.fees ?? 0), 0) * scale,
        funding:
          closed.reduce((sum, r) => sum + (r.result.funding ?? 0), 0) * scale,
        latestRunId: latest?.id ?? null,
        latestAt: latest?.snapshot_at ?? null,
        latestStatus: latest?.status ?? "missing",
        action:
          latest?.status === "completed"
            ? (latest.decision?.action ?? null)
            : null,
        valuationStatus:
          valuation?.status ??
          (pending.length
            ? waitingEntry
              ? "waiting-entry"
              : "unavailable"
            : "cash"),
        valuationAt: valuation?.exitAt ?? null,
        curve,
      };
    }),
  };
}
