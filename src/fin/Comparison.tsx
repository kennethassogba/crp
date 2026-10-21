import React from "react";
import { PortfolioView, type PortfolioEntry } from "./PortfolioView";
import { euro } from "./format";
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

export function modelEntries(
  data: Comparison,
  runs: Run[],
  onSelect: (r: Run) => void,
): PortfolioEntry[] {
  return data.models.map((m) => {
    const run = runs.find((r) => r.id === m.latestRunId);
    return {
      id: m.id,
      name: m.name,
      subtitle: `IA · ${position(m)}`,
      initial: data.capital,
      capital: m.estimatedCapital,
      pnl: m.totalPnl,
      startedAt: data.startedAt,
      asOf: data.asOf,
      curve: m.curve,
      valuationStatus: m.valuationStatus,
      warning: m.estimatedCapital === null ? "Cours indisponibles" : undefined,
      action: run ? (
        <button
          className="button secondary position-button"
          onClick={() => onSelect(run)}
        >
          Décision
        </button>
      ) : null,
      details: (
        <>
          <dl className="data-rows">
            <div>
              <dt>État</dt>
              <dd>{valuation(m)}</dd>
            </div>
            <div>
              <dt>Positions clôturées</dt>
              <dd>{m.trades}</dd>
            </div>
            <div>
              <dt>Frais des positions clôturées</dt>
              <dd>{euro(m.fees + m.funding, 2)}</dd>
            </div>
          </dl>
          <p>
            Chaque IA choisit BTC, ETH ou les espèces chaque jour. 1 000 € de
            référence par modèle. Frais de marché inclus ; change et coût des
            modèles exclus.
          </p>
          <a href="/crp/methode/">Règles</a> ·{" "}
          <a href="/crp/historique/">Historique</a>
        </>
      ),
    };
  });
}
export function ComparisonView({
  data,
  runs,
  onSelect,
}: {
  data: Comparison;
  runs: Run[];
  onSelect: (r: Run) => void;
}) {
  return (
    <PortfolioView
      entries={modelEntries(data, runs, onSelect)}
      groupLabel="Comparer les modèles"
    />
  );
}
