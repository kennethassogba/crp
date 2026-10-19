import React, { useId, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useChartWidth } from "./Charts";
import { Sparkline } from "./Sparkline";
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
  m.latestStatus === "missing"
    ? "Pas encore de décision"
    : m.latestStatus === "failed"
      ? "Décision non exécutée"
      : m.latestStatus === "late"
        ? "Décision exclue"
        : m.latestStatus === "reserved"
          ? "Calcul en cours"
          : m.valuationStatus === "waiting-entry"
            ? "Entrée à venir"
            : m.valuationStatus === "unavailable"
              ? "Valorisation indisponible"
              : ["stopped", "liquidated", "expired"].includes(m.valuationStatus)
                ? "Sortie à confirmer"
                : m.action === "CASH"
                  ? "Décision en espèces"
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
  const [selectedId, setSelectedId] = useState(data.models[0]?.id ?? "luna");
  const [period, setPeriod] = useState(0);
  const [compare, setCompare] = useState(false);
  const selected =
    data.models.find((m) => m.id === selectedId) ?? data.models[0];
  if (!selected)
    return (
      <p className="chart-empty">
        Aucun modèle disponible. Actualiser les données.
      </p>
    );
  const run = runs.find((r) => r.id === selected.latestRunId);
  const plotted = (compare ? data.models : [selected]).map((m) => {
    const all = m.curve;
    if (!period || !data.asOf || all.length < 2) return m;
    const cutoff = data.asOf - period * 86400000;
    const before = all.filter((p) => p.t <= cutoff).at(-1);
    const first = before ? all.indexOf(before) : 0;
    return { ...m, curve: all.slice(first) };
  });
  const startLabel = data.startedAt
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        timeZone: "Europe/Paris",
      }).format(data.startedAt)
    : "En attente";
  return (
    <div className="stock-comparison">
      <div className="stock-layout">
        <section
          className="stock-watchlist"
          aria-label="Portefeuilles des modèles"
        >
          <div className="watchlist-heading">
            <h2>Modèles</h2>
            <span>Base {euro(data.capital, 0)}</span>
          </div>
          <div
            className="model-watchlist"
            role="group"
            aria-label="Comparer les modèles"
          >
            {data.models.map((m) => (
              <button
                key={m.id}
                className="comparison-row stock-row"
                aria-pressed={selected.id === m.id}
                onClick={() => setSelectedId(m.id)}
              >
                <span className="stock-name">
                  <strong>{m.name}</strong>
                  <small>{position(m)}</small>
                </span>
                <Sparkline
                  values={m.curve.map((p) => p.equity)}
                  times={m.curve.map((p) => p.t)}
                  className={gainClass(m.totalPnl)}
                />
                <span className="stock-values">
                  <strong>
                    {m.estimatedCapital === null
                      ? "—"
                      : euro(m.estimatedCapital, 2)}
                  </strong>
                  <span className={`change-badge ${gainClass(m.totalPnl)}`}>
                    {m.totalPnl === null
                      ? "Indisponible"
                      : signedEuro(m.totalPnl, 2)}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className="watchlist-caption">
            {data.startedAt ? `Gain net depuis le ${startLabel}. Frais de marché inclus.` : "Chaque modèle commence avec 100 €. Première décision en attente."}
          </p>
          <a className="watchlist-method" href="/crp/methode/">
            Comprendre la simulation <ArrowUpRight size={13} />
          </a>
        </section>
        <section
          className="stock-detail"
          aria-label={`Portefeuille ${selected.name}`}
        >
          <div className="stock-detail-heading">
            <div>
              <h2>{selected.name}</h2>
              <p>Portefeuille simulé · départ à {euro(data.capital, 0)}</p>
            </div>
            <button
              className="button secondary position-button"
              disabled={!run}
              onClick={() => run && onSelect(run)}
            >
              Voir la décision
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="stock-quote">
            <strong>
              {selected.estimatedCapital === null
                ? "—"
                : euro(selected.estimatedCapital, 2)}
            </strong>
            <p className={gainClass(selected.totalPnl)}>
              {selected.totalPnl === null
                ? "Valorisation indisponible"
                : `${signedEuro(selected.totalPnl, 2)} (${selected.returnPct! > 0 ? "+" : ""}${number(selected.returnPct ?? 0, 2)} %)`}
              {selected.totalPnl !== null && <span> depuis le début</span>}
            </p>
            <small>
              {data.asOf
                ? `Estimation au ${time(data.asOf)}`
                : "Estimation en attente"}
            </small>
          </div>
          <div className="stock-chart-toolbar">
            <div
              className="segmented stock-periods"
              aria-label="Période du capital"
            >
              {[
                [1, "1 J"],
                [7, "1 S"],
                [30, "1 M"],
                [0, "Tout"],
              ].map(([n, label]) => (
                <button
                  key={n}
                  aria-pressed={period === n}
                  onClick={() => setPeriod(Number(n))}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              className="compare-toggle"
              aria-pressed={compare}
              onClick={() => setCompare(!compare)}
            >
              Comparer les 3
            </button>
          </div>
          <ComparisonChart
            key={`${selected.id}:${compare}:${period}`}
            models={plotted}
          />
          <dl className="stock-stats">
            <div>
              <dt>Capital clôturé</dt>
              <dd>{euro(selected.settledCapital, 2)}</dd>
            </div>
            <div>
              <dt>Gain en cours</dt>
              <dd className={gainClass(selected.pendingPnl)}>
                {selected.pendingPnl === null
                  ? "Indisponible"
                  : signedEuro(selected.pendingPnl, 2)}
              </dd>
            </div>
            <div>
              <dt>Dernière décision</dt>
              <dd>{position(selected)}</dd>
            </div>
            <div>
              <dt>Statut</dt>
              <dd>{valuation(selected)}</dd>
            </div>
          </dl>
          <details className="stock-explanation">
            <summary>Comment lire ces résultats ?</summary>
            <p>
              Chaque modèle démarre à 100 € de référence. Le capital estimé
              ajoute les résultats en cours au capital clôturé. Une décision en
              espèces ne rapporte rien. Le change euro/dollar et les coûts des
              modèles sont exclus.
            </p>
            <p>
              Les courbes relient les points enregistrés, sans inventer de cours
              intermédiaires. {selected.decisions} décisions sont enregistrées,
              dont {selected.trades} positions clôturées. Le résultat en cours
              peut encore changer.
            </p>
            <a href="/crp/methode/">Voir les règles et les frais</a>
          </details>
        </section>
      </div>
    </div>
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
      <p className="chart-empty">
        Pas encore assez de points pour cette période. Choisir « Tout » ou
        attendre le prochain relevé.
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
  const y = (v: number) => 242 - ((v - low) / (high - low)) * 206;
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
      className={`interactive-chart comparison-chart ${models.length === 1 ? `single-model ${gainClass(models[0].totalPnl)}` : ""}`}
      role="group"
      tabIndex={0}
      aria-label="Évolution du capital. Flèches pour parcourir les dates."
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
        viewBox={`0 0 ${width} 280`}
        role="img"
        aria-label="Évolution du capital simulé, départ à 100 euros"
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
              y1={242 - q * 206}
              y2={242 - q * 206}
              className="gridline"
            />
            <text x={width - 58} y={246 - q * 206}>
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
            strokeDasharray={
              models.length > 1
                ? i === 1
                  ? "6 4"
                  : i === 2
                    ? "2 4"
                    : undefined
                : undefined
            }
          >
            <title>{m.name}</title>
          </path>
        ))}
        <line
          x1={x(current)}
          x2={x(current)}
          y1={28}
          y2={242}
          className="crosshair"
        />
        {[0, 1].map((q) => (
          <text
            key={q}
            x={q ? width - 66 : 12}
            y={272}
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
