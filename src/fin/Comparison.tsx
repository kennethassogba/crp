import React, { useId, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useChartWidth } from "./Charts";
import { euro, signedEuro, number } from "./format";
import type { Run } from "./Crp";

export type ComparisonModel = {
  id: string;
  name: string;
  provider: string;
  settledCapital: number;
  settledPnl: number;
  pendingPnl: number | null;
  estimatedCapital: number | null;
  totalPnl: number | null;
  returnPct: number | null;
  decisions: number;
  settledDecisions: number;
  trades: number;
  wins: number;
  winRate: number | null;
  fees: number;
  funding: number;
  latestRunId: string | null;
  latestAt: number | null;
  latestStatus: string;
  action: string | null;
  valuationStatus: string;
  valuationAt: number | null;
  curve: { t: number; equity: number; provisional?: boolean }[];
};
export type Comparison = {
  id: string;
  capital: number;
  currency: string;
  sourceCapital: number;
  basis: string;
  fxIncluded: boolean;
  providerCostsIncluded: boolean;
  cohort: string;
  startedAt: number | null;
  asOf: number | null;
  models: ComparisonModel[];
};
const time = (t: number) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(t);
const gainClass = (n: number | null) =>
  n === null || n === 0 ? "" : n < 0 ? "negative" : "positive";
const position = (m: ComparisonModel) =>
  m.latestStatus === "failed"
    ? "Échec"
    : m.latestStatus === "late"
      ? "Hors délai"
      : !m.action
        ? "En attente"
        : m.action === "CASH"
          ? "Espèces"
          : m.action.replace("_", " · ").replace("X", "×");
const valuation = (m: ComparisonModel) =>
  m.valuationStatus === "waiting-entry"
    ? "Entrée à venir"
    : m.valuationStatus === "unavailable"
      ? "Valorisation indisponible"
      : ["stopped", "liquidated", "expired"].includes(m.valuationStatus)
        ? "Sortie à confirmer"
        : m.action === "CASH"
          ? "Aucune position"
          : m.valuationStatus === "open"
            ? "Position ouverte"
            : "Position clôturée";

export function ComparisonView({
  data,
  runs,
  onSelect,
}: {
  data: Comparison;
  runs: Run[];
  onSelect: (r: Run) => void;
}) {
  const onlyCashClosed =
    data.models.some((m) => m.settledDecisions > 0) &&
    data.models.every((m) => m.settledPnl === 0 && m.trades === 0);
  const open = data.models.some(
    (m) => m.valuationAt !== null && m.pendingPnl !== null,
  );
  return (
    <>
      <div className="experiment-context">
        <span>
          <strong>{euro(data.capital, 0)}</strong> au départ, par modèle
        </span>
        <span>
          {data.startedAt
            ? `Depuis le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(data.startedAt)}`
            : "Expérience en attente"}
        </span>
        <span className="status-chip">Simulation</span>
      </div>
      <div
        className="comparison-table"
        role="table"
        aria-label="Comparaison des portefeuilles, base 100 euros"
      >
        <div className="comparison-labels" role="row">
          <span role="columnheader">Modèle</span>
          <span role="columnheader">Capital estimé</span>
          <span role="columnheader">Gain net</span>
          <span role="columnheader">Dernière décision</span>
        </div>
        {data.models.map((m) => {
          const run = runs.find((r) => r.id === m.latestRunId);
          return (
            <div className="comparison-row" role="row" key={m.id}>
              <div role="cell" className="comparison-model">
                <span
                  className={`model-dot model-${m.id}`}
                  aria-hidden="true"
                />
                <div>
                  <strong>{m.name}</strong>
                  <small>
                    {m.decisions} décision{m.decisions > 1 ? "s" : ""} ·{" "}
                    {m.trades} position{m.trades > 1 ? "s" : ""} clôturée
                    {m.trades > 1 ? "s" : ""}
                  </small>
                </div>
              </div>
              <div role="cell" className="comparison-capital">
                <span className="mobile-label">Capital estimé</span>
                <strong>
                  {m.estimatedCapital === null
                    ? "—"
                    : euro(m.estimatedCapital, 2)}
                </strong>
                <small>{euro(m.settledCapital, 2)} clôturé</small>
              </div>
              <div role="cell" className="comparison-gain">
                <span className="mobile-label">Gain net</span>
                <strong className={gainClass(m.totalPnl)}>
                  {m.totalPnl === null ? "—" : signedEuro(m.totalPnl, 2)}
                </strong>
                <small className={gainClass(m.pendingPnl)}>
                  {m.pendingPnl === null
                    ? "Cours manquant"
                    : `${signedEuro(m.pendingPnl, 2)} en cours`}
                </small>
              </div>
              <div role="cell" className="comparison-position">
                <button
                  className="position-button"
                  aria-label={`Voir la décision de ${m.name} : ${position(m)}`}
                  disabled={!run}
                  onClick={() => run && onSelect(run)}
                >
                  <span>{position(m)}</span>
                  <ArrowUpRight size={13} />
                </button>
                <small>
                  {valuation(m)}
                  {m.latestAt
                    ? ` · ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(m.latestAt)}`
                    : ""}
                </small>
              </div>
            </div>
          );
        })}
      </div>
      <div className="comparison-footnote">
        <span>Frais de marché inclus · change exclu</span>
        <span>
          {data.asOf
            ? `Valorisé au ${time(data.asOf)}`
            : "Valorisation en attente"}
        </span>
      </div>
      {onlyCashClosed && (
        <p className="comparison-explanation">
          Le gain clôturé est à zéro : les premières décisions sont restées en
          espèces.
          {open
            ? " Les gains en cours sont inclus dans le capital estimé."
            : ""}
        </p>
      )}
      <div className="section-heading">
        <h2>Évolution des 100 €</h2>
        <span>Clôtures et estimation en cours</span>
      </div>
      <ComparisonChart models={data.models} />
    </>
  );
}

function ComparisonChart({ models }: { models: ComparisonModel[] }) {
  const { ref, width } = useChartWidth(
    models.reduce((n, m) => n + m.curve.length, 0),
  );
  const [active, setActive] = useState<number | null>(null),
    id = useId();
  const dates = [
    ...new Set(models.flatMap((m) => m.curve.map((p) => p.t))),
  ].sort((a, b) => a - b);
  if (dates.length < 2)
    return (
      <p className="empty-state">
        La courbe apparaîtra après la première clôture. Chaque modèle démarre à
        100 €.
      </p>
    );
  const values = models.flatMap((m) => m.curve.map((p) => p.equity));
  const lo = Math.min(...values),
    hi = Math.max(...values),
    range = Math.max(hi - lo, 0.2);
  const low = lo - range * 0.2,
    high = hi + range * 0.2,
    span = width - 78;
  const x = (t: number) =>
    12 + ((t - dates[0]) / (dates.at(-1)! - dates[0])) * span;
  const y = (v: number) => 186 - ((v - low) / (high - low)) * 154;
  const index = Math.min(active ?? dates.length - 1, dates.length - 1);
  const current = dates[index];
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const target =
      dates[0] +
      ((((e.clientX - box.left) / box.width) * width - 12) / span) *
        (dates.at(-1)! - dates[0]);
    setActive(
      dates.reduce(
        (best, t, i) =>
          Math.abs(t - target) < Math.abs(dates[best] - target) ? i : best,
        0,
      ),
    );
  };
  const coincident =
    models.length > 1 &&
    models.every(
      (m) =>
        JSON.stringify(m.curve.map((p) => [p.t, p.equity])) ===
        JSON.stringify(models[0].curve.map((p) => [p.t, p.equity])),
    );
  return (
    <div
      ref={ref}
      className="interactive-chart comparison-chart"
      role="group"
      tabIndex={0}
      aria-label="Capital des trois modèles. Flèches pour parcourir les dates."
      aria-describedby={id}
      onKeyDown={(e) => {
        if (!["Home", "End", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
        e.preventDefault();
        setActive(
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? dates.length - 1
              : Math.max(
                  0,
                  Math.min(
                    dates.length - 1,
                    index + (e.key === "ArrowRight" ? 1 : -1),
                  ),
                ),
        );
      }}
    >
      <div className="comparison-readout" id={id} role="status">
        <span>{time(current)}</span>
        {models.map((m) => {
          const point =
            current > (m.curve.at(-1)?.t ?? 0) &&
            m.valuationStatus === "unavailable"
              ? null
              : m.curve.filter((p) => p.t <= current).at(-1);
          return (
            <span key={m.id}>
              <i className={`model-dot model-${m.id}`} aria-hidden="true" />
              {m.name} <strong>{point ? euro(point.equity, 2) : "—"}</strong>
            </span>
          );
        })}
      </div>
      <svg
        viewBox={`0 0 ${width} 223`}
        role="img"
        aria-label="Évolution du capital, chaque modèle part de 100 euros"
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setActive(null);
        }}
      >
        {[0, 0.5, 1].map((q) => (
          <g key={q}>
            <line
              x1={12}
              x2={width - 66}
              y1={186 - q * 154}
              y2={186 - q * 154}
              className="gridline"
            />
            <text x={width - 58} y={190 - q * 154}>
              {number(low + q * (high - low), 2)}
            </text>
          </g>
        ))}
        {models.map((m, i) => (
          <path
            key={m.id}
            d={m.curve
              .map((p, j) => `${j ? "L" : "M"}${x(p.t)},${y(p.equity)}`)
              .join(" ")}
            className={`comparison-path model-${m.id}`}
            strokeDasharray={i === 1 ? "6 4" : i === 2 ? "2 4" : undefined}
          >
            <title>{m.name}</title>
          </path>
        ))}
        <line
          x1={x(current)}
          x2={x(current)}
          y1={28}
          y2={186}
          className="crosshair"
        />
        {[0, 1].map((q) => (
          <text
            key={q}
            x={q ? width - 66 : 12}
            y={216}
            textAnchor={q ? "end" : "start"}
          >
            {time(q ? dates.at(-1)! : dates[0])}
          </text>
        ))}
      </svg>
      <span className="chart-instruction">
        {coincident ? "Les trois courbes se superposent. " : ""}Survoler,
        toucher ou utiliser les flèches.
      </span>
    </div>
  );
}
