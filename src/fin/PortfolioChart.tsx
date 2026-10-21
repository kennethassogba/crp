import React, { useId, useState } from "react";
import { useChartWidth } from "./Charts";
import { euro, number } from "./format";
export type ChartSeries = {
  id: string;
  name: string;
  curve: { t: number; equity: number }[];
  totalPnl: number | null;
  valuationStatus: string;
};
const gainClass = (n: number | null) =>
  n === null || n === 0 ? "" : n < 0 ? "negative" : "positive";
const time = (t: number) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(t);
export function PortfolioChart({ models }: { models: ChartSeries[] }) {
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
      <p className="chart-empty">Pas encore de courbe pour cette période.</p>
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
        aria-label="Évolution du capital simulé, départ à 1 000 euros"
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
            {new Intl.DateTimeFormat("fr-FR", {
              day: "numeric",
              month: "short",
              timeZone: "Europe/Paris",
            }).format(q ? dates.at(-1)! : dates[0])}
          </text>
        ))}
      </svg>
      <span className="visually-hidden">
        {coincident ? "Les courbes se superposent. " : ""}Survoler, toucher ou
        utiliser les flèches.
      </span>
    </div>
  );
}
