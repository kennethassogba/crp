import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  RefreshCw,
  Search,
  TrendingUp,
  Layers,
  ChartNoAxesCombined,
  BookOpen,
  Download,
} from "lucide-react";
import "@fontsource-variable/public-sans";
import { InstallPrompt } from "../InstallPrompt";
import { MarketChart, type MarketPoint } from "./MarketChart";
import {
  euro,
  percent,
  signedEuro,
  date,
  observedTime,
  number,
} from "./format";
import type { Tracked, Tracker } from "./tracker-types";
import "./style.css";
const routes = [
  ["/", "Sélection", TrendingUp],
  ["/positions/", "Positions", Layers],
  ["/resultats/", "Résultats", ChartNoAxesCombined],
] as const;
const pnlClass = (n: number | null) =>
  n === null || n === 0 ? "" : n < 0 ? "negative" : "positive";
const money = (n: number | null) => (n === null ? "—" : euro(n, 2));
const prob = (n: number | null) => (n === null ? "—" : percent(n, 0));
const exitName = {
  target: "Objectif atteint",
  stop: "Seuil de perte atteint",
  time: "20 séances écoulées",
};
function status(p: Tracked) {
  return p.exit
    ? "Clôturée"
    : p.status === "unavailable"
      ? "Prix indisponible"
      : p.status === "overdue"
        ? "Sortie en attente"
        : "En cours";
}
function App() {
  const [location, setLocation] = useState(
      () => window.location.pathname + window.location.search,
    ),
    [data, setData] = useState<Tracker | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const path = location.split("?")[0],
    selectedId = new URLSearchParams(location.split("?")[1] ?? "").get("w");
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("open"),
    [cohort, setCohort] = useState(""),
    [sort, setSort] = useState("date");
  const main = useRef<HTMLElement>(null),
    requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setBusy(true);
    try {
      const r = await fetch("/api/warrants/tracker", { cache: "no-store" });
      if (!r.ok) throw Error();
      const d = await r.json();
      if (!Array.isArray(d.positions) || !d.stats) throw Error();
      if (version === requestVersion.current) {
        setData(d);
        setError("");
      }
    } catch {
      if (version === requestVersion.current)
        setError("Chargement impossible. Réessaie avec Actualiser.");
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 300000);
    const visible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", visible);
      requestVersion.current++;
    };
  }, [load]);
  useEffect(() => {
    const pop = () =>
      setLocation(window.location.pathname + window.location.search);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const go = (url: string) => {
    if (url === location) return;
    history.pushState({}, "", url);
    setLocation(url);
  };
  const nav = (url: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
      return;
    e.preventDefault();
    go(url);
  };
  useEffect(() => {
    if (!matchMedia("(max-width:850px)").matches) return;
    const frame = requestAnimationFrame(() => {
      if (selectedId) document.querySelector<HTMLElement>(".analysis")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId]);
  const title =
    path === "/positions/"
      ? "Positions"
      : path === "/resultats/"
        ? "Résultats"
        : path === "/methode/"
          ? "Méthode"
          : "Sélection";
  useEffect(() => {
    document.title = title + " · Fin";
    main.current?.focus({ preventScroll: true });
  }, [path, title]);
  const batches = [...(data?.batches ?? [])].reverse(),
    day = cohort || batches[0]?.day;
  const all = data?.positions ?? [],
    daily = all.filter((p) => p.day === day);
  useEffect(() => {
    const p = data?.positions.find((p) => p.id === selectedId);
    if (!p) return;
    if (path === "/positions/") setFilter(p.exit ? "closed" : "open");
    if (path === "/") setCohort(p.day);
  }, [data, selectedId, path]);
  let rows =
    path === "/positions/"
      ? all.filter(
          (p) => filter === "all" || (filter === "closed" ? !!p.exit : !p.exit),
        )
      : daily;
  rows = rows
    .filter((p) =>
      (p.product.id + " " + p.product.underlying + " " + p.product.isin)
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "pnl"
        ? (b.pnl ?? -Infinity) - (a.pnl ?? -Infinity)
        : path === "/"
          ? a.rank - b.rank
          : b.selectedAt.localeCompare(a.selectedAt),
    );
  const chosen = all.find((p) => p.id === selectedId) ?? rows[0],
    showDetail = Boolean(selectedId && chosen),
    detailId = chosen?.id;
  return (
    <div className="app">
      <a className="skip-link" href="#content">
        Aller au contenu
      </a>
      <aside className="sidebar">
        <a className="brand" href="/" onClick={(e) => nav("/", e)}>
          Fin<span>Warrants</span>
        </a>
        <nav aria-label="Navigation principale">
          {routes.map(([url, label, Icon]) => (
            <a
              key={url}
              href={url}
              onClick={(e) => {
                setQuery("");
                nav(url, e);
              }}
              aria-current={path === url ? "page" : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
              {data && url === "/positions/" ? (
                <span className="count">{data.stats.open}</span>
              ) : null}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a
            href="/methode/"
            onClick={(e) => nav("/methode/", e)}
            aria-current={path === "/methode/" ? "page" : undefined}
          >
            <BookOpen size={17} aria-hidden="true" />
            Méthode
          </a>
          <a href="/research/tracker.json" download>
            <Download size={17} aria-hidden="true" />
            Exporter le journal
          </a>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Warrants <ChevronRight size={14} aria-hidden="true" /> {title}
          </span>
          <div className="header-actions">
            <InstallPrompt />
            <a
              className="icon-button method-shortcut"
              href="/methode/"
              onClick={(e) => nav("/methode/", e)}
              aria-label="Méthode de sélection"
            >
              <BookOpen size={16} aria-hidden="true" />
            </a>
            <button
              className="icon-button"
              onClick={load}
              disabled={busy}
              aria-label="Actualiser les données"
            >
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </div>
        </header>
        <main id="content" ref={main} tabIndex={-1}>
          <div className="page-heading">
            <h1>{title}</h1>
            {data && (
              <span className="stamp">
                Relevé {observedTime(data.updatedAt)}
              </span>
            )}
          </div>
          <div role="status" className="network-status">
            {error ? (
              <span className="error">{error}</span>
            ) : busy && !data ? (
              "Chargement des sélections…"
            ) : data?.health.stale ? (
              "Collecte en retard. Les derniers relevés restent datés."
            ) : (
              ""
            )}
          </div>
          {!data && !error ? (
            <div className="loading" aria-hidden="true">
              <div />
              <div />
              <div />
            </div>
          ) : null}
          {data && (
            <>
              {(path === "/" || path === "/positions/") && (
                <>
                  <div className="toolbar">
                    {path === "/" ? (
                      <label className="select-wrap">
                        <span className="visually-hidden">
                          Jour de sélection
                        </span>
                        <select
                          value={day ?? ""}
                          onChange={(e) => {
                            setCohort(e.target.value);
                            go("/");
                          }}
                        >
                          {batches.length ? (
                            batches.map((b) => (
                              <option key={b.day} value={b.day}>
                                {date(b.day, true)}
                              </option>
                            ))
                          ) : (
                            <option value="">Aucune sélection</option>
                          )}
                        </select>
                      </label>
                    ) : (
                      <div
                        className="segments"
                        role="group"
                        aria-label="État des positions"
                      >
                        {[
                          ["open", "En cours"],
                          ["closed", "Clôturées"],
                          ["all", "Toutes"],
                        ].map(([k, label]) => (
                          <button
                            key={k}
                            onClick={() => {
                              setFilter(k);
                              go("/positions/");
                            }}
                            aria-pressed={filter === k}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="toolbar-end">
                      <label className="search">
                        <Search size={15} aria-hidden="true" />
                        <span className="visually-hidden">
                          Rechercher un warrant
                        </span>
                        <input
                          type="search"
                          placeholder="Rechercher"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      {path === "/positions/" && (
                        <label className="select-wrap">
                          <span className="visually-hidden">
                            Trier les positions
                          </span>
                          <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value)}
                          >
                            <option value="date">Récentes</option>
                            <option value="pnl">Gain net</option>
                          </select>
                        </label>
                      )}
                    </div>
                  </div>
                  <div className="list-summary">
                    <span>
                      {path === "/"
                        ? `${daily.length} sélections · 1 000 € chacune`
                        : `${rows.length} positions · 1 000 € à chaque entrée`}
                    </span>
                    {path === "/" && (
                      <a href="/methode/" onClick={(e) => nav("/methode/", e)}>
                        Pourquoi ces warrants{" "}
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                  <div className={`split ${showDetail ? "detail-open" : ""}`}>
                    <section
                      className="position-list"
                      aria-label={
                        path === "/"
                          ? "Sélections du jour"
                          : "Positions simulées"
                      }
                    >
                      <div className="list-head">
                        <span>Warrant</span>
                        <span>{path === "/" ? "Gain prévu¹" : "Gain net"}</span>
                      </div>
                      {rows.length ? (
                        rows.map((p) => (
                          <a
                            key={p.id}
                            className={`position-row ${detailId === p.id ? "selected" : ""}`}
                            href={path + "?w=" + encodeURIComponent(p.id)}
                            onClick={(e) =>
                              nav(path + "?w=" + encodeURIComponent(p.id), e)
                            }
                            aria-current={
                              detailId === p.id ? "true" : undefined
                            }
                          >
                            <div className="row-info">
                              <strong>
                                {p.product.underlying}
                                <span className="direction">
                                  {p.product.direction === "call"
                                    ? "Call"
                                    : "Put"}
                                </span>
                              </strong>
                              <span>
                                {p.product.id} ·{" "}
                                {path === "/"
                                  ? `Échéance ${date(p.product.expiry)}`
                                  : date(p.day)}
                              </span>
                            </div>
                            <div className="row-values">
                              <strong
                                className={pnlClass(
                                  path === "/" ? p.prediction.expected : p.pnl,
                                )}
                              >
                                {path === "/"
                                  ? signedEuro(p.prediction.expected)
                                  : p.pnl === null
                                    ? "—"
                                    : signedEuro(p.pnl)}
                              </strong>
                              <span>
                                {path === "/"
                                  ? `Prob. de gain : ${prob(p.prediction.profit)}`
                                  : status(p)}
                              </span>
                            </div>
                            <ChevronRight size={15} aria-hidden="true" />
                          </a>
                        ))
                      ) : (
                        <div className="empty">
                          <h2>
                            {query
                              ? "Aucun résultat"
                              : path === "/positions/" && filter === "closed"
                                ? "Aucune clôture pour le moment"
                                : "Aucune sélection disponible"}
                          </h2>
                          <p>
                            {query
                              ? "Essaie un code ou un sous-jacent."
                              : path === "/positions/"
                                ? "Les positions restent suivies jusqu’à leur sortie."
                                : `Le prochain relevé retiendra jusqu’à trois nouveaux warrants éligibles.`}
                          </p>
                        </div>
                      )}
                    </section>
                    {chosen &&
                    (!query || rows.some((p) => p.id === chosen.id)) ? (
                      <section
                        className="analysis"
                        tabIndex={-1}
                        aria-label="Analyse du warrant"
                      >
                        <button
                          className="back-button"
                          onClick={() => go(path)}
                        >
                          <ArrowLeft size={16} aria-hidden="true" />
                          Retour à la liste
                        </button>
                        <PositionPanel
                          key={chosen.id}
                          series={data.series}
                          entry={chosen}
                          daily={path === "/"}
                          onFollow={() =>
                            go("/positions/?w=" + encodeURIComponent(chosen.id))
                          }
                        />
                      </section>
                    ) : null}
                  </div>
                  {path === "/" && (
                    <p className="source-note">
                      ¹ Prévision à 20 séances, sorties à +100 % / −50 % au
                      relevé. Modèle non validé.{" "}
                      <a href="/methode/" onClick={(e) => nav("/methode/", e)}>
                        Hypothèses et frais
                      </a>
                    </p>
                  )}
                </>
              )}
              {path === "/resultats/" && (
                <Results
                  data={data}
                  onPosition={(id) =>
                    go("/positions/?w=" + encodeURIComponent(id))
                  }
                />
              )}
              {path === "/methode/" && <Method data={data} />}
            </>
          )}
          {!data && error && (
            <button className="primary" onClick={load}>
              Actualiser
            </button>
          )}
        </main>
      </div>
    </div>
  );
}
function PositionPanel({
  entry: p,
  daily,
  onFollow,
  series,
}: {
  entry: Tracked;
  daily: boolean;
  onFollow: () => void;
  series: Tracker["series"];
}) {
  const [view, setView] = useState<"capital" | "forecast">("capital");
  const [chartType, setChartType] = useState("underlying");
  const pred = p.prediction;
  const warrant = series?.warrant[p.product.isin] ?? [];
  const h = series?.underlying[p.product.underlying];
  const market: MarketPoint[] = h
    ? [
        ...h.dates.slice(-252).map((at, i) => ({
          at: at,
          value: h.closes[h.closes.length - Math.min(h.dates.length, 252) + i],
        })),
        ...(h.spotAt && h.spot > 0 ? [{ at: h.spotAt, value: h.spot }] : []),
      ]
    : [];
  const chart =
    chartType === "underlying"
      ? market
      : chartType === "warrant"
        ? warrant
        : p.marks.map((m) => ({ at: m.at, value: m.value }));
  return (
    <>
      <div className="instrument-heading">
        <div>
          <h2>
            {p.product.underlying}
            <span>{p.product.direction === "call" ? "Call" : "Put"}</span>
          </h2>
          <p>
            {p.product.id} · {p.product.isin}
          </p>
        </div>
        <a
          className="external-link"
          href={p.product.brokerUrl ?? p.product.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Bourso <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </div>
      <div className={`capital ${daily ? "selection-estimate" : ""}`}>
        <span>{daily ? "Gain moyen prévu¹" : "Valeur de la position"}</span>
        <strong className={daily ? pnlClass(pred.expected) : ""}>
          {daily ? signedEuro(pred.expected) : money(p.value)}
        </strong>
        <div className={daily ? "" : pnlClass(p.pnl)}>
          {daily
            ? `${prob(pred.profit)} de probabilité de gain`
            : p.pnl === null
              ? "Valorisation indisponible"
              : `${signedEuro(p.pnl)} (${percent(p.pnl / 1000, 1)})`}
          <span className="status-pill">{status(p)}</span>
        </div>
      </div>
      <div className="panel-tabs" role="group" aria-label="Analyse affichée">
        <button
          aria-pressed={view === "capital"}
          onClick={() => setView("capital")}
        >
          Suivi
        </button>
        <button
          aria-pressed={view === "forecast"}
          onClick={() => setView("forecast")}
        >
          Prévision initiale
        </button>
      </div>
      {view === "capital" ? (
        <>
          <div className="chart-source">
            <label>
              <span className="visually-hidden">Série affichée</span>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                aria-label="Série affichée"
              >
                <option value="underlying">
                  {p.product.underlying} · sous-jacent · USD
                </option>
                <option value="warrant">
                  {p.product.id} · warrant · bid EUR
                </option>
                <option value="capital">Position · capital EUR</option>
              </select>
            </label>
          </div>
          {chart.length > 1 ? (
            <MarketChart
              key={chartType}
              points={chart}
              selectedDay={p.day}
              name={
                chartType === "underlying"
                  ? p.product.underlying + " · sous-jacent"
                  : chartType === "warrant"
                    ? p.product.id + " · prix bid du warrant"
                    : "Capital simulé"
              }
              unit={chartType === "underlying" ? "$" : "€"}
              initial={
                chartType === "capital"
                  ? 1000
                  : chartType === "warrant"
                    ? p.product.ask
                    : p.prediction.spot
              }
            />
          ) : (
            <div className="first-mark">
              <div className="entry-line">
                <span>
                  {chartType === "warrant" ? "Dernier bid" : "Capital initial"}
                </span>
                <strong>
                  {chartType === "warrant" ? money(p.latest.bid) : "1 000,00 €"}
                </strong>
              </div>
              <p>Un seul relevé disponible. Aucun historique reconstitué.</p>
            </div>
          )}
          <dl className="facts">
            <div>
              <dt>Entrée simulée</dt>
              <dd>{observedTime(p.selectedAt)}</dd>
            </div>
            <div>
              <dt>Achat à l’ask</dt>
              <dd>
                {p.quantity} × {euro(p.product.ask, 3)}
              </dd>
            </div>
            <div>
              <dt>Dernier bid</dt>
              <dd>{euro(p.latest.bid, 3)}</dd>
            </div>
            <div>
              <dt>Frais d’entrée / sortie</dt>
              <dd>
                {money(p.entryFee)} / {money(p.latest.fee)}
              </dd>
            </div>
            <div>
              <dt>Espèces restantes</dt>
              <dd>{money(p.cash)}</dd>
            </div>
            <div>
              <dt>Perte maximale</dt>
              <dd>{money(p.cost)}</dd>
            </div>
            <div>
              <dt>{p.exit ? "Sortie" : "Sortie prévue"}</dt>
              <dd>{p.exit ? observedTime(p.exit.at) : date(p.dueDay, true)}</dd>
            </div>
            <div>
              <dt>{p.exit ? "Motif" : "Seuils de sortie"}</dt>
              <dd>{p.exit ? exitName[p.exit.reason] : "+100 % ou −50 %"}</dd>
            </div>
          </dl>
          <p className="source-note">
            Dernier prix relevé {observedTime(p.latest.at)}. Simulation au bid,
            avant impôts.
          </p>
        </>
      ) : (
        <>
          <div className="forecast-range">
            <h3>Gain net simulé</h3>
            <div>
              <span>Scénario bas · P10</span>
              <strong className={pnlClass(pred.p10)}>
                {signedEuro(pred.p10)}
              </strong>
            </div>
            <div>
              <span>Scénario médian</span>
              <strong className={pnlClass(pred.median)}>
                {signedEuro(pred.median)}
              </strong>
            </div>
            <div>
              <span>Scénario haut · P90</span>
              <strong className={pnlClass(pred.p90)}>
                {signedEuro(pred.p90)}
              </strong>
            </div>
          </div>
          <dl className="facts">
            <div>
              <dt>Gain moyen prévu</dt>
              <dd className={pnlClass(pred.expected)}>
                {signedEuro(pred.expected)}
              </dd>
            </div>
            <div>
              <dt>Probabilité de gain</dt>
              <dd>{prob(pred.profit)}</dd>
            </div>
            <div>
              <dt>Atteindre +100 %</dt>
              <dd>{prob(pred.double)}</dd>
            </div>
            <div>
              <dt>Volatilité −20 %</dt>
              <dd className={pnlClass(pred.stressExpected)}>
                {signedEuro(pred.stressExpected)}
              </dd>
            </div>
            <div>
              <dt>Scénarios historiques</dt>
              <dd>{number(pred.samples, 0)}</dd>
            </div>
            <div>
              <dt>Historique arrêté au</dt>
              <dd>{date(pred.historyThrough, true)}</dd>
            </div>
            <div>
              <dt>Volatilité implicite</dt>
              <dd>{percent(pred.impliedVol, 1)}</dd>
            </div>
          </dl>
          <p className="source-note">
            Prévision figée le {date(p.day, true)}. Scénarios corrélés, change
            fixe. Aucun avantage prédictif démontré.
          </p>
        </>
      )}
      <div className="panel-actions">
        {daily && (
          <button className="primary" onClick={onFollow}>
            Suivre la position <ArrowUpRight size={15} aria-hidden="true" />
          </button>
        )}
        <a href={p.product.kidUrl} target="_blank" rel="noreferrer">
          Document émetteur <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </div>
    </>
  );
}
function Results({
  data: d,
  onPosition,
}: {
  data: Tracker;
  onPosition: (id: string) => void;
}) {
  const s = d.stats,
    closed = d.positions
      .filter((p) => p.exit)
      .sort((a, b) => b.exit!.at.localeCompare(a.exit!.at));
  return (
    <div className="results">
      <div className="result-summary">
        <div>
          <span>Gain réalisé</span>
          <strong className={pnlClass(s.realizedPnl)}>
            {s.closed ? signedEuro(s.realizedPnl) : "—"}
          </strong>
        </div>
        <div>
          <span>Positions clôturées</span>
          <strong>
            {s.closed}
            <small> / {s.selected}</small>
          </strong>
        </div>
        <div>
          <span>Gagnantes</span>
          <strong>{prob(s.winRate)}</strong>
        </div>
        <div>
          <span>Gain moyen</span>
          <strong>{s.closed ? signedEuro(s.meanPnl!) : "—"}</strong>
        </div>
      </div>
      {s.unavailable > 0 && (
        <p className="source-note">
          {s.unavailable} positions sans prix récent : exclues des gains
          réalisés, conservées dans le suivi.
        </p>
      )}
      <section className="result-section">
        <div className="section-heading">
          <h2>Prévisions face aux résultats</h2>
          <span>
            {s.closed < 30
              ? `${s.closed} / 30 clôtures minimum`
              : "Échantillon exploratoire"}
          </span>
        </div>
        {s.closed ? (
          <>
            <div className="calibration">
              <div className="list-head">
                <span>Gain prévu</span>
                <span>Gain constaté</span>
                <span>Clôtures</span>
              </div>
              {s.calibration
                .filter((c) => c.count)
                .map((c) => (
                  <div className="calibration-row" key={c.low}>
                    <span>{prob(c.predicted)}</span>
                    <span>{prob(c.observed)}</span>
                    <span>{c.count}</span>
                  </div>
                ))}
            </div>
            <dl className="facts">
              <div>
                <dt>Score de Brier · plus bas = mieux</dt>
                <dd>{number(s.brier!, 3)} / 0,250 pour une prévision à 50 %</dd>
              </div>
            </dl>
            <p>
              Les gains réalisés et les probabilités restent exploratoires :
              même sous-jacent, dates proches et petit échantillon.
            </p>
          </>
        ) : (
          <div className="empty">
            <h3>Pas encore de résultat à comparer</h3>
            <p>
              Les probabilités seront comparées aux résultats de chaque clôture.
              Aucun ancien gagnant n’a été ajouté après coup.
            </p>
          </div>
        )}
      </section>
      <section className="result-section">
        <h2>Clôtures</h2>
        {closed.length ? (
          <div className="closed-list">
            {closed.map((p) => (
              <button key={p.id} onClick={() => onPosition(p.id)}>
                <span>
                  <strong>
                    {p.product.underlying} · {p.product.id}
                  </strong>
                  <small>
                    {date(p.day)} → {date(p.exit!.at)} ·{" "}
                    {exitName[p.exit!.reason]}
                  </small>
                </span>
                <strong className={pnlClass(p.exit!.pnl)}>
                  {signedEuro(p.exit!.pnl)}
                </strong>
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <p>Aucune position clôturée.</p>
        )}
      </section>
    </div>
  );
}
function Method({ data: d }: { data: Tracker }) {
  return (
    <article className="method">
      <h2>Sélection et suivi</h2>
      <ol>
        <li>
          <h3>Filtrer</h3>
          <p>
            Warrants standard Société Générale, offre BoursoMarkets confirmée,
            ordre de 1 000 €, spread ≤ 8 %, prix relevé depuis moins de deux
            heures et échéance au moins sept jours après la sortie prévue.
          </p>
        </li>
        <li>
          <h3>Classer</h3>
          <p>
            Chaque trajectoire historique du sous-jacent est rejouée sur 20
            séances, sans sa tendance passée. Le warrant est réévalué chaque
            jour avec une volatilité implicite calibrée sur son prix initial. Le
            score combine à parts égales le gain P90 et la plus faible espérance
            des scénarios cinq ans, un an et volatilité −20 %.
          </p>
          <p>
            Les trois meilleurs scores, avec des sous-jacents différents, sont
            retenus. Un contrat déjà sélectionné n’est jamais repris. Un score
            élevé n’établit pas une espérance positive.
          </p>
        </li>
        <li>
          <h3>Suivre 1 000 €</h3>
          <p>
            Une simulation indépendante par warrant, achat en unités entières à
            l’ask le jour de sélection. Les espèces restantes sont conservées.
            Chaque nouveau bid sert à calculer le prix de sortie net. Aucun
            ordre réel.
          </p>
        </li>
        <li>
          <h3>Clôturer</h3>
          <p>
            Au premier relevé où la valeur atteint 2 000 € ou tombe à 500 €,
            sinon après 20 séances américaines. La sortie utilise le bid
            constaté, même si le seuil a été dépassé. Le suivi quotidien ne
            détecte pas les franchissements entre deux relevés.
          </p>
        </li>
        <li>
          <h3>Mesurer</h3>
          <p>
            Chaque prévision reste figée. Les résultats comptent toutes les
            clôtures, les pertes et les frais. Le score de Brier compare la
            probabilité initiale de gain au résultat observé. Avant 30 clôtures,
            le volume est insuffisant ; au-delà, il ne prouve toujours pas un
            avantage stable.
          </p>
        </li>
      </ol>
      <h2>Données et limites</h2>
      <dl className="facts">
        <div>
          <dt>Dernier calcul</dt>
          <dd>{observedTime(d.updatedAt)}</dd>
        </div>
        <div>
          <dt>Univers observé</dt>
          <dd>{d.scan?.universe ?? 0} warrants · 5 sous-jacents</dd>
        </div>
        <div>
          <dt>Éligibles au dernier calcul</dt>
          <dd>{d.scan?.eligible ?? 0}</dd>
        </div>
        <div>
          <dt>Collecte planifiée</dt>
          <dd>Lundi–vendredi · 21 h 30 UTC</dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd>{d.rule.version}</dd>
        </div>
      </dl>
      <p>
        Les pages publiques Bourso fournissent des bid/ask indicatifs.
        L’horodatage est celui de la lecture, l’heure de cotation émetteur est
        inconnue. Yahoo fournit les historiques du sous-jacent et le change. La
        collecte GitHub peut être retardée ; un échec ne crée ni nouveau prix ni
        résultat fictif.
      </p>
      <p>
        Le modèle suppose des warrants européens standard, taux et dividendes
        nuls, change et spread constants. Les caractéristiques proviennent des
        fiches Bourso ; le DIC est lié, sans validation juridique automatisée.
        Un mouvement de change, de volatilité, un dividende ou un écart de
        cotation peut rendre la prévision fausse.
      </p>
      <p>
        Frais de courtage simulés à 0 € uniquement pour l’offre BoursoMarkets
        confirmée sur la fiche. Le spread est inclus. Pas de fiscalité, de
        slippage supplémentaire ni de garantie d’exécution. La perte peut
        atteindre tout le montant engagé ; aucun appel de marge pour l’achat de
        warrants au comptant.
      </p>
      <p>
        TradingView Lightweight Charts™ · Copyright (с) 2025 TradingView, Inc.{" "}
        <a href="https://www.tradingview.com/">TradingView</a> · Apache-2.0.
      </p>
      <div className="method-links">
        <a href="/research/protocole.md">
          Protocole complet <ArrowUpRight size={15} aria-hidden="true" />
        </a>
        <a href="/research/recherche.zip" download>
          Code et données <Download size={15} aria-hidden="true" />
        </a>
        <a
          href="https://github.com/kennethassogba/crp"
          target="_blank"
          rel="noreferrer"
        >
          GitHub <ArrowUpRight size={15} aria-hidden="true" />
        </a>
        <a href="/openapi.json">API</a>
      </div>
    </article>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
