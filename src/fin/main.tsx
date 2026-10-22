import { t, useLanguage, setLanguage } from "./i18n";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Layers,
  MoreHorizontal,
  Search,
  TrendingUp,
} from "lucide-react";
import "@fontsource-variable/public-sans";
import { InstallPrompt } from "../InstallPrompt";
import { MarketChart, type MarketPoint } from "./MarketChart";
import { Sheet } from "./Sheet";
import { useTracker } from "./useTracker";
import {
  euro,
  number,
  percent,
  signedEuro,
  date,
  observedTime,
} from "./format";
import type { Tracked, Tracker } from "./tracker-types";
import "./style.css";
const routes = [
  ["/", "Sélection", TrendingUp],
  ["/positions/", "Positions", Layers],
  ["/resultats/", "Résultats", ChartNoAxesCombined],
] as const;
const gain = (n: number | null) =>
  n === null || n === 0 ? "" : n < 0 ? "negative" : "positive";
const money = (n: number | null) => (n === null ? t("Indisponible") : euro(n, 2));
const probability = (n: number | null) => (n === null ? "—" : percent(n, 0));
const reason = {
  target: "Objectif atteint",
  stop: "Seuil de perte atteint",
  time: "20 séances écoulées",
};
const stateName = (p: Tracked) =>
  p.exit
    ? t("Clôturée")
    : p.status === "unavailable"
      ? t("Prix indisponible")
      : p.status === "overdue"
        ? t("Sortie en attente")
        : t("En cours");
function usePageSize(key: string, rowHeight = 88) {
  const [node, setNode] = useState<HTMLDivElement | null>(null),
    [size, setSize] = useState(3);
  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([e]) =>
      setSize(
        Math.max(
          1,
          Math.floor(
            e.contentRect.height /
              ((rowHeight * parseFloat(getComputedStyle(node).fontSize)) / 16),
          ),
        ),
      ),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, key, rowHeight]);
  return { ref: setNode, size };
}
function App() {
  useLanguage();
  const { data, error } = useTracker();
  const [url, setUrl] = useState(() => location.pathname + location.search),
    [query, setQuery] = useState(""),
    [day, setDay] = useState(""),
    [filter, setFilter] = useState("open"),
    [page, setPage] = useState(0),
    [menu, setMenu] = useState(false),
    [search, setSearch] = useState(false);
  const path = url.split("?")[0],
    selectedId = new URLSearchParams(url.split("?")[1] ?? "").get("w");
  const title =
    path === "/positions/"
      ? t("Positions")
      : path === "/resultats/"
        ? t("Résultats")
        : path === "/methode/"
          ? t("Méthode")
          : t("Sélection");
  const main = useRef<HTMLElement>(null),
    { ref: listRef, size } = usePageSize(path);
  const go = (to: string) => {
    history.pushState({}, "", to);
    setUrl(to);
  };
  const link = (to: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (to.split("?")[0] !== path) {
      setQuery("");
      setPage(0);
    }
    go(to);
  };
  useEffect(() => {
    const pop = () => setUrl(location.pathname + location.search);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    document.title = title + " · Fin";
  }, [title]);
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
  }, [path]);
  const all = data?.positions ?? [],
    batches = [...(data?.batches ?? [])].reverse(),
    activeDay = day || batches[0]?.day;
  useEffect(() => {
    const p = data?.positions.find((p) => p.id === selectedId);
    if (!p) return;
    if (path === "/") setDay(p.day);
    if (path === "/positions/") setFilter(p.exit ? "closed" : "open");
  }, [selectedId, data, path]);
  let rows = (
    path === "/positions/"
      ? all.filter(
          (p) => filter === "all" || (filter === "closed" ? !!p.exit : !p.exit),
        )
      : all.filter((p) => p.day === activeDay)
  )
    .filter((p) =>
      (p.product.underlying + " " + p.product.id + " " + p.product.isin)
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      path === "/" ? a.rank - b.rank : b.selectedAt.localeCompare(a.selectedAt),
    );
  const pages = Math.max(1, Math.ceil(rows.length / size)),
    currentPage = Math.min(page, pages - 1),
    visible = rows.slice(currentPage * size, (currentPage + 1) * size);
  const selected = all.find((p) => p.id === selectedId) ?? visible[0];
  useEffect(() => {
    if (!selectedId || !matchMedia("(max-width:840px)").matches) return;
    const t = requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(".analysis")
        ?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(t);
  }, [selectedId]);
  const previousSelected = useRef<string | null>(null);
  useEffect(() => {
    if (previousSelected.current && !selectedId) {
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(".position-row")
          ?.focus({ preventScroll: true }),
      );
    }
    previousSelected.current = selectedId;
  }, [selectedId]);
  return (
    <div className="app">
      <a className="skip-link" href="#content">
        {t("Aller au contenu")}</a>
      <aside className="sidebar">
        <a className="brand" href="/" onClick={(e) => link("/", e)}>
          Fin
        </a>
        <nav aria-label={t("Navigation principale")}>
          {routes.map(([to, label, Icon]) => (
            <a
              key={to}
              href={to}
              onClick={(e) => link(to, e)}
              aria-current={path === to ? "page" : undefined}
            >
              <Icon size={22} aria-hidden="true" />
              <span>{t(label)}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a
            href="/methode/"
            onClick={(e) => link("/methode/", e)}
            aria-current={path === "/methode/" ? "page" : undefined}
          >
            <BookOpen size={20} aria-hidden="true" />
            {t("Méthode")}</a>
        </div>
      </aside>
      <main
        ref={main}
        id="content"
        tabIndex={-1}
        className={`workspace ${selectedId ? "is-instrument" : ""}`}
      >
        <h1 className="visually-hidden">{title}</h1>
        <header className="view-toolbar">
          {path === "/" || path === "/positions/" ? (
            <>
              {path === "/" ? (
                <select
                  aria-label={t("Jour de sélection")}
                  value={activeDay ?? ""}
                  onChange={(e) => {
                    setDay(e.target.value);
                    setPage(0);
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
                    <option value="">{t("Sélection")}</option>
                  )}
                </select>
              ) : (
                <select
                  aria-label={t("État des positions")}
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(0);
                    go("/positions/");
                  }}
                >
                  <option value="open">{t("En cours")}</option>
                  <option value="closed">{t("Clôturées")}</option>
                  <option value="all">{t("Toutes")}</option>
                </select>
              )}
              <div className="toolbar-actions">
                <LanguageSwitch />
                <button
                  className={`icon-button ${query ? "active" : ""}`}
                  aria-label={t("Rechercher un warrant")}
                  onClick={() => setSearch(true)}
                >
                  <Search size={22} aria-hidden="true" />
                </button>
                <button
                  className="icon-button"
                  aria-label={t("Menu de l’application")}
                  onClick={() => setMenu(true)}
                >
                  <MoreHorizontal size={24} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="view-name">{title}</span>
              <div className="toolbar-actions">
              <LanguageSwitch />
              <button
                className="icon-button"
                aria-label={t("Menu de l’application")}
                onClick={() => setMenu(true)}
              >
                <MoreHorizontal size={24} aria-hidden="true" />
              </button>
              </div>
            </>
          )}
        </header>
        <div className="network-status" role="status">
          {(error ? t(error) : "") ||
            (data?.health.stale
              ? t("Collecte en retard. Derniers relevés conservés.")
              : "")}
        </div>
        {!data ? (
          <div className="empty-state" role="status">
            {error ? t("Reconnexion en cours…") : t("Chargement…")}
          </div>
        ) : (
          <>
            {(path === "/" || path === "/positions/") && (
              <div
                className={`instrument-layout ${selectedId ? "detail-open" : ""}`}
              >
                <section
                  className="selection-list"
                  aria-label={
                    path === "/" ? t("Sélections du jour") : t("Positions simulées")
                  }
                >
                  <div ref={listRef} className="list-viewport">
                    {visible.length ? (
                      visible.map((p) => (
                        <a
                          key={p.id}
                          href={path + "?w=" + encodeURIComponent(p.id)}
                          onClick={(e) =>
                            link(path + "?w=" + encodeURIComponent(p.id), e)
                          }
                          className={`position-row ${selected?.id === p.id ? "selected" : ""}`}
                          aria-current={
                            selected?.id === p.id ? "true" : undefined
                          }
                        >
                          <strong>
                            {p.product.underlying}{" "}
                            <span>
                              {p.product.direction === "call" ? "Call" : "Put"}
                            </span>
                          </strong>
                          <b
                            className={gain(
                              path === "/" ? p.prediction.expected : p.pnl,
                            )}
                          >
                            {path === "/"
                              ? signedEuro(p.prediction.expected)
                              : p.pnl === null
                                ? "—"
                                : signedEuro(p.pnl)}
                          </b>
                          <span className="instrument-code">
                            {p.product.id}
                          </span>
                          {path === "/positions/" && (
                            <span>{stateName(p)}</span>
                          )}
                        </a>
                      ))
                    ) : (
                      <div className="empty-state">
                        <h2>
                          {query
                            ? t("Aucun résultat")
                            : path === "/positions/" && filter === "closed"
                              ? t("Aucune clôture")
                              : t("Aucune sélection")}
                        </h2>
                        {query && (
                          <button
                            className="button"
                            onClick={() => setQuery("")}
                          >
                            {t("Effacer la recherche")}</button>
                        )}
                      </div>
                    )}
                  </div>
                  <Pager
                    page={currentPage}
                    pages={pages}
                    onPage={(n) => {
                      setPage(n);
                      if (selectedId) go(path);
                    }}
                  />
                </section>
                {selected &&
                (!query || rows.some((p) => p.id === selected.id)) ? (
                  <section
                    className="analysis"
                    tabIndex={-1}
                    aria-label={t("Analyse du warrant")}
                  >
                    <Instrument
                      key={selected.id}
                      entry={selected}
                      series={data.series}
                      daily={path === "/"}
                      onBack={() => go(path)}
                    />
                  </section>
                ) : null}
              </div>
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
      </main>
      <Sheet open={menu} title="Fin" onClose={() => setMenu(false)}>
        <div className="app-menu">
          <button
            onClick={() => {
              setMenu(false);
              go("/methode/");
            }}
          >
            <BookOpen size={22} aria-hidden="true" />
            {t("Méthode")}</button>
          <a href="/research/tracker.json" download>
            <Download size={22} aria-hidden="true" />
            {t("Exporter le journal")}</a>
          <InstallPrompt />
        </div>
      </Sheet>
      <Sheet
        open={search}
        title={t("Rechercher un warrant")}
        onClose={() => setSearch(false)}
      >
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setSearch(false);
          }}
        >
          <label htmlFor="warrant-search">{t("Code, ISIN ou sous-jacent")}</label>
          <input
            id="warrant-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="primary" type="submit">
            {t("Afficher")}</button>
        </form>
      </Sheet>
    </div>
  );
}
function LanguageSwitch({ mobile = false }: { mobile?: boolean }) {
  const language = useLanguage();
  const target = language === "fr" ? "en" : "fr";
  const label = target === "en" ? "Switch to English" : "Passer en français";
  return (
    <button
      className={`icon-button language-switch ${mobile ? "mobile-language" : ""}`}
      onClick={() => setLanguage(target)}
      aria-label={label}
      title={label}
      lang={target}
    >
      {target.toUpperCase()}
    </button>
  );
}
function Pager({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (n: number) => void;
}) {
  return pages > 1 ? (
    <div className="pagination">
      <button
        className="icon-button"
        disabled={!page}
        aria-label={t("Page précédente")}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft size={22} aria-hidden="true" />
      </button>
      <span>
        {page + 1} / {pages}
      </span>
      <button
        className="icon-button"
        disabled={page >= pages - 1}
        aria-label={t("Page suivante")}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight size={22} aria-hidden="true" />
      </button>
    </div>
  ) : null;
}
function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function Instrument({
  entry: p,
  series,
  daily,
  onBack,
}: {
  entry: Tracked;
  series: Tracker["series"];
  daily: boolean;
  onBack: () => void;
}) {
  const [sheet, setSheet] = useState(""),
    [positionPage, setPositionPage] = useState(0),
    [forecastPage, setForecastPage] = useState(0),
    [kind, setKind] = useState("underlying");
  const history = series?.underlying[p.product.underlying],
    warrant = series?.warrant[p.product.isin] ?? [];
  const market: MarketPoint[] = history
    ? [
        ...history.dates.slice(-252).map((at, i) => ({
          at,
          value:
            history.closes[
              history.closes.length - Math.min(252, history.closes.length) + i
            ],
        })),
        ...(history.spotAt && history.spot > 0
          ? [{ at: history.spotAt, value: history.spot }]
          : []),
      ]
    : [];
  const raw =
      kind === "underlying"
        ? market
        : kind === "warrant"
          ? warrant
          : p.marks.map((m) => ({ at: m.at, value: m.value })),
    points = p.exit
      ? raw.filter((m) => Date.parse(m.at) <= Date.parse(p.exit!.at))
      : raw;
  const pred = p.prediction;
  const positionFacts: [string, React.ReactNode][][] = [
    [
      [t("Mise initiale"), money(1000)],
      [t("Achat"), `${p.quantity} × ${euro(p.product.ask, 3)}`],
      [t("Frais d’achat"), money(p.entryFee)],
      [t("Espèces"), money(p.cash)],
    ],
    [
      ["ISIN", p.product.isin],
      ["Strike", `${number(p.product.strike, 2)} ${p.product.currency}`],
      [t("Échéance"), date(p.product.expiry, true)],
      [t("Parité"), `1 / ${number(1 / p.product.ratio, 0)}`],
    ],
    [
      [t("Valeur nette"), money(p.value)],
      [t("Perte maximale"), money(p.cost)],
      [t("Sortie"), p.exit ? date(p.exit.at, true) : date(p.dueDay, true)],
      [t("Règle"), p.exit ? t(reason[p.exit.reason]) : t("+100 % ou −50 %")],
    ],
  ];
  const forecastFacts: [string, React.ReactNode][][] = [
    [
      [t("Scénario bas · P10"), signedEuro(pred.p10)],
      [t("Scénario médian"), signedEuro(pred.median)],
      [t("Scénario haut · P90"), signedEuro(pred.p90)],
      [t("Gain moyen"), signedEuro(pred.expected)],
    ],
    [
      [t("Probabilité de gain"), probability(pred.profit)],
      [t("Atteindre +100 %"), probability(pred.double)],
      [t("Volatilité −20 %"), signedEuro(pred.stressExpected)],
      [t("Scénarios"), number(pred.samples, 0)],
    ],
    [
      [t("Historique arrêté au"), date(pred.historyThrough, true)],
      [t("Volatilité implicite"), percent(pred.impliedVol, 1)],
      ["EUR/USD", number(pred.fx, 4)],
      [t("Prévision figée le"), date(p.day, true)],
    ],
  ];
  return (
    <>
      <header className="instrument-toolbar">
        <button
          className="icon-button back-button"
          onClick={onBack}
          aria-label={t("Retour à la liste")}
        >
          <ArrowLeft size={24} aria-hidden="true" />
        </button>
        <h2>
          {p.product.underlying}{" "}
          <span>{p.product.direction === "call" ? "Call" : "Put"}</span>
        </h2>
        <LanguageSwitch mobile />
        <a
          className="icon-button broker-link"
          href={p.product.brokerUrl ?? p.product.sourceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={t("Ouvrir ce warrant chez BoursoBank")}
        >
          <ArrowUpRight size={24} aria-hidden="true" />
        </a>
      </header>
      <div className="instrument-summary">
        <div>
          <div className="metric-label">
            <span>{daily ? t("Gain moyen prévu") : t("Valeur de la position")}</span>
            <button
              className="icon-button"
              aria-label={
                daily
                  ? t("Comprendre le gain moyen prévu")
                  : t("Comprendre la valorisation")
              }
              onClick={() => setSheet("estimate")}
            >
              <Info size={20} aria-hidden="true" />
            </button>
          </div>
          <strong className={daily ? gain(pred.expected) : ""}>
            {daily ? signedEuro(pred.expected) : money(p.value)}
          </strong>
        </div>
        <div className="probability">
          <span>{daily ? t("Probabilité de gain") : stateName(p)}</span>
          <strong className={daily ? "" : gain(p.pnl)}>
            {daily
              ? probability(pred.profit)
              : p.pnl === null
                ? "—"
                : signedEuro(p.pnl)}
          </strong>
        </div>
      </div>
      <div className="chart-source">
        <select
          aria-label={t("Série affichée")}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="underlying">
            {p.product.underlying}{t(" · Sous-jacent ($)")}
          </option>
          <option value="warrant">{p.product.id}{t(" · Warrant (€)")}</option>
          <option value="capital">{t("Capital simulé (€)")}</option>
        </select>
        <button
          className="icon-button"
          aria-label={t("Source et date des cours")}
          onClick={() => setSheet("source")}
        >
          <Info size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="chart-stage">
        {points.length > 1 ? (
          <MarketChart
            key={kind}
            points={points}
            selectedDay={p.day}
            name={
              kind === "underlying"
                ? p.product.underlying + t(" · sous-jacent")
                : kind === "warrant"
                  ? p.product.id + t(" · prix bid du warrant")
                  : t("Capital simulé")
            }
            unit={kind === "underlying" ? "$" : "€"}
            initial={
              kind === "capital"
                ? 1000
                : kind === "warrant"
                  ? p.product.ask
                  : pred.spot
            }
          />
        ) : (
          <div className="empty-state">
            <strong>
              {kind === "warrant" ? euro(p.latest.bid, 3) : money(p.value)}
            </strong>
            <p>{t("Un seul relevé disponible.")}</p>
          </div>
        )}
      </div>
      <footer className="instrument-actions">
        <button
          className="button"
          onClick={() => {
            setPositionPage(0);
            setSheet("position");
          }}
        >
          {t("Position")}</button>
        <button
          className="button"
          onClick={() => {
            setForecastPage(0);
            setSheet("forecast");
          }}
        >
          {t("Prévision")}</button>
      </footer>
      <Sheet
        open={sheet === "estimate"}
        title={daily ? t("Gain moyen prévu") : t("Valorisation")}
        onClose={() => setSheet("")}
      >
        <p>
          {daily
            ? t("Gain moyen simulé pour une mise de 1 000 €, après spread et courtage, avant impôts.")
            : t("Valeur de revente simulée au dernier bid disponible, frais et espèces restantes inclus, avant impôts.")}
        </p>
        <p>
          {t("Sortie après 20 séances ou au premier relevé à +100 % / −50 %. Un gap peut dépasser ces seuils.")}</p>
        <p>{t("Modèle non validé. La perte peut atteindre le montant engagé.")}</p>
      </Sheet>
      <Sheet
        open={sheet === "source"}
        title={t("Cours et sélection")}
        onClose={() => setSheet("")}
      >
        <Facts
          rows={[
            [t("Warrant relevé le"), observedTime(p.latest.at)],
            [t("Sélection"), observedTime(p.selectedAt)],
            [t("Mise à jour"), t("Automatique · relevés quotidiens")],
          ]}
        />
        <p>
          {t("Gris : avant sélection. Bleu : depuis la sélection. Le sous-jacent, le bid du warrant et le capital sont des séries distinctes.")}</p>
        <p>
          {t("Les prix publics sont indicatifs ; l’heure de cotation émetteur est inconnue.")}</p>
      </Sheet>
      <Sheet
        open={sheet === "position"}
        title={t("Position")}
        onClose={() => setSheet("")}
      >
        <div
          className="segments"
          role="group"
          aria-label={t("Informations sur la position")}
        >
          {[t("Entrée"), t("Contrat"), t("Sortie")].map((v, i) => (
            <button
              key={v}
              aria-pressed={positionPage === i}
              onClick={() => setPositionPage(i)}
            >
              {t(v)}
            </button>
          ))}
        </div>
        <Facts rows={positionFacts[positionPage]} />
        {positionPage === 1 && (
          <a
            className="button"
            href={p.product.kidUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t("Document émetteur")}<ArrowUpRight size={20} aria-hidden="true" />
          </a>
        )}
      </Sheet>
      <Sheet
        open={sheet === "forecast"}
        title={t("Prévision initiale")}
        onClose={() => setSheet("")}
      >
        <div className="segments" role="group" aria-label={t("Prévision initiale")}>
          {[t("Scénarios"), t("Chances"), t("Modèle")].map((v, i) => (
            <button
              key={v}
              aria-pressed={forecastPage === i}
              onClick={() => setForecastPage(i)}
            >
              {t(v)}
            </button>
          ))}
        </div>
        <Facts rows={forecastFacts[forecastPage]} />
      </Sheet>
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
  const [tab, setTab] = useState("summary"),
    [page, setPage] = useState(0),
    [quality, setQuality] = useState(false),
    { ref, size } = usePageSize("closed", 88);
  const s = d.stats,
    closed = d.positions
      .filter((p) => p.exit)
      .sort((a, b) => b.exit!.at.localeCompare(a.exit!.at)),
    pages = Math.max(1, Math.ceil(closed.length / size)),
    active = Math.min(page, pages - 1);
  return (
    <section className="results">
      <div
        className="segments result-tabs"
        role="group"
        aria-label={t("Résultats affichés")}
      >
        <button
          aria-pressed={tab === "summary"}
          onClick={() => setTab("summary")}
        >
          {t("Bilan")}</button>
        <button
          aria-pressed={tab === "closed"}
          onClick={() => setTab("closed")}
        >
          {t("Clôtures")}</button>
      </div>
      {tab === "summary" ? (
        <div className="result-overview">
          <div className="result-metrics">
            {[
              [t("Gain réalisé"), s.closed ? signedEuro(s.realizedPnl) : "—"],
              [t("Clôtures"), String(s.closed)],
              [t("Gagnantes"), probability(s.winRate)],
              [t("Gain moyen"), s.closed ? signedEuro(s.meanPnl!) : "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <button
            className="button quality-action"
            onClick={() => setQuality(true)}
          >
            {t("Évaluer le modèle")}<ArrowUpRight size={20} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          <div ref={ref} className="closed-list list-viewport">
            {closed.length ? (
              closed.slice(active * size, (active + 1) * size).map((p) => (
                <button
                  key={p.id}
                  className="closed-row"
                  onClick={() => onPosition(p.id)}
                >
                  <span>
                    <strong>{p.product.underlying}</strong>
                    <span className="instrument-code">{p.product.id}</span>
                  </span>
                  <strong className={gain(p.exit!.pnl)}>
                    {signedEuro(p.exit!.pnl)}
                  </strong>
                  <ChevronRight size={22} aria-hidden="true" />
                </button>
              ))
            ) : (
              <div className="empty-state">
                <h2>{t("Aucune clôture")}</h2>
              </div>
            )}
          </div>
          <Pager page={active} pages={pages} onPage={setPage} />
        </>
      )}
      <Sheet
        open={quality}
        title={t("Qualité du modèle")}
        onClose={() => setQuality(false)}
      >
        {s.closed ? (
          <>
            <Facts
              rows={[
                [t("Probabilité moyenne prévue"), probability(s.meanPredicted)],
                [t("Clôtures gagnantes"), probability(s.winRate)],
                [t("Brier · plus bas = mieux"), number(s.brier!, 3)],
                [t("Référence à 50 %"), number(0.25, 3)],
              ]}
            />
            <p>
              {s.closed < 30
                ? t("{count} clôtures sur 30 minimum. Échantillon insuffisant.", { count: s.closed })
                : t("Échantillon exploratoire ; les positions peuvent être corrélées.")}
            </p>
            {s.unavailable > 0 && (
              <p>
                {t("{count} positions sans prix récent restent dans le suivi.", { count: s.unavailable })}
              </p>
            )}
          </>
        ) : (
          <p>{t("Aucune clôture pour comparer les prévisions aux résultats.")}</p>
        )}
      </Sheet>
    </section>
  );
}
const methodSteps = [
  {
    title: "Filtrer",
    text: "Prix récents, offre BoursoMarkets confirmée, spread de 8 % maximum et échéance au moins sept jours après la sortie prévue. Un contrat déjà sélectionné n’est jamais repris.",
  },
  {
    title: "Classer",
    text: "Les trajectoires historiques sont rejouées sur 20 séances, sans leur tendance passée. Le score combine le gain P90 et la plus faible espérance entre cinq ans, un an et volatilité réduite de 20 %.",
  },
  {
    title: "Simuler 1 000 €",
    text: "Jusqu’à trois nouveaux warrants, sur des sous-jacents différents. Une mise indépendante de 1 000 € chacun, achetée à l’ask en unités entières. Les espèces restantes sont conservées.",
  },
  {
    title: "Clôturer",
    text: "Au premier relevé à +100 % ou −50 %, sinon après 20 séances américaines. La sortie utilise le bid observé, même après un gap. Un prix manquant ne devient jamais un résultat nul.",
  },
  {
    title: "Évaluer",
    text: "Prix d’entrée, prévisions et règle restent figés. Toutes les clôtures sont comptées. Le score de Brier compare les probabilités initiales aux résultats. Aucun avantage prédictif n’est encore démontré.",
  },
  {
    title: "Connaître les limites",
    text: "Relevés publics indicatifs ; heure émetteur inconnue. Le modèle suppose taux et dividendes nuls, change et spread constants. Le DIC reste à vérifier avant un achat réel. Aucun ordre n’est envoyé.",
  },
];
function Method({ data: d }: { data: Tracker }) {
  const [step, setStep] = useState(0),
    [sources, setSources] = useState(false);
  return (
    <article className="method">
      <div className="method-step">
        <h2>{t(methodSteps[step].title)}</h2>
        <p>{t(methodSteps[step].text)}</p>
      </div>
      <div className="method-actions">
        <button className="button" onClick={() => setSources(true)}>
          {t("Sources et données")}</button>
        <a
          className="button"
          href="/research/protocole.md"
          target="_blank"
          rel="noreferrer"
        >
          {t("Protocole")}<ArrowUpRight size={20} aria-hidden="true" />
        </a>
      </div>
      <Pager page={step} pages={methodSteps.length} onPage={setStep} />
      <Sheet
        open={sources}
        title={t("Sources et données")}
        onClose={() => setSources(false)}
      >
        <Facts
          rows={[
            [t("Dernier calcul"), observedTime(d.updatedAt)],
            [t("Univers observé"), `${d.scan?.universe ?? 0} warrants`],
            [t("Collecte"), t("Lun.–ven. · 21 h 30 UTC")],
            ["Version", d.rule.version],
          ]}
        />
        <a className="button" href="/research/recherche.zip" download>
          {t("Code et données")}<Download size={20} aria-hidden="true" />
        </a>
        <p>
          TradingView Lightweight Charts™ · Copyright (с) 2025 TradingView, Inc.{" "}
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noreferrer"
          >
            TradingView
          </a>{" "}
          · Apache-2.0.
        </p>
      </Sheet>
    </article>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
