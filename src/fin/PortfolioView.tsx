import React, { useRef, useState } from "react";
import { Check } from "lucide-react";
import { Sparkline } from "./Sparkline";
import { PortfolioChart } from "./PortfolioChart";
import { euro, number, signedEuro } from "./format";
export type PortfolioEntry = {
  id: string;
  name: string;
  subtitle: string;
  initial: number;
  capital: number | null;
  pnl: number | null;
  startedAt: number | null;
  asOf: number | null;
  curve: { t: number; equity: number }[];
  valuationStatus: string;
  warning?: string;
  action?: React.ReactNode;
  details: React.ReactNode;
};
const gainClass = (n: number | null) =>
  n === null || n === 0 ? "" : n < 0 ? "negative" : "positive";
export function PortfolioView({
  entries,
  groupLabel = "Comparer les portefeuilles",
}: {
  entries: PortfolioEntry[];
  groupLabel?: string;
}) {
  const [selectedId, setSelectedId] = useState(entries[0]?.id);
  const [period, setPeriod] = useState(0),
    [compare, setCompare] = useState(false);
  const detail = useRef<HTMLElement>(null);
  const selected = entries.find((p) => p.id === selectedId) ?? entries[0];
  if (!selected)
    return (
      <p className="empty-state">
        Aucun portefeuille disponible. Actualiser les données.
      </p>
    );
  const shown = compare ? entries : [selected];
  const until = Math.max(...shown.map((p) => p.asOf ?? p.curve.at(-1)?.t ?? 0));
  const cutoff = until - period * 86400000;
  const plotted = shown.map((p) => ({
    id: p.id,
    name: p.name,
    totalPnl: p.pnl,
    valuationStatus: p.valuationStatus,
    curve: period
      ? p.curve.filter((point) => point.t >= cutoff && point.t <= until)
      : p.curve,
  }));
  return (
    <div className="stock-comparison">
      <div className="stock-layout">
        <section className="stock-watchlist" aria-label="Portefeuilles">
          <div className="model-watchlist" role="group" aria-label={groupLabel}>
            {entries.map((p) => (
              <button
                key={p.id}
                className="comparison-row stock-row"
                aria-pressed={selected.id === p.id}
                onClick={() => {
                  setSelectedId(p.id);
                  if (matchMedia("(max-width: 800px)").matches)
                    requestAnimationFrame(() => {
                      detail.current?.focus({ preventScroll: true });
                      detail.current?.scrollIntoView({ block: "start" });
                    });
                }}
              >
                <span className="stock-name">
                  <strong>
                    {p.name}
                    {selected.id === p.id && (
                      <Check
                        className="selection-check"
                        size={13}
                        aria-hidden="true"
                      />
                    )}
                  </strong>
                  <small>{p.subtitle}</small>
                </span>
                <Sparkline
                  values={p.curve.map((v) => v.equity)}
                  times={p.curve.map((v) => v.t)}
                  className={gainClass(p.pnl)}
                />
                <span className="stock-values">
                  <strong>
                    {p.capital === null ? "—" : euro(p.capital, 2)}
                  </strong>
                  <span className={`change-badge ${gainClass(p.pnl)}`}>
                    {p.pnl === null ? "Indisponible" : signedEuro(p.pnl, 2)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
        <section
          ref={detail}
          tabIndex={-1}
          className="stock-detail"
          aria-label={`Portefeuille ${selected.name}`}
        >
          <div className="stock-detail-heading">
            <h2>{selected.name}</h2>
            {selected.action}
          </div>
          <div className="stock-quote">
            <strong>
              {selected.capital === null ? "—" : euro(selected.capital, 2)}
            </strong>
            <p className={gainClass(selected.pnl)}>
              {selected.pnl === null
                ? "Valorisation indisponible"
                : `${signedEuro(selected.pnl, 2)} (${selected.pnl > 0 ? "+" : ""}${number((selected.pnl / selected.initial) * 100, 2)} %)`}
            </p>
          </div>
          {selected.warning && (
            <p className="notice" role="status">
              {selected.warning}
            </p>
          )}
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
            {entries.length > 1 && (
              <button
                className="compare-toggle"
                aria-pressed={compare}
                onClick={() => setCompare(!compare)}
              >
                Comparer les {entries.length}
              </button>
            )}
          </div>
          <PortfolioChart
            key={`${selected.id}:${period}:${compare}`}
            models={plotted}
          />
          <details key={selected.id} className="stock-explanation">
            <summary>Détails</summary>
            {selected.startedAt && (
              <p>
                Départ : {euro(selected.initial)} ·{" "}
                {new Intl.DateTimeFormat("fr-FR", {
                  dateStyle: "medium",
                  timeZone: "Europe/Paris",
                }).format(selected.startedAt)}
              </p>
            )}
            {selected.details}
          </details>
        </section>
      </div>
    </div>
  );
}
