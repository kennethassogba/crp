import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileText,
  History,
  Info,
  Layers,
  RefreshCw,
  Shield,
  X,
} from "lucide-react";
import "@fontsource-variable/geist";
import "./style.css";
import { InstallPrompt } from "./InstallPrompt";

type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};
type Curve = { t: number; equity: number };
type Run = {
  id: string;
  model: string;
  cohort: string;
  snapshot_at: number;
  published_at: number;
  entry_after: number;
  status: string;
  decision: { action: string; reason: string } | null;
  result: any;
  cost: number;
  latency_ms: number;
  error?: string;
  snapshot: any;
};
type Report = {
  days: number;
  from: number;
  to: number;
  results: any[];
  rules: any;
};
type State = {
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
const fmt = (x: number, d = 2) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(x);
const money = (x: number) => "$" + fmt(x);
const pct = (x: number) => `${x > 0 ? "+" : ""}${fmt(x)}%`;
const date = (x: number) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(x);
const time = (x: number) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(x) + " UTC";
const NAV = [
  { id: "today", label: "Today", icon: Activity },
  { id: "models", label: "Models", icon: Layers },
  { id: "history", label: "Backtest", icon: History },
  { id: "method", label: "Method", icon: FileText },
];
function viewFromHash() {
  const route = window.location.hash.slice(1);
  return route === "backtest" ? "history" : NAV.find((n) => n.id === route)?.id;
}

function App() {
  const [view, setView] = useState(() => viewFromHash() ?? "today"),
    [asset, setAsset] = useState("BTC"),
    [period, setPeriod] = useState(7),
    [state, setState] = useState<State | null>(null),
    [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [historySource, setHistorySource] = useState("momentum"),
    [cohort, setCohort] = useState("live"),
    [page, setPage] = useState(0),
    [copied, setCopied] = useState(false),
    [dialog, setDialog] = useState<Run | null>(null),
    [methodPage, setMethodPage] = useState(0);
  const detail = useRef<HTMLDialogElement>(null);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [a, b] = await Promise.all([
        fetch("/api/state"),
        fetch("/api/backtest"),
      ]);
      if (!a.ok || !b.ok)
        throw Error(
          "Unable to load market data. Retry or open the published dataset.",
        );
      setState(await a.json());
      setReport(await b.json());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load data. Retry shortly.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/crp/sw.js", { scope: "/crp/" }).catch(() => {});
  }, []);
  useEffect(() => {
    const navigate = () => {
      const next = viewFromHash();
      if (next) setView(next);
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  useEffect(() => {
    if (dialog) {
      setCopied(false);
      detail.current?.showModal();
    }
  }, [dialog]);
  useEffect(() => {
    document.title = `CRP · ${NAV.find((n) => n.id === view)?.label}`;
    setPage(0);
  }, [view, cohort, historySource]);
  const rows = state?.decisions.filter((r) => r.cohort === cohort) ?? [];
  const dailyRuns =
    state?.models.map((model) => ({
      ...model,
      run: state.decisions.find(
        (r) =>
          r.cohort === "live" &&
          r.model === model.id &&
          new Date(r.snapshot_at).toISOString().slice(0, 10) ===
            new Date(state.asOf).toISOString().slice(0, 10),
      ),
    })) ?? [];
  const dialogPlan =
    dialog?.status === "completed" &&
    dialog.decision?.action !== "CASH" &&
    dialog.decision
      ? makePlan(dialog.decision, dialog.snapshot)
      : null;
  const current = state?.snapshot.assets[asset];
  const chartData = (state?.prices[asset] ?? [])
    .slice(-24 * period)
    .map((b) => ({ t: b.t, equity: b.c }));
  const selectedStats = report?.results.find((r) => r.name === "Momentum");
  const modelRuns = rows
    .filter((r) => r.model === historySource && r.result)
    .sort((a, b) => a.snapshot_at - b.snapshot_at);
  const curve =
    historySource === "momentum"
      ? (selectedStats?.curve ?? [])
      : modelRuns.map((r) => ({ t: r.result.exitAt, equity: r.result.equity }));
  const curveReturn = curve.length
    ? (curve.at(-1).equity / 10000 - 1) * 100
    : null;
  const changeView = (id: string) => {
    setView(id);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#${id === "history" ? "backtest" : id}`,
    );
  };
  const download = () => {
    const blob = new Blob(
      [JSON.stringify({ state, backtest: report }, null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "crp-evidence.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  async function copy() {
    if (!dialogPlan || !dialog) return;
    const plan = dialogPlan;
    const text = `CRP paper plan\n${actionLabel(dialog.decision?.action)}\nReference ${money(plan.entry)}\nStop ${money(plan.stop)}\nIsolated leverage ${plan.leverage}x\nNotional ${money(plan.notional)} per $10,000 equity\nPlanned entry ${new Date(dialog.entry_after).toISOString()}\nExit 24h after entry\nSnapshot ${new Date(dialog.snapshot_at).toISOString()}\nNo order has been placed.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Unable to copy. Download the evidence instead.");
    }
  }
  return (
    <div className="shell">
      <a className="skip" href="#workspace">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <a className="brand" href="/crp/" aria-label="CRP home">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>crp</span>
          <span className="version">01</span>
        </a>
        <div className="workspace-label">Workspace</div>
        <nav aria-label="Workspace">
          {NAV.map((n) => (
            <button
              key={n.id}
              aria-current={view === n.id ? "page" : undefined}
              onClick={() => changeView(n.id)}
            >
              <n.icon size={17} />
              <span>{n.label}</span>
              {n.id === "models" && <small aria-hidden="true">5</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="paper-label">
            <Shield size={15} /> Paper portfolio
          </span>
          <a
            href="https://github.com/kennethassogba/crp"
            target="_blank"
            rel="noreferrer"
          >
            Source code <ExternalLink size={13} />
          </a>
          <a href="https://keff.uk" target="_blank" rel="noreferrer">
            A k_eff project <ArrowUpRight size={13} />
          </a>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <a href="/" aria-label="Finance home" title="Retour à fin">CRP</a>
            <span className="slash">/</span>
            <h1>{NAV.find((n) => n.id === view)?.label}</h1>
          </div>
          <div className="top-actions">
            <InstallPrompt />
            <button
              className="icon-button"
              onClick={download}
              disabled={!state}
              aria-label="Download evidence"
            >
              <Download size={17} />
            </button>
            <button
              className="icon-button"
              onClick={load}
              disabled={loading}
              aria-label="Refresh data"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>
        <main id="workspace" tabIndex={-1}>
          {error ? (
            <div className="error" role="alert">
              <Info size={18} />
              <p>{error}</p>
              <button onClick={load}>Retry</button>
              <a href="/data/backtest.json">Open dataset</a>
            </div>
          ) : !state || !report ? (
            <div className="loading" role="status">
              <div className="skeleton-line" />
              <div className="skeleton-chart" />
              <span>Loading recorded market data…</span>
            </div>
          ) : (
            <>
              <div
                className={`page-heading ${view === "today" ? "today-heading" : ""}`}
              >
                <div>
                  <h2>
                    {view === "today"
                      ? "Today’s decisions"
                      : view === "models"
                        ? "Model comparison"
                        : view === "history"
                          ? historySource === "momentum"
                            ? "Binance backtest"
                            : "Performance"
                          : "Strategy & data"}
                  </h2>
                  <p>
                    {view === "today"
                      ? "Five AI models choose BTC, ETH or cash each day. Compare their simulated positions."
                      : view === "models"
                        ? "Decisions from the same market snapshot."
                        : view === "history"
                          ? historySource === "momentum"
                            ? `${date(report.from)} to ${date(report.to)} · ${report.days} sessions`
                            : `${cohort === "live" ? "Forward observations" : "Binance replay"} · ${modelRuns.length} settled`
                          : "Inputs, sizing and execution assumptions."}
                  </p>
                </div>
                <span
                  className={`status-label ${state.stale ? "warning" : ""}`}
                >
                  <span />
                  {state.stale ? "Delayed data" : "Data current"}
                </span>
              </div>
              {view === "today" && (
                <div className="today-grid">
                  <section
                    className="decisions-pane"
                    aria-labelledby="daily-models-title"
                  >
                    <div className="daily-heading">
                      <h3 id="daily-models-title">
                        {date(state.asOf)} <span>· Daily session</span>
                      </h3>
                      <button
                        onClick={() => changeView("method")}
                        className="text-link"
                      >
                        How it works <ArrowUpRight size={13} />
                      </button>
                    </div>
                    <div className="daily-columns" aria-hidden="true">
                      <span>Model</span>
                      <span>Position</span>
                    </div>
                    <div className="daily-decisions">
                      {dailyRuns.map((m, i) => {
                        const r = m.run;
                        const expired = Boolean(
                          r && Date.now() >= r.entry_after + 86_400_000,
                        );
                        const usable = r?.status === "completed";
                        const label = usable
                          ? `${actionLabel(r.decision?.action)}${expired ? " · expired" : ""}`
                          : r?.status === "failed"
                            ? "Request failed"
                            : r?.status === "late"
                              ? "Late, excluded"
                              : "Awaiting run";
                        return (
                          <button
                            className={`daily-decision ${usable && r?.decision?.action !== "CASH" ? "has-position" : ""}`}
                            key={m.id}
                            disabled={!r}
                            aria-label={`Read ${m.name} decision: ${label}`}
                            onClick={() => {
                              setCopied(false);
                              setDialog(r!);
                            }}
                          >
                            <span className="daily-model">
                              <span className={`model-dot model-${i}`} />
                              <strong>{m.name}</strong>
                            </span>
                            <span
                              className={`daily-action ${r?.status === "failed" ? "negative" : ""}`}
                            >
                              {label}
                            </span>
                            <ArrowUpRight
                              size={15}
                              className="decision-arrow"
                            />
                          </button>
                        );
                      })}
                    </div>
                    <div className="daily-foot">
                      <span>Paper positions · 24h hold</span>
                      <button
                        className="text-link"
                        onClick={() => changeView("models")}
                      >
                        Compare results <ArrowRight size={13} />
                      </button>
                    </div>
                  </section>
                  <section className="market-pane" aria-label="Market context">
                    <div className="market-heading">
                      <h3>Market</h3>
                      <span>{time(state.asOf)} snapshot</span>
                    </div>
                    <div className="asset-switch" aria-label="Asset">
                      {["BTC", "ETH"].map((a) => {
                        const quote = state.snapshot.assets[a];
                        return (
                          <button
                            key={a}
                            aria-pressed={asset === a}
                            onClick={() => setAsset(a)}
                          >
                            <span className={`coin ${a.toLowerCase()}`}>
                              {a === "BTC" ? "₿" : "Ξ"}
                            </span>
                            <span className="asset-quote">
                              <span className="asset-symbol">
                                {a}
                                <small
                                  className={
                                    quote.ret24h < 0 ? "negative" : "positive"
                                  }
                                >
                                  {pct(quote.ret24h * 100)}
                                </small>
                              </span>
                              <strong>{money(quote.price)}</strong>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="market-chart-heading">
                      <span>
                        {asset} perpetual · {state.snapshot.quote ?? "USDT"}
                      </span>
                      <div className="period-switch" aria-label="Chart period">
                        {[1, 7].map((p) => (
                          <button
                            key={p}
                            aria-pressed={period === p}
                            onClick={() => setPeriod(p)}
                          >
                            {p === 1 ? "24h" : "7d"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Chart
                      data={chartData}
                      label={`${asset} observed hourly prices`}
                      price
                    />
                    <div className="market-facts">
                      <Fact
                        label="24h volatility"
                        value={`${fmt(current.volatility24h * 100)}%`}
                      />
                      <Fact
                        label="Volume / average"
                        value={`${fmt(current.volumeRatio)}×`}
                      />
                      <Fact
                        label={`Funding (${current.fundingPeriodHours ?? 8}h)`}
                        value={
                          current.lastFunding === null
                            ? "Unavailable"
                            : `${fmt(current.lastFunding * 100, 4)}%`
                        }
                      />
                    </div>
                  </section>
                </div>
              )}
              {view === "models" && (
                <section className="table-pane">
                  <div className="section-toolbar">
                    <div className="segmented" aria-label="Evaluation cohort">
                      {["live", "replay"].map((c) => (
                        <button
                          key={c}
                          aria-pressed={cohort === c}
                          onClick={() => setCohort(c)}
                        >
                          {c === "live" ? "Forward" : "Historical replay"}
                        </button>
                      ))}
                    </div>
                    <span className="small-note">
                      {cohort === "live"
                        ? "Recorded before entry"
                        : "Retrospective, possible model contamination"}
                    </span>
                  </div>
                  <div
                    className="model-table"
                    role="table"
                    aria-label="Model comparison"
                  >
                    <div className="model-row table-head" role="row">
                      <span role="columnheader">Model</span>
                      <span role="columnheader">Latest decision</span>
                      <span role="columnheader">Net return</span>
                      <span role="columnheader">Details</span>
                    </div>
                    {state.models.map((m, i) => {
                      const rr = rows.filter((r) => r.model === m.id),
                        r = rr[0],
                        settled = rr
                          .filter((r) => r.result)
                          .sort((a, b) => a.snapshot_at - b.snapshot_at),
                        last = settled.at(-1);
                      return (
                        <div className="model-row" role="row" key={m.id}>
                          <div role="cell" className="model-name">
                            <span className={`model-dot model-${i}`} />
                            <span>
                              <strong>{m.name}</strong>
                              <small>{m.provider}</small>
                            </span>
                          </div>
                          <div role="cell">
                            <span
                              className={`decision-pill ${r?.status === "failed" ? "failure" : ""}`}
                            >
                              {r?.status === "completed"
                                ? actionLabel(r.decision?.action)
                                : r?.status === "failed"
                                  ? "Request failed"
                                  : r?.status === "late"
                                    ? "Late, excluded"
                                    : "Awaiting run"}
                            </span>
                            <small>{settled.length} settled</small>
                          </div>
                          <strong
                            role="cell"
                            className={
                              last?.result.equity < 10000 ? "negative" : ""
                            }
                          >
                            {last
                              ? pct((last.result.equity / 10000 - 1) * 100)
                              : "Not measured"}
                          </strong>
                          <span role="cell">
                            <button
                              className="icon-button"
                              disabled={!r}
                              aria-label={`Read ${m.name} decision`}
                              onClick={() => setDialog(r)}
                            >
                              <ArrowUpRight size={17} />
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="table-foot">
                    <Info size={15} />
                    <p>
                      {cohort === "live"
                        ? "Only prospective, settled positions contribute to forward returns."
                        : "Each replay uses past-only inputs. Historical LLM results remain exploratory."}
                    </p>
                  </div>
                </section>
              )}
              {view === "history" && (
                <section className="history-pane">
                  <div className="section-toolbar">
                    <div className="select-wrap compact">
                      <label className="sr-only" htmlFor="history-source">
                        Performance source
                      </label>
                      <select
                        id="history-source"
                        value={historySource}
                        onChange={(e) => setHistorySource(e.target.value)}
                      >
                        <option value="momentum">Momentum benchmark</option>
                        {state.models.map((m) => (
                          <option value={m.id} key={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} />
                    </div>
                    {historySource !== "momentum" && (
                      <div className="segmented">
                        {["live", "replay"].map((c) => (
                          <button
                            key={c}
                            aria-pressed={cohort === c}
                            onClick={() => setCohort(c)}
                          >
                            {c === "live" ? "Forward" : "Replay"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="equity-heading">
                    <div>
                      <span className="mini-label">Net portfolio return</span>
                      <strong
                        className={
                          curveReturn !== null && curveReturn < 0
                            ? "negative"
                            : "positive"
                        }
                      >
                        {curveReturn === null
                          ? "Not measured"
                          : pct(curveReturn)}
                      </strong>
                    </div>
                    <span>Starting equity $10,000</span>
                  </div>
                  <Chart data={curve} label="Recorded paper equity" />
                  {historySource === "momentum" ? (
                    <>
                      <div className="history-metrics">
                        <Fact
                          label="Closed positions"
                          value={String(selectedStats.trades)}
                        />
                        <Fact
                          label="Settled drawdown"
                          value={fmt(selectedStats.maxDrawdown) + "%"}
                        />
                        <Fact
                          label="Double costs"
                          value={pct(selectedStats.stressReturnPct)}
                        />
                        <Fact
                          label="Win rate"
                          value={fmt(selectedStats.winRate, 1) + "%"}
                        />
                      </div>
                      <div className="benchmark-row">
                        <span>Same-period spot hold</span>
                        {report.results
                          .filter((r) => r.name.endsWith("hold"))
                          .map((r) => (
                            <span key={r.name}>
                              {r.name} <strong>{pct(r.returnPct)}</strong>
                            </span>
                          ))}
                      </div>
                      <div className="journal-heading">
                        <h3>Position journal</h3>
                        <span>
                          {page + 1} /{" "}
                          {Math.max(
                            1,
                            Math.ceil(selectedStats.journal.length / 3),
                          )}
                        </span>
                        <button
                          className="icon-button"
                          disabled={page === 0}
                          onClick={() => setPage((p) => p - 1)}
                          aria-label="Previous positions"
                        >
                          <ArrowLeft size={15} />
                        </button>
                        <button
                          className="icon-button"
                          disabled={
                            (page + 1) * 3 >= selectedStats.journal.length
                          }
                          onClick={() => setPage((p) => p + 1)}
                          aria-label="Next positions"
                        >
                          <ArrowRight size={15} />
                        </button>
                      </div>
                      <div className="journal">
                        {[...selectedStats.journal]
                          .reverse()
                          .slice(page * 3, page * 3 + 3)
                          .map((t) => (
                            <div key={t.at}>
                              <span>{date(t.entryAt)}</span>
                              <strong>
                                {t.action === "CASH"
                                  ? "Cash"
                                  : t.action.replace("_", " · ")}
                              </strong>
                              <span>{t.status}</span>
                              <strong
                                className={t.pnl < 0 ? "negative" : "positive"}
                              >
                                {t.pnl >= 0 ? "+" : ""}
                                {money(t.pnl)}
                              </strong>
                            </div>
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="table-foot">
                      <Info size={16} />
                      <p>
                        {modelRuns.length
                          ? `${modelRuns.length} settled observations. Download the journal for inputs and fills.`
                          : "No settled positions in this cohort. Select Momentum to inspect the historical benchmark."}
                      </p>
                    </div>
                  )}
                </section>
              )}
              {view === "method" && (
                <section className="method-pane">
                  <div className="section-toolbar">
                    <div className="segmented" aria-label="Method section">
                      {["Rules", "Execution", "Evidence"].map((p, i) => (
                        <button
                          key={p}
                          aria-pressed={methodPage === i}
                          onClick={() => setMethodPage(i)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <a href="/method.md" target="_blank">
                      Full method <ExternalLink size={14} />
                    </a>
                  </div>
                  {methodPage === 0 ? (
                    <>
                      <div className="method-icon">
                        <Shield size={24} />
                      </div>
                      <h3>Position sizing</h3>
                      <p>
                        Long BTC, long ETH or cash. Each model receives the same
                        closed hourly candles, volume, volatility and observed
                        funding. News is outside this version.
                      </p>
                      <dl className="method-values">
                        <div>
                          <dt>Daily snapshot</dt>
                          <dd>08:00 UTC</dd>
                        </div>
                        <div>
                          <dt>Entry / time exit</dt>
                          <dd>09:00 UTC / 24h later</dd>
                        </div>
                        <div>
                          <dt>Isolated leverage</dt>
                          <dd>1× or 2×</dd>
                        </div>
                        <div>
                          <dt>Stop distance</dt>
                          <dd>Greater of 1% and 2 × hourly ATR14</dd>
                        </div>
                        <div>
                          <dt>Position sizing</dt>
                          <dd>2% stop-risk budget, including estimated fees</dd>
                        </div>
                      </dl>
                      <p className="small-note">
                        Leverage applies to collateral. Risk sizing usually
                        makes account exposure lower than the selected leverage.
                        The first live observation may start outside the daily
                        schedule.
                      </p>
                    </>
                  ) : methodPage === 1 ? (
                    <>
                      <div className="method-icon">
                        <Activity size={24} />
                      </div>
                      <h3>Simulated execution</h3>
                      <p>
                        Decisions are recorded before entry. Historical entries
                        use the next hourly open with adverse slippage. Live
                        responses arriving after the planned entry are excluded.
                      </p>
                      <dl className="method-values">
                        <div>
                          <dt>Taker fee, each side</dt>
                          <dd>0.05%</dd>
                        </div>
                        <div>
                          <dt>Slippage, each side</dt>
                          <dd>0.02%</dd>
                        </div>
                        <div>
                          <dt>Funding</dt>
                          <dd>Observed payments during the position</dd>
                        </div>
                        <div>
                          <dt>Stop gaps</dt>
                          <dd>Filled at the worse of stop or next open</dd>
                        </div>
                        <div>
                          <dt>Liquidation approximation</dt>
                          <dd>Mark price, fixed 0.5% maintenance margin</dd>
                        </div>
                      </dl>
                      <p className="small-note">
                        Hourly bars cannot reproduce an exchange fill or an
                        intrahour sequence. Stops can exceed the 2% risk budget.
                        No brokerage or exchange account is connected.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="method-icon">
                        <FileText size={24} />
                      </div>
                      <h3>Sources and evaluation</h3>
                      <p>
                        Daily data uses public Kraken Futures prices, marks and
                        hourly funding. Archived backtests use Binance. Both
                        sources require no account. Timestamps, model outputs
                        and provider usage are retained.
                      </p>
                      <dl className="method-values">
                        <div>
                          <dt>Historical rule benchmark</dt>
                          <dd>{report.days} sessions, fixed parameters</dd>
                        </div>
                        <div>
                          <dt>Historical model replay</dt>
                          <dd>Exploratory, separate from forward results</dd>
                        </div>
                        <div>
                          <dt>Forward observations</dt>
                          <dd>Recorded before entry, then settled</dd>
                        </div>
                        <div>
                          <dt>Missing or failed response</dt>
                          <dd>Excluded, never replaced</dd>
                        </div>
                      </dl>
                      <div className="method-links">
                        <a href="/api/source-health" target="_blank">
                          Data checks <ExternalLink size={13} />
                        </a>
                        <a href="/openapi.json" target="_blank">
                          OpenAPI <ExternalLink size={13} />
                        </a>
                        <a
                          href="/.well-known/mcp/server-card.json"
                          target="_blank"
                        >
                          MCP <ExternalLink size={13} />
                        </a>
                      </div>
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </main>
        <footer className="statusbar">
          <span className={`status-source ${state?.stale ? "warning" : ""}`}>
            <span />{" "}
            {state?.stale ? "Delayed market data" : "Public market data"}
          </span>
          <span>
            {state ? `Updated ${time(state.collectedAt)}` : "Connecting"}
          </span>
          <button onClick={() => changeView("method")}>
            Method & limits <Info size={12} />
          </button>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile workspace">
        {NAV.map((n) => (
          <button
            key={n.id}
            aria-current={view === n.id ? "page" : undefined}
            onClick={() => changeView(n.id)}
          >
            <n.icon size={20} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      <dialog
        ref={detail}
        aria-labelledby="decision-title"
        onClose={() => setDialog(null)}
      >
        <div className="dialog-heading">
          <h2 id="decision-title">Recorded decision</h2>
          <button
            className="icon-button"
            aria-label="Close decision"
            onClick={() => detail.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        {dialog && (
          <>
            <span className="mini-label">
              {state?.models.find((m) => m.id === dialog.model)?.name} ·{" "}
              {dialog.cohort}
            </span>
            <h3>
              {dialog.decision
                ? actionLabel(dialog.decision.action)
                : dialog.status === "failed"
                  ? "Request failed"
                  : "Awaiting completion"}
            </h3>
            {dialog.status === "late" && (
              <p className="small-note">
                Late response. Excluded from performance.
              </p>
            )}
            {Date.now() >= dialog.entry_after + 86_400_000 && (
              <p className="small-note">This observation has expired.</p>
            )}
            {dialogPlan && (
              <>
                <dl className="plan-values dialog-plan">
                  <div>
                    <dt>Reference price</dt>
                    <dd>{money(dialogPlan.entry)}</dd>
                  </div>
                  <div>
                    <dt>Stop level</dt>
                    <dd>{money(dialogPlan.stop)}</dd>
                  </div>
                  <div>
                    <dt>Notional / $10,000</dt>
                    <dd>{money(dialogPlan.notional)}</dd>
                  </div>
                  <div>
                    <dt>Collateral</dt>
                    <dd>{money(dialogPlan.collateral)}</dd>
                  </div>
                  <div>
                    <dt>Stop risk, before gaps</dt>
                    <dd>2% of equity</dd>
                  </div>
                  <div>
                    <dt>Planned entry</dt>
                    <dd>
                      {date(dialog.entry_after)} · {time(dialog.entry_after)}
                    </dd>
                  </div>
                  <div>
                    <dt>Time exit</dt>
                    <dd>
                      {date(dialog.entry_after + 86_400_000)} ·{" "}
                      {time(dialog.entry_after + 86_400_000)}
                    </dd>
                  </div>
                </dl>
                <button className="secondary copy-plan" onClick={copy}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? "Plan copied" : "Copy paper plan"}
                </button>
                <p className="small-note">
                  Reference levels. Funding and price gaps can increase losses.
                </p>
              </>
            )}
            <p>
              {dialog.decision?.reason ??
                dialog.error ??
                "Request awaiting completion."}
            </p>
            <dl className="method-values">
              <div>
                <dt>Snapshot</dt>
                <dd>
                  {date(dialog.snapshot_at)} {time(dialog.snapshot_at)}
                </dd>
              </div>
              <div>
                <dt>Response recorded</dt>
                <dd>{time(dialog.published_at)}</dd>
              </div>
              <div>
                <dt>Settled P&amp;L</dt>
                <dd>
                  {dialog.result ? money(dialog.result.pnl) : "Not settled"}
                </dd>
              </div>
            </dl>
            <details className="technical-details">
              <summary>Request details</summary>
              <p>
                Latency {fmt(dialog.latency_ms / 1000)} s · Provider cost $
                {fmt(dialog.cost, 5)}
              </p>
            </details>
            <a href="/api/decisions" target="_blank">
              Open complete journal <ExternalLink size={14} />
            </a>
          </>
        )}
      </dialog>
    </div>
  );
}
function actionLabel(action?: string) {
  if (!action) return "No position";
  if (action === "CASH") return "Cash";
  const [asset, leverage] = action.split("_");
  return `Long ${asset} · ${leverage?.replace("X", "×")}`;
}
function makePlan(d: any, s: any) {
  if (!s) return null;
  const [asset, lev] = d.action.split("_"),
    leverage = Number(lev[0]),
    entry = s.assets[asset].price,
    stopPct = s.assets[asset].stopPct;
  const collateral = Math.min(10000, 200 / (leverage * (stopPct + 0.0014)));
  return {
    entry,
    stop: entry * (1 - stopPct),
    leverage,
    collateral,
    notional: collateral * leverage,
  };
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Chart({
  data,
  label,
  price = false,
}: {
  data: Curve[];
  label: string;
  price?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => setHover(null), [data.length, label]);
  const width = 760,
    height = 240,
    pad = 12;
  if (data.length < 2)
    return (
      <div className="chart-empty">
        <Activity size={23} />
        <span>No settled curve yet</span>
      </div>
    );
  const min = Math.min(...data.map((d) => d.equity)),
    max = Math.max(...data.map((d) => d.equity)),
    span = max - min || 1;
  const x = (i: number) => pad + (i / (data.length - 1)) * (width - 2 * pad),
    y = (v: number) => height - 20 - ((v - min) / span) * (height - 45);
  const active = hover !== null && hover < data.length ? hover : null;
  const points = data.map((d, i) => `${x(i)},${y(d.equity)}`).join(" ");
  const select = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(
      Math.max(
        0,
        Math.min(
          data.length - 1,
          Math.round(((e.clientX - r.left) / r.width) * (data.length - 1)),
        ),
      ),
    );
  };
  return (
    <div className="chart">
      <div className="chart-scale">
        <span>{price ? money(max) : money(max)}</span>
        <span>{money((max + min) / 2)}</span>
        <span>{money(min)}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}. From ${money(data[0].equity)} to ${money(data.at(-1)!.equity)}.`}
        tabIndex={0}
        onFocus={() => setHover(data.length - 1)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            setHover((i) =>
              Math.max(
                0,
                Math.min(
                  data.length - 1,
                  (i ?? data.length - 1) + (e.key === "ArrowLeft" ? -1 : 1),
                ),
              ),
            );
          }
          if (e.key === "Escape") setHover(null);
        }}
        onPointerDown={select}
        onPointerMove={select}
        onPointerLeave={(e) => {
          if (e.pointerType !== "touch") setHover(null);
        }}
      >
        {[25, 120, 220].map((v) => (
          <line
            className="chart-grid"
            key={v}
            x1="0"
            y1={v}
            x2={width}
            y2={v}
          />
        ))}
        <polygon
          className="chart-fill"
          points={`${pad},${height} ${points} ${width - pad},${height}`}
        />
        <polyline
          className="chart-line"
          points={points}
          vectorEffect="non-scaling-stroke"
        />
        {active !== null && (
          <>
            <line
              className="crosshair"
              x1={x(active)}
              x2={x(active)}
              y1="0"
              y2={height}
            />
            <circle
              className="chart-dot"
              cx={x(active)}
              cy={y(data[active].equity)}
              r="4"
            />
          </>
        )}
      </svg>
      {active !== null && (
        <span className="chart-tooltip" role="status">
          {date(data[active].t)} · {time(data[active].t)} ·{" "}
          {money(data[active].equity)}
        </span>
      )}
      <div className="chart-dates">
        <span>{date(data[0].t)}</span>
        <span>{date(data[Math.floor(data.length / 2)].t)}</span>
        <span>{date(data.at(-1)!.t)}</span>
      </div>
    </div>
  );
}

if ("modelContext" in navigator) {
  const context = (navigator as any).modelContext;
  context.registerTool?.({
    name: "read_crp_positions",
    description:
      "Read recorded CRP paper positions. Does not place orders or invoke a paid model.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    execute: async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await (await fetch("/api/state")).json()),
        },
      ],
    }),
  });
}
createRoot(document.getElementById("root")!).render(<App />);
