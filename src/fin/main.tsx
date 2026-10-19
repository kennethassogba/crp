import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Database,
  Github,
  LayoutGrid,
  ListFilter,
  Menu,
  RefreshCw,
  X,
  Bookmark,
} from "lucide-react";
import "@fontsource-variable/public-sans";
import "./style.css";
import { Screener } from "./Screener";
import { Method } from "./Method";
import { Journal } from "./Journal";
import { Crp } from "./Crp";
import { InstallPrompt } from "../InstallPrompt";
import { date } from "./format";
import type { Dataset, Observation } from "./types";
import type { CrpState, Report } from "./Crp";

const routes: Record<string, string> = {
  "/": "Vue d’ensemble",
  "/warrants/": "Warrants",
  "/warrants/methode/": "Méthode · warrants",
  "/warrants/suivi/": "Analyses enregistrées",
  "/crp/": "CRP",
  "/crp/modeles/": "CRP",
  "/crp/historique/": "Historique · CRP",
  "/crp/methode/": "Méthode · CRP",
  "/donnees/": "Données",
};
function currentPath() {
  const hash = location.hash.slice(1);
  if (
    location.pathname === "/crp/" &&
    ["models", "backtest", "method"].includes(hash)
  )
    return {
      models: "/crp/modeles/",
      backtest: "/crp/historique/",
      method: "/crp/methode/",
    }[hash]!;
  return location.pathname;
}
function App() {
  const [path, setPath] = useState(currentPath),
    [menu, setMenu] = useState(false),
    [dataset, setDataset] = useState<Dataset | null>(null),
    [state, setState] = useState<CrpState | null>(null),
    [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState(""),
    [crpError, setCrpError] = useState(""),
    [refreshing, setRefreshing] = useState(false),
    [journal, setJournal] = useState<Observation[]>([]),
    [storageError, setStorageError] = useState("");
  const navDialog = useRef<HTMLDialogElement>(null),
    first = useRef(true);
  const [undo, setUndo] = useState<Observation | null>(null);
  async function load() {
    setRefreshing(true);
    setError("");
    setCrpError("");
    await Promise.allSettled([
      fetch("/research/snapshot.json", { cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw Error();
          return r.json();
        })
        .then((next) =>
          setDataset((previous) => (previous?.importedAt ? previous : next)),
        )
        .catch(() =>
          setError("Le catalogue n’a pas pu être chargé. Réessayer."),
        ),
      Promise.all([
        fetch("/api/state", { cache: "no-store" }),
        fetch("/api/backtest", { cache: "no-store" }),
      ])
        .then(async ([a, b]) => {
          if (!a.ok || !b.ok) throw Error();
          setState(await a.json());
          setReport(await b.json());
        })
        .catch(() => setCrpError("CRP est indisponible. Réessayer.")),
    ]);
    setRefreshing(false);
  }
  useEffect(() => {
    load();
    try {
      const rows = JSON.parse(
        localStorage.getItem("fin-observations-v1") ?? "[]",
      );
      if (Array.isArray(rows)) setJournal(rows);
    } catch {
      setStorageError(
        "Stockage indisponible. Exporter les analyses pour les conserver.",
      );
    }
    const pop = () => setPath(currentPath());
    window.addEventListener("popstate", pop);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 300000);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then(async (registrations) => {
          for (const r of registrations)
            if (new URL(r.scope).pathname === "/crp/") await r.unregister();
          await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        })
        .catch(() => {});
    }
    return () => {
      window.removeEventListener("popstate", pop);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    document.title = `${routes[path] ?? "Fin"} · Fin`;
    if (!first.current) document.querySelector<HTMLElement>("#main")?.focus();
    first.current = false;
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [path]);
  useEffect(() => {
    if (menu) navDialog.current?.showModal();
    else navDialog.current?.close();
  }, [menu]);
  function navigate(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest("a");
    if (
      !a ||
      a.target ||
      a.hasAttribute("download") ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    )
      return;
    const url = new URL(a.href);
    if (url.origin !== location.origin || !routes[url.pathname] || url.hash)
      return;
    e.preventDefault();
    if (url.pathname !== path) {
      history.pushState(null, "", url);
      setPath(url.pathname);
    } else setMenu(false);
  }
  function update(rows: Observation[]) {
    setJournal(rows);
    try {
      localStorage.setItem("fin-observations-v1", JSON.stringify(rows));
    } catch {
      setStorageError(
        "Analyse gardée pour cette session. Exporter pour la conserver.",
      );
    }
  }
  const isCrp = path.startsWith("/crp/");
  const navigation = (mobile = false) => (
    <>
      <div className="workspace-name">
        <a href="/">Fin</a>
        <span>k_eff</span>
        {mobile && (
          <button
            className="icon-button"
            aria-label="Fermer la navigation"
            onClick={() => setMenu(false)}
          >
            <X size={18} />
          </button>
        )}
      </div>
      <nav aria-label={mobile ? "Navigation mobile" : "Navigation principale"}>
        <a href="/" aria-current={path === "/" ? "page" : undefined}>
          <LayoutGrid size={16} />
          Vue d’ensemble
        </a>
        <div className="nav-section">Recherche</div>
        <a
          href="/warrants/"
          aria-current={path === "/warrants/" ? "page" : undefined}
        >
          <ListFilter size={16} />
          Warrants{dataset && <small>{dataset.products.length}</small>}
        </a>
        <a
          href="/crp/"
          aria-current={
            ["/crp/", "/crp/modeles/"].includes(path) ? "page" : undefined
          }
        >
          <Activity size={16} />
          CRP
        </a>
        {isCrp && (
          <div className="subnav">
            <a
              href="/crp/historique/"
              aria-current={path === "/crp/historique/" ? "page" : undefined}
            >
              Historique
            </a>
            <a
              href="/crp/methode/"
              aria-current={path === "/crp/methode/" ? "page" : undefined}
            >
              Règles
            </a>
          </div>
        )}
        <a
          href="/warrants/suivi/"
          aria-current={path === "/warrants/suivi/" ? "page" : undefined}
        >
          <Bookmark size={16} />
          Analyses{journal.length > 0 && <small>{journal.length}</small>}
        </a>
        <div className="nav-section">Références</div>
        <a
          href="/donnees/"
          aria-current={path === "/donnees/" ? "page" : undefined}
        >
          <Database size={16} />
          Données
        </a>
        <a
          href="/warrants/methode/"
          aria-current={path === "/warrants/methode/" ? "page" : undefined}
        >
          <BookOpen size={16} />
          Méthode
        </a>
      </nav>
      <div className="sidebar-bottom">
        <a
          href="https://github.com/kennethassogba/crp"
          target="_blank"
          rel="noreferrer"
        >
          <Github size={15} />
          Code source
          <ArrowUpRight size={12} />
        </a>
        <a href="https://keff.uk" target="_blank" rel="noreferrer">
          keff.uk
          <ArrowUpRight size={12} />
        </a>
      </div>
    </>
  );
  return (
    <div className="fin-shell" onClick={navigate}>
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <aside className="fin-sidebar">{navigation()}</aside>
      <dialog
        ref={navDialog}
        className="nav-dialog"
        aria-label="Navigation"
        onCancel={() => setMenu(false)}
        onClose={() => setMenu(false)}
      >
        {navigation(true)}
      </dialog>
      <div className="fin-workspace">
        <header className="fin-topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Ouvrir la navigation"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            <Menu size={18} />
          </button>
          <div className="breadcrumbs">
            <a href="/">Fin</a>
            <span>/</span>
            <span>{routes[path]}</span>
          </div>
          <div className="header-actions">
            <InstallPrompt />
            <button
              className="icon-button"
              aria-label="Actualiser les données"
              title="Relire les dernières données publiées"
              onClick={load}
              disabled={refreshing}
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className={`fin-main ${isCrp ? "view-crp" : ""}`}
        >
          <div role="status" className={storageError ? "notice" : ""}>
            {storageError}
          </div>
          {path === "/" ? (
            <Overview
              dataset={dataset}
              state={state}
              error={error || crpError}
              retry={load}
            />
          ) : path === "/donnees/" ? (
            <DataPage
              dataset={dataset}
              state={state}
              error={error || crpError}
              retry={load}
            />
          ) : path === "/warrants/methode/" ? (
            <Method />
          ) : path === "/warrants/suivi/" ? (
            <Journal
              rows={journal}
              onDelete={(id) => {
                const row = journal.find((r) => r.id === id);
                setUndo(row ?? null);
                update(journal.filter((r) => r.id !== id));
              }}
            />
          ) : isCrp ? (
            <Crp
              path={path}
              state={state}
              report={report}
              error={crpError}
              retry={load}
            />
          ) : error ? (
            <div className="empty-state" role="alert">
              <h1>Catalogue indisponible</h1>
              <p>{error}</p>
              <button className="button" onClick={load}>
                Réessayer
              </button>
            </div>
          ) : dataset ? null : (
            <div role="status" className="empty-state">
              <h1>Warrants</h1>
              <p>Chargement du catalogue…</p>
            </div>
          )}
          {dataset && (
            <Screener
              active={path === "/warrants/" && !error}
              dataset={dataset}
              setDataset={setDataset}
              onSave={(r) => update([r, ...journal].slice(0, 500))}
            />
          )}
          {undo && (
            <div role="status" className="undo-notice">
              Analyse retirée.
              <button
                onClick={() => {
                  update([undo, ...journal]);
                  setUndo(null);
                }}
              >
                Annuler
              </button>
              <button
                className="icon-button"
                aria-label="Fermer le message"
                onClick={() => setUndo(null)}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
function timestamp(value?: string | number) {
  return value
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      }).format(new Date(value))
    : "Pas encore collecté";
}
function Overview({
  dataset,
  state,
  error,
  retry,
}: {
  dataset: Dataset | null;
  state: CrpState | null;
  error: string;
  retry: () => void;
}) {
  const lastAt =
    state?.decisions
      .filter((r) => r.cohort === "live")
      .reduce((at, r) => Math.max(at, r.snapshot_at), 0) || state?.asOf;
  const lastDay = lastAt ? new Date(lastAt).toISOString().slice(0, 10) : "";
  const runs =
    state?.decisions.filter(
      (r) =>
        r.cohort === "live" &&
        new Date(r.snapshot_at).toISOString().slice(0, 10) === lastDay,
    ) ?? [];
  return (
    <section>
      <div className="page-heading">
        <h1>Vue d’ensemble</h1>
        <span className="muted">Recherche et simulations</span>
      </div>
      {error && (
        <div role="alert" className="notice">
          {error}
          <button onClick={retry}>Réessayer</button>
        </div>
      )}
      <div className="overview-list">
        <a href="/warrants/" className="overview-entry">
          <div>
            <h2>
              Warrants
              <ArrowRight size={17} />
            </h2>
            <p>
              {dataset
                ? `${dataset.products.length} contrats · ${Object.keys(dataset.assets).length} sous-jacents`
                : "Chargement…"}
            </p>
          </div>
          <div>
            <strong>
              {dataset?.quotesCollection?.added ?? 0}
              <small> nouveaux au dernier relevé</small>
            </strong>
            <span>
              Relevé{" "}
              {timestamp(dataset?.quotesCollection?.at ?? dataset?.quoteDate)}
            </span>
          </div>
        </a>
        <a href="/crp/" className="overview-entry">
          <div>
            <h2>
              CRP
              <ArrowRight size={17} />
            </h2>
            <p>Trois modèles · 100 € chacun · simulation</p>
          </div>
          <div>
            <strong>
              {
                runs.filter(
                  (r) =>
                    r.status === "completed" &&
                    state?.models.some((m) => m.id === r.model),
                ).length
              }
              /{state?.models.length ?? 3}
              <small> décisions du {lastDay ? date(lastDay) : "jour"}</small>
            </strong>
            <span>Marché {timestamp(state?.asOf)}</span>
          </div>
        </a>
      </div>
      <section className="overview-note">
        <h2>Derniers relevés</h2>
        <DataRows dataset={dataset} state={state} />
        <a className="text-link" href="/donnees/">
          Voir les sources et les erreurs
          <ArrowRight size={14} />
        </a>
      </section>
    </section>
  );
}
function DataRows({
  dataset,
  state,
}: {
  dataset: Dataset | null;
  state: CrpState | null;
}) {
  const histories = Object.values(dataset?.assets ?? {}),
    last = histories.map((h) => h.dates.at(-1)!).sort()[0];
  return (
    <dl className="data-rows">
      <div>
        <dt>Prix des warrants</dt>
        <dd>
          {timestamp(dataset?.quotesCollection?.at ?? dataset?.quoteDate)}
          <small>
            {dataset?.quotesCollection
              ? `${dataset.quotesCollection.observed} relevés · ${dataset.quotesCollection.failures.length} échecs`
              : "Prix de référence non actualisés"}
          </small>
        </dd>
      </div>
      <div>
        <dt>Historique des actions</dt>
        <dd>
          {last ? date(last) : "Chargement…"}
          <small>Dernière séance complète · Yahoo Finance</small>
        </dd>
      </div>
      <div>
        <dt>Marché crypto</dt>
        <dd>
          {timestamp(state?.asOf)}
          <small>
            {state?.stale
              ? "Données retardées"
              : (state?.source ?? "Chargement…")}
          </small>
        </dd>
      </div>
      <div>
        <dt>Décisions CRP</dt>
        <dd>
          Chaque jour à 08 h UTC
          <small>
            {state?.scheduler?.status === "failed"
              ? "Dernier passage en échec"
              : `Dernier passage : ${timestamp(state?.scheduler?.at)}`}
          </small>
        </dd>
      </div>
    </dl>
  );
}
function DataPage({
  dataset,
  state,
  error,
  retry,
}: {
  dataset: Dataset | null;
  state: CrpState | null;
  error: string;
  retry: () => void;
}) {
  return (
    <section className="data-page">
      <div className="page-heading">
        <h1>Données</h1>
        <button className="button secondary" onClick={retry}>
          <RefreshCw size={14} />
          Actualiser l’affichage
        </button>
      </div>
      {error && (
        <p role="alert" className="notice">
          {error} Utiliser le bouton Actualiser.
        </p>
      )}
      <DataRows dataset={dataset} state={state} />
      <section>
        <h2>Ce qui change chaque jour</h2>
        <p>
          À 22 h 30 UTC les jours ouvrés, la collecte relève les fourchettes des
          contrats suivis, cherche de nouveaux warrants Société Générale sur
          cinq sous-jacents et recharge les clôtures et le change. Les
          estimations sont recalculées avec ces données.
        </p>
        <p>
          La recherche lit deux pages par sous-jacent, conserve jusqu’à trois
          calls et trois puts au spread le plus faible, et suit au plus 100
          contrats. Ce périmètre ne couvre pas tout le marché.
        </p>
      </section>
      <section>
        <h2>Comment lire les dates</h2>
        <p>
          « Relevé » est l’heure à laquelle la page publique a été lue. Le site
          ne fournit pas l’horodatage émetteur du bid/ask. Un relevé récent ne
          garantit pas que le prix soit négociable. Vérifier la fourchette chez
          Bourso avant un ordre.
        </p>
        <p>
          Si une source échoue, son ancien relevé reste daté. Un produit nouveau
          doit encore être vérifié dans son DIC. Un classement favorable ne
          démontre pas un avantage rentable.
        </p>
      </section>
      {dataset?.quotesCollection?.failures.length ? (
        <section>
          <h2>Échecs au dernier passage</h2>
          <ul className="failure-list">
            {dataset.quotesCollection.failures.map((f, i) => (
              <li key={i}>
                <code>{f.scope}</code>
                <span>{f.error}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h2>Accès pour les agents</h2>
        <p>
          Le même comparatif CRP et le catalogue Warrants sont accessibles par
          API et MCP, en lecture seule.
        </p>
        <div className="source-list">
          <a href="/api/crp/comparison">
            Comparaison CRP · JSON
            <ArrowUpRight size={14} />
          </a>
          <a href="/openapi.json">
            Documentation API
            <ArrowUpRight size={14} />
          </a>
          <a href="/index.md">
            Guide pour les agents
            <ArrowUpRight size={14} />
          </a>
        </div>
        <label className="agent-endpoint">
          Adresse MCP
          <input
            aria-label="Adresse MCP"
            readOnly
            value="https://fin.keff.uk/mcp"
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      </section>
      <div className="source-list">
        <a href="/research/snapshot.json" download>
          Télécharger les données
          <ArrowUpRight size={14} />
        </a>
        <a
          href="https://github.com/kennethassogba/crp/actions/workflows/research-daily.yml"
          target="_blank"
          rel="noreferrer"
        >
          Voir les collectes quotidiennes
          <ArrowUpRight size={14} />
        </a>
        <a href="/warrants/methode/">
          Lire la méthode
          <ArrowRight size={14} />
        </a>
      </div>
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
