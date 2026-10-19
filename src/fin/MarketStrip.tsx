import React from "react";
import { Sparkline } from "./Sparkline";
import { date, number, percent } from "./format";
import type { Dataset } from "./types";

export function MarketStrip({
  dataset,
  selected,
  onSelect,
}: {
  dataset: Dataset;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const entries = Object.entries(dataset.assets).filter(
    ([, h]) => h.closes.length >= 2,
  );
  const through = entries.map(([, h]) => h.dates.at(-1)!).sort()[0];
  if (!entries.length) return null;
  return (
    <section
      className="market-watchlist"
      aria-label="Sous-jacents des warrants"
    >
      <div className="market-heading">
        <h2>
          Sous-jacents{" "}
          <button
            className="market-clear"
            aria-pressed={selected === "all"}
            onClick={() => onSelect("all")}
          >
            Tous
          </button>
        </h2>
        <span>
          20 séances · clôtures du {date(through, true)}
          <span className="market-scroll-hint"> · faire défiler ↔</span>
        </span>
      </div>
      <div
        className="market-strip"
        tabIndex={0}
        role="region"
        aria-label="Cours de clôture des sous-jacents, liste défilante"
      >
        {entries.map(([id, h]) => {
          const closes = h.closes.slice(-21);
          const last = closes.at(-1)!,
            previous = closes[0],
            change = last / previous - 1;
          const tone = change < 0 ? "negative" : change > 0 ? "positive" : "";
          const unit =
            id === "NDX"
              ? "pts"
              : dataset.products.find((p) => p.underlying === id)?.currency ===
                  "EUR"
                ? "€"
                : "$";
          return (
            <button
              key={id}
              className="market-asset"
              aria-label={`${id} · ${h.name} · filtrer les contrats`}
              aria-pressed={selected === id}
              onClick={() => onSelect(selected === id ? "all" : id)}
            >
              <span className="market-asset-top">
                <strong>{id}</strong>
                <Sparkline values={closes} className={tone} />
              </span>
              <span className="market-asset-quote">
                <strong>
                  {number(last, 2)} {unit}
                </strong>
                <span className={tone}>
                  {change > 0 ? "+" : ""}
                  {percent(change, 2)}
                </span>
              </span>
              <span className="visually-hidden">
                Variation et courbe sur les 20 dernières séances. Dernière
                clôture : {date(h.dates.at(-1)!)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
