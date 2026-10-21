import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Copy, Download, X } from "lucide-react";
import { LineChart } from "./Charts";
import { ComparisonView, type Comparison } from "./Comparison";
import { compareCrp } from "../../lib/crp-performance.mjs";
import { download, number, percent, date, euro, signedEuro } from "./format";

type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};
export type Run = {
  id: string;
  model: string;
  cohort: string;
  snapshot_at: number;
  published_at: number;
  entry_after: number;
  status: string;
  decision: any;
  result: any;
  cost: number;
  latency_ms: number;
  error?: string;
  snapshot: any;
};
export type Report = {
  days: number;
  from: number;
  to: number;
  results: any[];
  rules: any;
};
export type CrpState = {
  asOf: number;
  collectedAt: number;
  stale: boolean;
  configured: boolean;
  source: string;
  snapshot: any;
  reference: any;
  models: { id: string; name: string; provider: string }[];
  decisions: Run[];
  comparison?: Comparison;
  budget: { actual: number; committed: number; cap: number };
  scheduler: any;
  prices: Record<string, Candle[]>;
};
const usd = (v: number) => `${number(v, 2)} $`;
const action = (s?: string) =>
  !s || s === "CASH" ? "Espèces" : s.replace("_", " · ").replace("X", "×");
const status = (r: Run) =>
  r.status === "failed"
    ? "Échec"
    : r.status === "late"
      ? "Hors délai"
      : r.status === "reserved"
        ? "En cours"
        : r.status === "completed"
          ? "Terminé"
          : r.status;
const datetime = (v: number) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(v);
function plan(r: Run) {
  const d = r.decision;
  if (!d || d.action === "CASH") return null;
  const [asset, lev] = d.action.split("_"),
    a = r.snapshot?.assets?.[asset],
    leverage = Number(lev?.replace("X", ""));
  if (!a || ![1, 2].includes(leverage)) return null;
  const entry = a.price,
    stopPct = a.stopPct,
    collateral = Math.min(1000, 20 / (leverage * (stopPct + 0.0014)));
  return {
    referenceEquity: 1000,
    currency: "EUR",
    basis: "normalized-return",
    fxIncluded: false,
    entry,
    stop: entry * (1 - stopPct),
    leverage,
    collateral,
    notional: collateral * leverage,
  };
}
export function Crp({
  path,
  state,
  report,
  error,
  retry,
}: {
  path: string;
  state: CrpState | null;
  report: Report | null;
  error: string;
  retry: () => void;
}) {
  const [selected, setSelected] = useState<Run | null>(null),
    [model, setModel] = useState("momentum"),
    [cohort, setCohort] = useState("live"),
    [page, setPage] = useState(0);
  useEffect(() => setPage(0), [cohort, model, path]);
  const view = path.includes("/modeles")
    ? "models"
    : path.includes("/historique")
      ? "history"
      : path.includes("/methode")
        ? "method"
        : "today";
  if (error)
    return (
      <div className="empty-state" role="alert">
        <h1>CRP indisponible</h1>
        <p>{error}</p>
        <button className="button" onClick={retry}>
          Réessayer
        </button>
        <a href="/data/backtest.json">Télécharger les données</a>
      </div>
    );
  if (!state || !report)
    return (
      <div className="empty-state" role="status">
        <h1>CRP</h1>
        <p>Chargement des décisions…</p>
      </div>
    );
  const history = state.decisions.filter((r) => r.cohort === cohort),
    benchmark = report.results.find((r) => r.name === "Momentum");
  const modelRuns = history
    .filter((r) => r.model === model && r.result)
    .sort((a, b) => a.snapshot_at - b.snapshot_at);
  const curve =
    model === "momentum"
      ? (benchmark?.curve ?? []).map((p: any) => ({
          ...p,
          equity: p.equity / (report.rules.capital / 1000),
        }))
      : [
          { t: modelRuns[0]?.snapshot_at, equity: 1000 },
          ...modelRuns.map((r) => ({
            t: r.result.exitAt,
            equity: r.result.equity / 10,
          })),
        ].filter((p) => p.t);
  const comparison = (state.comparison ??
    compareCrp(state.models, state.decisions)) as Comparison;
  return (
    <section className="crp-page">
      <div className="page-heading">
        <h1>
          {
            {
              today: "CRP",
              models: "CRP",
              history: "Historique",
              method: "Règles",
            }[view]
          }{" "}
          {!["today", "models"].includes(view) && (
            <span className="heading-context">CRP</span>
          )}
        </h1>
        <button
          className="button secondary"
          onClick={() =>
            download(
              "fin-crp.json",
              JSON.stringify({ state, backtest: report }, null, 2),
            )
          }
        >
          <Download size={14} />
          Exporter
        </button>
      </div>
      <div className="view-tabs" aria-label="Vues CRP">
        <a
          href="/crp/"
          aria-current={["today", "models"].includes(view) ? "page" : undefined}
        >
          Comparaison
        </a>
        <a
          href="/crp/historique/"
          aria-current={view === "history" ? "page" : undefined}
        >
          Historique
        </a>
        <a
          href="/crp/methode/"
          aria-current={view === "method" ? "page" : undefined}
        >
          Règles
        </a>
      </div>
      {state.stale && (
        <p className="notice" role="status">
          Marché retardé · dernier relevé {datetime(state.asOf)}.{" "}
          <button onClick={retry}>Réessayer</button>
        </p>
      )}
      {["today", "models"].includes(view) && (
        <ComparisonView
          data={comparison}
          runs={state.decisions}
          onSelect={setSelected}
        />
      )}
      {view === "history" && (
        <>
          <div className="toolbar">
            <label>
              Stratégie
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="momentum">Référence Momentum</option>
                {state.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            {model !== "momentum" && (
              <label>
                Période
                <select
                  value={cohort}
                  onChange={(e) => setCohort(e.target.value)}
                >
                  <option value="live">Observations en direct</option>
                  <option value="replay">Rejeu historique</option>
                </select>
              </label>
            )}
          </div>
          <div className="section-heading">
            <h2>
              {model === "momentum"
                ? "Test historique Binance"
                : "Capital simulé"}
            </h2>
            <span className="muted">{curve.length} observations</span>
          </div>
          <LineChart
            values={curve.map((p: any) => p.equity)}
            dates={curve.map((p: any) => new Date(p.t).toISOString())}
            name="Capital simulé"
            unit="€"
          />
          {model === "momentum" ? (
            <>
              <p className="small muted">
                {date(new Date(report.from).toISOString(), true)} au{" "}
                {date(new Date(report.to).toISOString(), true)} · {report.days}{" "}
                séances historiques. Ce test n’est pas le résultat des décisions
                actuelles.
              </p>
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Tableau des résultats"
              >
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Stratégie</th>
                      <th>Capital final</th>
                      <th>Rendement</th>
                      <th>Perte maximale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.results.map((r) => (
                      <tr key={r.name}>
                        <th scope="row">{r.name}</th>
                        <td>
                          {euro(
                            (r.equity ??
                              r.curve?.at(-1)?.equity ??
                              report.rules.capital) /
                              (report.rules.capital / 1000),
                            2,
                          )}
                        </td>
                        <td>{percent((r.returnPct ?? 0) / 100)}</td>
                        <td>{percent(Math.abs(r.maxDrawdown ?? 0) / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="section-heading">
                <h2>Journal des décisions</h2>
              </div>
              <div className="decision-list">
                {history
                  .filter((r) => r.model === model)
                  .slice(page * 20, page * 20 + 20)
                  .map((r) => (
                    <button
                      key={r.id}
                      className="decision-row"
                      onClick={() => setSelected(r)}
                    >
                      <span>
                        <strong>{datetime(r.snapshot_at)}</strong>
                        <small>{status(r)}</small>
                      </span>
                      <span>
                        {r.decision ? action(r.decision.action) : "—"}
                      </span>
                      <ArrowRight size={15} />
                    </button>
                  ))}
                {!history.some((r) => r.model === model) && (
                  <p className="empty-state">
                    Aucune décision pour cette période. Choisir une autre
                    période.
                  </p>
                )}
              </div>
              <div className="pagination">
                <button disabled={!page} onClick={() => setPage(page - 1)}>
                  Précédent
                </button>
                <span>{page + 1}</span>
                <button
                  disabled={
                    (page + 1) * 20 >=
                    history.filter((r) => r.model === model).length
                  }
                  onClick={() => setPage(page + 1)}
                >
                  Suivant
                </button>
              </div>
            </>
          )}
        </>
      )}
      {view === "method" && (
        <div className="reading">
          <h2>Une décision par jour</h2>
          <p>
            À 08 h UTC, trois configurations OpenAI reçoivent les mêmes cours,
            variations, volumes et taux de financement de BTC et ETH. Elles
            choisissent un actif ou restent en espèces.
          </p>
          <h2>Une entrée après publication</h2>
          <p>
            Une décision reçue après la limite est exclue. L’entrée simulée
            attend la séance suivante. La position se ferme au stop ou après 24
            heures. Aucun ordre n’est envoyé à une plateforme.
          </p>
          <h2>Règles d’exécution</h2>
          <dl className="contract-grid">
            {[
              ["Capital initial par modèle", euro(1000, 0)],
              ["Risque prévu par position", percent(report.rules.risk)],
              ["Levier maximal", `${report.rules.maxLeverage}×`],
              ["Sortie au plus tard", `${report.rules.horizonHours} heures`],
              ["Frais, par côté", percent(report.rules.fee, 2)],
              ["Glissement, par côté", percent(report.rules.slippage, 2)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <h2>Comment est calculé le capital ?</h2>
          <p>
            Chaque modèle commence avec 1 000 € de référence. Les rendements du
            journal d’origine en dollars sont appliqués à ces 1 000 €, sans
            modifier les décisions enregistrées. Le change euro/dollar n’est pas
            simulé.
          </p>
          <p>
            Le capital estimé ajoute au capital clôturé la valeur des positions
            en cours, au dernier cours horaire disponible. Cette estimation
            inclut une sortie au marché, les frais, le glissement et le
            financement observé. Elle peut encore changer. Un cours manquant est
            signalé ; il ne devient pas un gain de zéro.
          </p>
          <p>
            Le gain clôturé reste à zéro tant que les décisions soldées sont en
            espèces. Les coûts des modèles sont suivis séparément en dollars,
            hors rendement du portefeuille. Un résultat historique ne prouve pas
            une performance future.
          </p>
          <p>
            Coûts modèles cumulés : {usd(state.budget.actual)} sur{" "}
            {usd(state.budget.cap)} de plafond.
          </p>
          <h2>Sources</h2>
          <p>
            Le suivi actuel utilise Kraken Futures. Le test Momentum conserve
            son jeu historique Binance. Les deux périodes sont affichées
            séparément.
          </p>
          <div className="source-list">
            <a href="/data/backtest.json">Données du test historique</a>
            <a href="/api/state">Décisions et prix actuels</a>
            <a href="/openapi.json">API publique</a>
          </div>
        </div>
      )}
      <DecisionDialog
        selected={selected}
        onClose={() => setSelected(null)}
        models={state.models}
      />
    </section>
  );
}

export function DecisionDialog({
  selected,
  onClose,
  models,
}: {
  selected: Run | null;
  onClose: () => void;
  models: CrpState["models"];
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
    setCopied(false);
  }, [selected]);
  const selectedPlan = selected?.status === "completed" ? plan(selected) : null;
  const moneyReturn = (v: number) => signedEuro(v, 2);
  return (
    <dialog
      ref={dialog}
      className="detail-dialog decision-dialog"
      aria-label="Décision enregistrée"
      onCancel={() => onClose()}
      onClose={() => onClose()}
    >
      <div className="dialog-topbar">
        <span>Décision enregistrée</span>
        <button
          className="icon-button"
          aria-label="Fermer la décision"
          onClick={() => onClose()}
        >
          <X size={18} />
        </button>
      </div>
      {selected && (
        <div className="decision-detail">
          <div className="page-heading">
            <h2>
              {models.find((m) => m.id === selected.model)?.name ??
                selected.model}
            </h2>
            <span className="status-chip">{status(selected)}</span>
          </div>
          <p className="small muted">{datetime(selected.snapshot_at)}</p>
          <h3>
            {selected.status === "completed" && selected.decision
              ? action(selected.decision.action)
              : "Pas de position"}
          </h3>
          <p className="decision-reason">
            {selected.status === "failed"
              ? (selected.error ?? "La réponse du modèle a échoué.")
              : (selected.decision?.reason ?? "Aucune raison enregistrée.")}
          </p>
          {selectedPlan && (
            <dl className="contract-grid">
              {[
                ["Entrée indicative", usd(selectedPlan.entry)],
                ["Stop", usd(selectedPlan.stop)],
                ["Levier", `${selectedPlan.leverage}×`],
                [
                  "Exposition sur la base de 1 000 €",
                  euro(selectedPlan.notional, 2),
                ],
                ["Entrée prévue", datetime(selected.entry_after)],
                ["Sortie", "24 h après l’entrée"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {selected.result && (
            <dl className="contract-grid">
              <div>
                <dt>Gain net simulé</dt>
                <dd>{moneyReturn((selected.result.pnl ?? 0) / 10)}</dd>
              </div>
              <div>
                <dt>Capital après sortie</dt>
                <dd>{euro(selected.result.equity / 10, 2)}</dd>
              </div>
            </dl>
          )}
          <details className="explainer">
            <summary>Journal d’origine (USD)</summary>
            <pre tabIndex={0}>
              {JSON.stringify(
                {
                  decision: selected.decision,
                  result: selected.result,
                  snapshot: selected.snapshot,
                },
                null,
                2,
              )}
            </pre>
          </details>
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() =>
                download(
                  `crp-${selected.id}.json`,
                  JSON.stringify(selected, null, 2),
                )
              }
            >
              <Download size={14} />
              Exporter
            </button>
            <button
              className="button secondary"
              disabled={!selectedPlan}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    JSON.stringify(
                      { decision: selected.decision, plan: selectedPlan },
                      null,
                      2,
                    ),
                  );
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              <Copy size={14} />
              {copied ? "Copié" : "Copier le plan"}
            </button>
          </div>
          <p className="small muted">Position simulée. Aucun ordre réel.</p>
        </div>
      )}
    </dialog>
  );
}
