import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Copy, Download, X } from "lucide-react";
import { LineChart } from "./Charts";
import { download, number, percent, date } from "./format";

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
    collateral = Math.min(10000, 200 / (leverage * (stopPct + 0.0014)));
  return {
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
    dialog = useRef<HTMLDialogElement>(null),
    [asset, setAsset] = useState("BTC"),
    [period, setPeriod] = useState(7),
    [model, setModel] = useState("momentum"),
    [cohort, setCohort] = useState("live"),
    [page, setPage] = useState(0),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
    setCopied(false);
  }, [selected]);
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
  const latest =
    state.decisions
      .filter((r) => r.cohort === "live")
      .reduce((at, r) => Math.max(at, r.snapshot_at), 0) || state.asOf;
  const day = new Date(latest).toISOString().slice(0, 10),
    daily = state.models.map((m) => ({
      ...m,
      run: state.decisions.find(
        (r) =>
          r.model === m.id &&
          r.cohort === "live" &&
          new Date(r.snapshot_at).toISOString().slice(0, 10) === day,
      ),
    }));
  const history = state.decisions.filter((r) => r.cohort === cohort),
    benchmark = report.results.find((r) => r.name === "Momentum");
  const modelRuns = history
    .filter((r) => r.model === model && r.result)
    .sort((a, b) => a.snapshot_at - b.snapshot_at);
  const curve =
    model === "momentum"
      ? (benchmark?.curve ?? [])
      : modelRuns.map((r) => ({ t: r.result.exitAt, equity: r.result.equity }));
  const priceData = (state.prices[asset] ?? []).slice(-period * 24),
    selectedPlan = selected ? plan(selected) : null;
  const moneyReturn = (v: number) => `${v >= 0 ? "+" : ""}${number(v, 2)} $`;
  return (
    <section className="crp-page">
      <div className="page-heading">
        <h1>
          {
            {
              today: "Décisions",
              models: "Modèles",
              history: "Historique",
              method: "Règles",
            }[view]
          }{" "}
          <span className="heading-context">CRP</span>
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
        <a href="/crp/" aria-current={view === "today" ? "page" : undefined}>
          Décisions
        </a>
        <a
          href="/crp/modeles/"
          aria-current={view === "models" ? "page" : undefined}
        >
          Modèles
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
      {view === "today" && (
        <>
          <div className="section-heading">
            <h2>{date(day, true)}</h2>
            <span className="muted">Portefeuille simulé de 10 000 $</span>
          </div>
          <div className="decision-list">
            {daily.map((m) => (
              <button
                className="decision-row"
                key={m.id}
                disabled={!m.run}
                onClick={() => setSelected(m.run!)}
              >
                <span>
                  <strong>{m.name}</strong>
                  <small>
                    {m.run
                      ? m.run.status === "completed"
                        ? (m.run.decision?.reason ?? "Raison non fournie")
                        : status(m.run)
                      : "Décision pas encore publiée"}
                  </small>
                </span>
                <span className="decision-action">
                  {m.run?.status === "completed"
                    ? action(m.run.decision?.action)
                    : m.run
                      ? status(m.run)
                      : "En attente"}
                  {m.run?.status === "completed" &&
                    m.run.decision?.action !== "CASH" && <small>24 h</small>}
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
          <div className="section-heading market-heading">
            <h2>Marché</h2>
            <span className="muted">{datetime(state.asOf)}</span>
          </div>
          <div className="chart-toolbar">
            <div className="segmented" aria-label="Actif">
              {["BTC", "ETH"].map((a) => (
                <button
                  key={a}
                  aria-pressed={asset === a}
                  onClick={() => setAsset(a)}
                >
                  {a}
                </button>
              ))}
            </div>
            <strong>{usd(state.snapshot.assets[asset]?.price ?? 0)}</strong>
            <div className="segmented period-selector" aria-label="Période">
              {[1, 7, 30].map((n) => (
                <button
                  key={n}
                  aria-pressed={period === n}
                  onClick={() => setPeriod(n)}
                >
                  {n} j
                </button>
              ))}
            </div>
          </div>
          <LineChart
            values={priceData.map((p) => p.c)}
            dates={priceData.map((p) => new Date(p.t).toISOString())}
            name={`${asset}, ${period} jours`}
          />
          <p className="small muted">
            Cinq modèles choisissent BTC, ETH ou espèces chaque jour. Aucun
            ordre réel.
          </p>
        </>
      )}
      {view === "models" && (
        <>
          <div className="section-heading">
            <h2>Résultats observés</h2>
            <span className="muted">
              Les décisions hors délai sont exclues.
            </span>
          </div>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Tableau des résultats"
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Modèle</th>
                  <th>Décisions</th>
                  <th>Soldées</th>
                  <th>Gain net simulé</th>
                  <th>Gagnantes</th>
                </tr>
              </thead>
              <tbody>
                {state.models.map((m) => {
                  const all = state.decisions.filter(
                      (r) => r.cohort === "live" && r.model === m.id,
                    ),
                    closed = all.filter((r) => r.result),
                    last = closed
                      .sort((a, b) => a.snapshot_at - b.snapshot_at)
                      .at(-1);
                  return (
                    <tr key={m.id}>
                      <th scope="row">
                        {m.name}
                        <small>{m.provider}</small>
                      </th>
                      <td>
                        {all.filter((r) => r.status === "completed").length}
                      </td>
                      <td>{closed.length}</td>
                      <td>
                        {last
                          ? moneyReturn(last.result.equity - 10000)
                          : "En attente"}
                      </td>
                      <td>
                        {closed.length
                          ? percent(
                              closed.filter((r) => r.result.pnl > 0).length /
                                closed.length,
                            )
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <details className="explainer">
            <summary>Comment lire cette comparaison ?</summary>
            <p>
              Chaque modèle reçoit le même état du marché. Le résultat intègre
              les hypothèses de frais, financement et entrée retardée décrites
              dans les règles. Ce petit échantillon ne suffit pas à démontrer
              une performance future.
            </p>
          </details>
        </>
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
                          {usd(r.equity ?? r.curve?.at(-1)?.equity ?? 10000)}
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
            À 08 h UTC, cinq configurations OpenAI reçoivent les mêmes cours,
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
              ["Capital initial", usd(report.rules.capital)],
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
      <dialog
        ref={dialog}
        className="detail-dialog decision-dialog"
        aria-label="Décision enregistrée"
        onCancel={() => setSelected(null)}
        onClose={() => setSelected(null)}
      >
        <div className="dialog-topbar">
          <span>Décision enregistrée</span>
          <button
            className="icon-button"
            aria-label="Fermer la décision"
            onClick={() => setSelected(null)}
          >
            <X size={18} />
          </button>
        </div>
        {selected && (
          <div className="decision-detail">
            <div className="page-heading">
              <h2>
                {state.models.find((m) => m.id === selected.model)?.name ??
                  selected.model}
              </h2>
              <span className="status-chip">{status(selected)}</span>
            </div>
            <p className="small muted">{datetime(selected.snapshot_at)}</p>
            <h3>
              {selected.decision
                ? action(selected.decision.action)
                : "Pas de position"}
            </h3>
            <p className="decision-reason">
              {selected.decision?.reason ??
                selected.error ??
                "Aucune raison enregistrée."}
            </p>
            {selectedPlan && (
              <dl className="contract-grid">
                {[
                  ["Entrée indicative", usd(selectedPlan.entry)],
                  ["Stop", usd(selectedPlan.stop)],
                  ["Levier", `${selectedPlan.leverage}×`],
                  ["Exposition pour 10 000 $", usd(selectedPlan.notional)],
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
                  <dd>{moneyReturn(selected.result.pnl ?? 0)}</dd>
                </div>
                <div>
                  <dt>Capital après sortie</dt>
                  <dd>{usd(selected.result.equity)}</dd>
                </div>
              </dl>
            )}
            <details className="explainer">
              <summary>Données de la décision</summary>
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
    </section>
  );
}
