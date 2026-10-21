import React, { useState } from "react";
import { DecisionDialog, type CrpState, type Run } from "./Crp";
import { compareCrp } from "../../lib/crp-performance.mjs";
import { modelEntries, type Comparison } from "./Comparison";
import { warrantEntry } from "./WarrantExperiment";
import { PortfolioView } from "./PortfolioView";
import type { Dataset } from "./types";
export function Portfolios({
  scope,
  dataset,
  state,
  error,
  retry,
}: {
  scope: "all" | "warrants" | "crp";
  dataset: Dataset | null;
  state: CrpState | null;
  error: string;
  retry: () => void;
}) {
  const [selected, setSelected] = useState<Run | null>(null);
  const comparison = state
    ? ((state.comparison ??
        compareCrp(state.models, state.decisions)) as Comparison)
    : null;
  const warrant = dataset ? warrantEntry(dataset) : null;
  const entries = [
    ...(scope !== "crp" && warrant ? [warrant] : []),
    ...(scope !== "warrants" && comparison && state
      ? modelEntries(comparison, state.decisions, setSelected)
      : []),
  ];
  return (
    <section className="portfolio-page">
      <div className="page-heading">
        <div>
          <h1>
            {scope === "all"
              ? "Portefeuilles"
              : scope === "warrants"
                ? "Warrants"
                : "CRP"}
          </h1>
          <p>Simulations · 1 000 € par portefeuille</p>
        </div>
      </div>
      <nav className="view-tabs portfolio-tabs" aria-label="Portefeuilles">
        <a href="/" aria-current={scope === "all" ? "page" : undefined}>
          Tous
        </a>
        <a
          href="/warrants/experience/"
          aria-current={scope === "warrants" ? "page" : undefined}
        >
          Warrants
        </a>
        <a href="/crp/" aria-current={scope === "crp" ? "page" : undefined}>
          Modèles IA
        </a>
      </nav>
      {error && (
        <p className="notice" role="alert">
          {error} <button onClick={retry}>Réessayer</button>
        </p>
      )}
      {!entries.length && !error ? (
        <p role="status" className="empty-state">
          {(scope === "warrants" ? !dataset : !state)
            ? "Chargement…"
            : "Historique indisponible."}
        </p>
      ) : entries.length ? (
        <PortfolioView
          entries={entries}
          groupLabel={
            scope === "crp"
              ? "Comparer les modèles"
              : scope === "warrants"
                ? "Comparer les warrants"
                : "Comparer les portefeuilles"
          }
        />
      ) : null}
      <DecisionDialog
        selected={selected}
        onClose={() => setSelected(null)}
        models={state?.models ?? []}
      />
    </section>
  );
}
