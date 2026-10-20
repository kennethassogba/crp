import React, { useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, Check, Search } from "lucide-react";
import { compareWarrants } from "../../lib/warrant-experiment.mjs";
import { LineChart } from "./Charts";
import { Sparkline } from "./Sparkline";
import {
  date,
  download,
  euro,
  number,
  observedTime,
  safeUrl,
  signedEuro,
} from "./format";
import type { Dataset } from "./types";

type Contract = {
  id: string;
  isin: string;
  underlying: string;
  direction: string;
  expiry: string;
  brokerUrl?: string;
  status: string;
  startedAt: string;
  entryKind: string;
  entryAsk: number;
  bid: number;
  valuationAt: string;
  capital: number | null;
  pnl: number | null;
  sourceQuantity: number;
  sourceCost: number;
  cash: number;
  entryFee: number;
  exitFee: number | null;
  maxLoss: number;
  curve: { at: string; capital: number }[];
};
const gainClass = (n: number | null) =>
  n === null || n === 0 ? "" : n < 0 ? "negative" : "positive";
const statusLabel = (s: string) =>
  ({
    observed: "Prix relevé",
    stale: "Ancien relevé",
    reference: "Prix de référence",
    "settlement-missing": "Remboursement à vérifier",
    blocked: "Ordre source impossible",
  })[s] ?? s;

export function WarrantExperiment({ dataset }: { dataset: Dataset }) {
  const detailRef = useRef<HTMLElement>(null);
  const data: { capital: number; contracts: Contract[] } = useMemo(
    () => compareWarrants(dataset),
    [dataset],
  );
  const [selectedId, setSelectedId] = useState("DE000FG32YX6");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const rows = data.contracts.filter((r) =>
    `${r.id} ${r.isin} ${r.underlying}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const selected = data.contracts.find((r) => r.isin === selectedId) ?? rows[0];
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(rows.length / 6) - 1));
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Warrants</h1>
          <p>
            100 € de référence par contrat · positions conservées depuis leur
            premier relevé
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() =>
            download("warrants-base-100.json", JSON.stringify(data, null, 2))
          }
        >
          <ArrowDownToLine size={14} />
          Exporter
        </button>
      </div>
      <nav className="view-tabs" aria-label="Vues Warrants">
        <a href="/warrants/experience/" aria-current="page">
          Simulation 100 €
        </a>
        <a href="/warrants/">Catalogue</a>
      </nav>
      {!selected ? (
        <p className="empty-state">
          Aucun historique de prix disponible.{" "}
          <a href="/warrants/">Voir le catalogue</a>
        </p>
      ) : (
        <div className="stock-comparison warrant-experiment">
          <div className="stock-layout">
            <section
              className="stock-watchlist"
              aria-label="Portefeuilles des warrants"
            >
              <div className="watchlist-heading">
                <h2>Contrats</h2>
                <span>Base 100 € chacun</span>
              </div>
              <label className="search-field">
                <Search size={15} />
                <input
                  type="search"
                  aria-label="Rechercher dans la simulation"
                  placeholder="Code, ISIN, sous-jacent"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <div
                className="model-watchlist"
                role="group"
                aria-label="Comparer les warrants"
              >
                {rows.slice(pageIndex * 6, pageIndex * 6 + 6).map((r) => (
                  <button
                    key={r.isin}
                    className="stock-row"
                    aria-pressed={selected.isin === r.isin}
                    onClick={() => {
                      setSelectedId(r.isin);
                      if (matchMedia("(max-width: 800px)").matches)
                        requestAnimationFrame(() => {
                          detailRef.current?.focus({ preventScroll: true });
                          detailRef.current?.scrollIntoView({ block: "start" });
                        });
                    }}
                  >
                    <span className="stock-name">
                      <strong>
                        {r.id}
                        {selected.isin === r.isin && (
                          <Check
                            className="selection-check"
                            size={13}
                            aria-hidden="true"
                          />
                        )}
                      </strong>
                      <small>
                        {r.underlying} ·{" "}
                        {r.direction === "call" ? "Hausse" : "Baisse"}
                        {r.status !== "observed" && (
                          <> · {statusLabel(r.status)}</>
                        )}
                      </small>
                    </span>
                    <Sparkline
                      values={r.curve.map((p) => p.capital)}
                      times={r.curve.map((p) => Date.parse(p.at))}
                      className={gainClass(r.pnl)}
                    />
                    <span className="stock-values">
                      <strong>
                        {r.capital === null ? "—" : euro(r.capital, 2)}
                      </strong>
                      <span className={`change-badge ${gainClass(r.pnl)}`}>
                        {r.pnl === null ? "À vérifier" : signedEuro(r.pnl, 2)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {!rows.length && (
                <p role="status">Aucun contrat trouvé. Effacer la recherche.</p>
              )}
              {rows.length > 6 && (
                <div className="experiment-pagination">
                  <button
                    className="button secondary"
                    disabled={pageIndex === 0}
                    onClick={() => setPage(pageIndex - 1)}
                  >
                    Précédents
                  </button>
                  <span>
                    {pageIndex + 1} / {Math.ceil(rows.length / 6)}
                  </span>
                  <button
                    className="button secondary"
                    disabled={(pageIndex + 1) * 6 >= rows.length}
                    onClick={() => setPage(pageIndex + 1)}
                  >
                    Suivants
                  </button>
                </div>
              )}
              <p className="watchlist-caption">
                Chaque ligne est une simulation indépendante. Les nouveaux
                contrats démarrent à leur premier prix archivé.
              </p>
            </section>
            <section
              ref={detailRef}
              tabIndex={-1}
              className="stock-detail"
              aria-label={`Portefeuille ${selected.id}`}
            >
              <div className="stock-detail-heading">
                <div>
                  <h2>{selected.id}</h2>
                  <p>
                    {selected.underlying} ·{" "}
                    {selected.direction === "call" ? "Hausse" : "Baisse"} ·
                    échéance {date(selected.expiry, true)}
                  </p>
                </div>
                {safeUrl(selected.brokerUrl) && (
                  <a
                    className="button secondary"
                    href={safeUrl(selected.brokerUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Bourso <ArrowUpRight size={14} />
                  </a>
                )}
              </div>
              <div className="stock-quote">
                <strong>
                  {selected.capital === null ? "—" : euro(selected.capital, 2)}
                </strong>
                <p className={gainClass(selected.pnl)}>
                  {selected.pnl === null
                    ? statusLabel(selected.status)
                    : signedEuro(selected.pnl, 2)}
                  <span> depuis {euro(data.capital, 0)}</span>
                </p>
                <small>
                  {statusLabel(selected.status)} ·{" "}
                  {observedTime(selected.valuationAt)}
                </small>
              </div>
              {selected.status === "stale" && (
                <p className="notice">
                  Le dernier relevé a échoué ou est ancien. Ce montant ne
                  constitue pas un prix de sortie actuel.
                </p>
              )}
              {selected.status === "settlement-missing" && (
                <p className="notice">
                  Échéance passée. Le remboursement n’est pas encore enregistré
                  ; aucun gain final n’est calculé.
                </p>
              )}
              <LineChart
                key={selected.isin}
                values={selected.curve.map((p) => p.capital)}
                dates={selected.curve.map((p) => p.at)}
                name={`Capital de référence ${selected.id}`}
                unit="€"
                elapsedTime
                baseline={100}
              />
              <dl className="stock-stats">
                <div>
                  <dt>Départ</dt>
                  <dd>
                    {date(selected.startedAt, true)}
                    <small>
                      {selected.entryKind === "reference"
                        ? "Référence archivée"
                        : "Premier relevé"}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Achat / dernier prix de revente</dt>
                  <dd>
                    {euro(selected.entryAsk, 3)} / {euro(selected.bid, 3)}
                  </dd>
                </div>
                <div>
                  <dt>Frais simulés, base 100 €</dt>
                  <dd>
                    {euro(selected.entryFee + (selected.exitFee ?? 0), 2)}
                  </dd>
                </div>
                <div>
                  <dt>Perte maximale, base 100 €</dt>
                  <dd>{euro(selected.maxLoss, 2)}</dd>
                </div>
              </dl>
              <details className="stock-explanation">
                <summary>Comment sont calculés les 100 € ?</summary>
                <p>
                  Un achat simulé de 3 000 € au premier prix vendeur est ramené
                  à 100 €. Le nombre entier de warrants reste fixe ; les espèces
                  restantes sont conservées. La valorisation utilise le dernier
                  prix acheteur, après frais de revente simulés. Aucun
                  réinvestissement.
                </p>
                <p>
                  Pour ce contrat : {number(selected.sourceQuantity)} unités au
                  départ, {euro(selected.sourceCost, 2)} engagés sur 3 000 €.
                  Espèces en base 100 € : {euro(selected.cash, 2)}. Gain =
                  capital affiché − 100 €.
                </p>
                <p>
                  Ce sont des euros de comparaison, comme pour CRP. Un ordre
                  réel de 100 € est inférieur au minimum de 500 € du catalogue.
                  BoursoMarkets vérifié : courtage nul ; sinon hypothèse de 0,1
                  %, minimum 9,95 € par ordre source. Spread inclus ; impôts
                  exclus.
                </p>
                <p>
                  Les six contrats initiaux partent des prix de référence du 16
                  octobre 2026, les autres de leur première observation. Les
                  courbes relient uniquement les relevés archivés. Aucun cours
                  intermédiaire ni remboursement à échéance n’est inventé. Les
                  prix publics ne garantissent pas une exécution.
                </p>
                <a href="/warrants/methode/">Voir la méthode</a>
              </details>
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
