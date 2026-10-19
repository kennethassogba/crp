import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  ChartNoAxesCombined,
  ChevronsUpDown,
  FileText,
  House,
  Layers2,
  ListChecks,
  PanelLeftClose,
} from "lucide-react";
import "@fontsource-variable/geist";
import "./style.css";
import { Screener } from "./Screener";
import { Method } from "./Method";
import { Journal } from "./Journal";
import { MiniChart } from "./Charts";
import type { Dataset, Observation } from "./types";

function App() {
  const route = location.pathname;
  const view = route.includes("/methode")
    ? "method"
    : route.includes("/suivi")
      ? "journal"
      : route.startsWith("/warrants")
        ? "warrants"
        : "home";
  const [dataset, setDataset] = useState<Dataset | null>(null),
    [error, setError] = useState("");
  const [menu, setMenu] = useState(false),
    [journal, setJournal] = useState<Observation[]>([]),
    [storageError, setStorageError] = useState("");
  function load() {
    setError("");
    fetch("/research/snapshot.json")
      .then((r) => {
        if (!r.ok) throw Error("Données indisponibles.");
        return r.json();
      })
      .then(setDataset)
      .catch(() => setError("Le jeu de données n’a pas pu être chargé."));
  }
  useEffect(() => {
    load();
    try {
      const raw = JSON.parse(
        localStorage.getItem("fin-observations-v1") ?? "[]",
      );
      if (Array.isArray(raw)) setJournal(raw);
    } catch {
      setStorageError(
        "Le stockage local est indisponible. Exporter les analyses pour les conserver.",
      );
    }
  }, []);
  useEffect(() => {
    document.title = `${{ home: "Projets finance", warrants: "Warrants", method: "Méthode", journal: "Suivi" }[view]} · fin`;
  }, [view]);
  const updateJournal = (next: Observation[]) => {
    setJournal(next);
    try {
      localStorage.setItem("fin-observations-v1", JSON.stringify(next));
    } catch {
      setStorageError(
        "Observation gardée pour cette session. Le stockage local est indisponible ; exporter le suivi.",
      );
    }
  };
  return (
    <div className="fin-shell">
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <aside className={`fin-sidebar ${menu ? "is-open" : ""}`}>
        <a className="fin-brand" href="/" aria-label="fin, accueil">
          fin<span>.</span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">k</span>
          <span>
            Finance<span>Un espace k_eff</span>
          </span>
          <ChevronsUpDown size={13} />
        </div>
        <span className="nav-label">ESPACE DE RECHERCHE</span>
        <nav aria-label="Navigation principale">
          <a href="/" aria-current={view === "home" ? "page" : undefined}>
            <House size={17} />
            Vue d’ensemble
          </a>
          <a
            href="/warrants/"
            aria-current={view === "warrants" ? "page" : undefined}
          >
            <ChartNoAxesCombined size={17} />
            Warrants <span className="nav-badge">01</span>
          </a>
          <a href="/crp/">
            <Layers2 size={17} />
            CRP <ArrowUpRight size={13} className="nav-end" />
          </a>
        </nav>
        <div className="nav-divider" />
        <span className="nav-label">WARRANTS</span>
        <nav aria-label="Outils de recherche">
          <a
            href="/warrants/methode/"
            aria-current={view === "method" ? "page" : undefined}
          >
            <FileText size={16} />
            Méthode
          </a>
          <a
            href="/warrants/suivi/"
            aria-current={view === "journal" ? "page" : undefined}
          >
            <ListChecks size={16} />
            Suivi<span className="nav-count">{journal.length}</span>
          </a>
        </nav>
        <div className="sidebar-footer">
          <a
            href="https://github.com/kennethassogba/crp"
            target="_blank"
            rel="noreferrer"
          >
            Code source <ArrowUpRight size={13} />
          </a>
          <a href="https://keff.uk" target="_blank" rel="noreferrer">
            Un projet k_eff <ArrowUpRight size={13} />
          </a>
          <span>Recherche personnelle · v1.0</span>
        </div>
      </aside>
      <div className="fin-workspace">
        <header className="fin-topbar">
          <button
            className="mobile-menu icon-button"
            aria-label={menu ? "Fermer la navigation" : "Ouvrir la navigation"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <PanelLeftClose size={19} />
          </button>
          <div className="breadcrumbs">
            <a href="/">Finance</a>
            <span>/</span>
            <span>
              {
                {
                  home: "Vue d’ensemble",
                  warrants: "Warrants",
                  method: "Méthode",
                  journal: "Suivi",
                }[view]
              }
            </span>
          </div>
          <a className="topbar-method" href="/warrants/methode/">
            Documentation <ArrowUpRight size={13} />
          </a>
        </header>
        {menu && (
          <button
            className="menu-backdrop"
            aria-label="Fermer la navigation"
            onClick={() => setMenu(false)}
          />
        )}
        <main id="main" tabIndex={-1} className={`fin-main view-${view}`}>
          {storageError && (
            <p role="status" className="error-notice">
              {storageError}
            </p>
          )}
          {view === "home" ? (
            <Home />
          ) : view === "method" ? (
            <Method />
          ) : view === "journal" ? (
            <Journal
              rows={journal}
              onDelete={(id) =>
                updateJournal(journal.filter((r) => r.id !== id))
              }
            />
          ) : error ? (
            <div className="empty-state" role="alert">
              <h1>Données indisponibles</h1>
              <p>{error}</p>
              <button className="button" onClick={load}>
                Réessayer
              </button>
              <a href="/warrants/methode/">Lire la méthode</a>
            </div>
          ) : dataset ? (
            <Screener
              dataset={dataset}
              setDataset={setDataset}
              onSave={(r) => updateJournal([r, ...journal].slice(0, 500))}
            />
          ) : (
            <div className="analysis-loading" role="status">
              <h1>Chargement des données</h1>
              <p>Catalogue et historiques vérifiés.</p>
            </div>
          )}
          <footer className="main-footer">
            <span>fin.keff.uk</span>
            <span>
              Les estimations dépendent des hypothèses. Aucun ordre n’est
              transmis.
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Home() {
  return (
    <section className="home-page">
      <div className="eyebrow">Projets et outils</div>
      <h1>Projets finance</h1>
      <p className="intro">
        Un espace pour étudier les marchés, comparer les hypothèses et suivre
        les résultats.
      </p>
      <div className="home-section-title">
        <h2>Applications</h2>
        <span>02 projets</span>
      </div>
      <a className="app-entry" href="/warrants/">
        <div className="app-entry-icon">
          <ChartNoAxesCombined size={25} />
        </div>
        <div className="app-entry-copy">
          <span className="eyebrow">Produits cotés · BoursoBank</span>
          <h3>
            Warrants <ArrowUpRight size={22} />
          </h3>
          <p>
            Probabilités, frais, scénarios et incertitude pour chaque contrat.
          </p>
          <div className="app-tags">
            <span>Catalogue importable</span>
            <span>Calculs reproductibles</span>
          </div>
        </div>
        <div className="app-preview">
          <MiniChart kind="warrants" />
          <span>Du prix au remboursement</span>
        </div>
        <ArrowRight className="app-entry-arrow" size={22} />
      </a>
      <a className="app-entry" href="/crp/">
        <div className="app-entry-icon">
          <Layers2 size={25} />
        </div>
        <div className="app-entry-copy">
          <span className="eyebrow">Crypto · décisions simulées</span>
          <h3>
            CRP <ArrowUpRight size={22} />
          </h3>
          <p>
            Comparer cinq configurations de modèles sur BTC et ETH, avec leur
            journal de décisions.
          </p>
          <div className="app-tags">
            <span>Suivi quotidien</span>
            <span>Résultats observés</span>
          </div>
        </div>
        <div className="app-preview">
          <MiniChart kind="crp" />
          <span>Benchmark historique · Momentum</span>
        </div>
        <ArrowRight className="app-entry-arrow" size={22} />
      </a>
      <a className="home-method-link" href="/warrants/methode/">
        <FileText size={20} />
        <div>
          <h3>Comment chercher une opportunité ?</h3>
          <p>
            Le protocole, les calculs et les limites du passage à l’échelle.
          </p>
        </div>
        <ArrowRight size={18} />
      </a>
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
