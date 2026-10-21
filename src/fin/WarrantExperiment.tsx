import React from "react";
import { warrantPortfolio } from "../../lib/warrant-experiment.mjs";
import { PortfolioView, type PortfolioEntry } from "./PortfolioView";
import { euro, safeUrl } from "./format";
import type { Dataset } from "./types";
export function warrantEntry(dataset: Dataset): PortfolioEntry | null {
  const p = warrantPortfolio(dataset),
    line = p.positions[0];
  if (!line) return null;
  const q = line as {
    id: string;
    quantity: number;
    entryAsk: number;
    bid: number;
    brokerUrl?: string;
    expiry: string;
  };
  return {
    id: "warrant",
    name: q.id,
    subtitle: "Warrant · achat à J1",
    initial: p.capital,
    capital: p.capitalNow,
    pnl: p.pnl,
    startedAt: Date.parse(p.startedAt!),
    asOf: Date.parse(p.valuationAt!),
    curve: p.curve,
    valuationStatus: p.status,
    warning:
      p.status === "stale"
        ? "Dernier cours ancien"
        : p.status === "settlement-missing"
          ? "Remboursement à vérifier"
          : undefined,
    action: safeUrl(q.brokerUrl) ? (
      <a
        className="button secondary"
        href={safeUrl(q.brokerUrl)}
        target="_blank"
        rel="noreferrer"
      >
        Bourso
      </a>
    ) : null,
    details: (
      <>
        <dl className="data-rows">
          <div>
            <dt>Position</dt>
            <dd>
              {q.quantity} {q.id}
            </dd>
          </div>
          <div>
            <dt>Achat / dernier cours acheteur</dt>
            <dd>
              {euro(q.entryAsk, 3)} / {euro(q.bid, 3)}
            </dd>
          </div>
          <div>
            <dt>Espèces</dt>
            <dd>{euro(p.cash!, 2)}</dd>
          </div>
          <div>
            <dt>Frais simulés, achat et revente</dt>
            <dd>{euro(p.entryFee! + (p.exitFee ?? 0), 2)}</dd>
          </div>
          <div>
            <dt>Perte maximale</dt>
            <dd>{euro(p.maxLoss!, 2)}</dd>
          </div>
        </dl>
        <p>
          Achat unique au prix de référence du 16 octobre. Quantité fixe,
          espèces conservées ; revente simulée au cours acheteur. Frais inclus,
          impôts exclus. Aucun ordre réel.
        </p>
        <a href="/warrants/methode/">Règles</a>
      </>
    ),
  };
}
export function WarrantExperiment({ dataset }: { dataset: Dataset }) {
  const p = warrantEntry(dataset);
  return (
    <PortfolioView entries={p ? [p] : []} groupLabel="Comparer les warrants" />
  );
}
