import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChevronRight,
  CircleHelp,
  FileUp,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { parseCSV, validateProduct } from "../../lib/warrants.mjs";
import type { Dataset, Observation, Product } from "./types";
import { Detail } from "./Detail";
import { date, download, euro, number, percent, signedEuro } from "./format";

export function Screener({
  dataset,
  setDataset,
  onSave,
}: {
  dataset: Dataset;
  setDataset: (d: Dataset) => void;
  onSave: (r: Observation) => void;
}) {
  const [budget, setBudget] = useState(3000),
    [fx, setFx] = useState(dataset.fx),
    [multiple, setMultiple] = useState(5);
  const [asOf, setAsOf] = useState(dataset.analysisDate),
    [neutral, setNeutral] = useState(true);
  const [rows, setRows] = useState<any[]>([]),
    [selected, setSelected] = useState("Z377S");
  const [detail, setDetail] = useState<any>(null),
    [interval, setInterval] = useState<any>(null);
  const [screening, setScreening] = useState(true),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [asset, setAsset] = useState("all");
  const [page, setPage] = useState(0),
    [saved, setSaved] = useState(false),
    [showSettings, setShowSettings] = useState(false);
  const [editingAsk, setEditingAsk] = useState<number | null>(null),
    [importMessage, setImportMessage] = useState("");
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const options = useMemo(
    () => ({ budget, fx, multiple, asOf, neutral }),
    [budget, fx, multiple, asOf, neutral],
  );
  const original =
    dataset.products.find((p) => p.id === selected) ?? dataset.products[0];
  const product = useMemo(
    () =>
      original
        ? { ...original, ...(editingAsk != null ? { ask: editingAsk } : {}) }
        : null,
    [original, editingAsk],
  );
  useEffect(() => {
    setScreening(true);
    setError("");
    const worker = new Worker(
      new URL("./research.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = ({ data }) => {
      if (data.error) setError(data.error);
      else setRows(data.rows);
      setScreening(false);
    };
    worker.onerror = () => {
      setError(
        "Le calcul a échoué. Réduire le catalogue ou recharger la page.",
      );
      setScreening(false);
    };
    worker.postMessage({ type: "screen", dataset, options });
    return () => worker.terminate();
  }, [dataset, options]);
  useEffect(() => {
    if (!product) return;
    setBusy(true);
    setSaved(false);
    setInterval(null);
    const worker = new Worker(
      new URL("./research.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = ({ data }) => {
      if (data.error) setError(data.error);
      else {
        setDetail(data.result);
        setInterval(data.interval);
      }
      setBusy(false);
    };
    worker.onerror = () => {
      setError(
        "L’analyse détaillée est indisponible. Les autres produits restent consultables.",
      );
      setBusy(false);
    };
    const timer = setTimeout(
      () => worker.postMessage({ type: "detail", product, dataset, options }),
      100,
    );
    return () => {
      clearTimeout(timer);
      worker.terminate();
    };
  }, [dataset, options, product]);
  const visible = useMemo(
    () =>
      rows
        .filter(
          ({ product: p, result: r }) =>
            (!query ||
              `${p.id} ${p.isin} ${p.underlying}`
                .toLowerCase()
                .includes(query.toLowerCase())) &&
            (asset === "all" || p.underlying === asset) &&
            (filter !== "positive" || r.long?.expected > 0) &&
            (filter !== "validate" || r.status === "À valider"),
        )
        .sort(
          (a, b) =>
            (b.result.long?.expected ?? -Infinity) -
            (a.result.long?.expected ?? -Infinity),
        ),
    [rows, query, filter, asset],
  );
  useEffect(() => setPage(0), [query, filter, asset, dataset]);
  const select = (id: string) => {
    setSelected(id);
    setEditingAsk(null);
    setDetail(null);
    setCatalogueOpen(false);
  };
  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    if (!f) return;
    setError("");
    setImportMessage("");
    try {
      if (f.size > 4_000_000) throw Error("Fichier limité à 4 Mo");
      const text = await f.text();
      let next: Dataset;
      if (f.name.toLowerCase().endsWith(".csv"))
        next = {
          ...dataset,
          products: parseCSV(text).map((p) => ({
            ...p,
            id: p.id,
            isin: p.isin,
            underlying: p.underlying,
            direction: p.direction === "put" ? "put" : "call",
            currency: p.currency === "EUR" ? "EUR" : "USD",
            strike: Number(p.strike),
            ratio: Number(p.ratio),
            bid: Number(p.bid),
            ask: Number(p.ask),
            expiry: p.expiry,
            quoteAt: p.quoteAt,
            commission: Number(p.commission ?? 0),
            commissionPct: Number(p.commissionPct ?? 0),
            commissionMin: Number(p.commissionMin ?? 0),
            minOrder: Number(p.minOrder ?? 0),
          })),
        };
      else {
        next = JSON.parse(text);
        if (
          !next ||
          !Array.isArray(next.products) ||
          !next.assets ||
          !Number.isFinite(next.fx) ||
          next.fx <= 0 ||
          !Number.isFinite(Date.parse(next.analysisDate))
        )
          throw Error("JSON invalide. Utiliser le schéma documenté.");
        if (!next.products.length || next.products.length > 10000)
          throw Error("Importer entre 1 et 10 000 produits");
        const seen = new Set();
        for (const p of next.products) {
          const errors = validateProduct(p);
          if (errors.length || seen.has(p.isin))
            throw Error(
              `Contrat ${p.id ?? "?"} : ${errors.join(", ") || "ISIN dupliqué"}`,
            );
          seen.add(p.isin);
        }
        for (const [key, h] of Object.entries(next.assets)) {
          if (
            !Array.isArray(h.closes) ||
            !Array.isArray(h.dates) ||
            h.closes.length !== h.dates.length ||
            h.closes.length < 100 ||
            h.closes.length > 10000 ||
            h.closes.some((x) => !Number.isFinite(x) || x <= 0) ||
            h.dates.some(
              (x, i) =>
                !Number.isFinite(Date.parse(x)) ||
                (i > 0 && x <= h.dates[i - 1]),
            )
          )
            throw Error(`Historique ${key} invalide ou non chronologique`);
        }
      }
      if (!next.products.length) throw Error("Le catalogue est vide");
      setDataset(next);
      setSelected(next.products[0].id);
      setEditingAsk(null);
      setDetail(null);
      setImportMessage(
        `${number(next.products.length)} produits importés. Traitement local ; aucun fichier envoyé au serveur.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import impossible");
    }
    event.target.value = "";
  }
  function save() {
    if (!product || !detail?.long || busy) return;
    onSave({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      analysisDate: asOf,
      product: { ...product },
      budget,
      fx,
      multiple,
      neutral,
      spot: detail.spot,
      expected: detail.long.expected,
      probability: detail.long.multiple,
      quantity: detail.quantity,
      note: `Moteur 1.0.0 · analyse au ${asOf} · prix source ${product.quoteAt}${editingAsk != null ? " · prix saisi manuellement" : ""}`,
    });
    setSaved(true);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Recherche sur produits cotés</div>
          <h1>Warrants</h1>
          <p>Comparer le prix d’un pari à sa distribution de gains.</p>
        </div>
        <div className="heading-actions">
          <a className="text-link" href="/warrants/methode/">
            Lire la méthode <ArrowUpRight size={14} />
          </a>
          <button className="button" onClick={() => file.current?.click()}>
            <FileUp size={15} /> Importer
          </button>
          <input
            ref={file}
            type="file"
            accept=".csv,.json"
            onChange={importFile}
            aria-label="Importer un catalogue CSV ou JSON"
            className="visually-hidden"
          />
        </div>
      </div>
      <div className="snapshot-line">
        <span className="snapshot-dot" />
        <span>
          Prix de référence du <strong>{date(dataset.quoteDate)}</strong>
        </span>
        <span className="snapshot-note">
          Calcul au {date(asOf)} · aucun flux temps réel connecté
        </span>
      </div>
      {error && (
        <div role="alert" className="error-notice">
          {error}
          <button
            onClick={() => setError("")}
            aria-label="Fermer le message d’erreur"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {importMessage && (
        <div role="status" className="import-notice">
          {importMessage}
        </div>
      )}
      <div className="research-layout">
        <section
          className={`catalogue-panel ${catalogueOpen ? "catalogue-open" : ""}`}
          aria-label="Catalogue de warrants"
        >
          <div className="catalogue-header">
            <h2>
              Catalogue <span>{dataset.products.length}</span>
            </h2>
            <span className="mobile-selection">{original?.id}</span>
            <button
              className="mobile-catalogue-toggle"
              aria-expanded={catalogueOpen}
              onClick={() => setCatalogueOpen(!catalogueOpen)}
            >
              {catalogueOpen ? "Fermer" : "Choisir"}
            </button>
            <button
              className="icon-button"
              aria-label="Télécharger le catalogue"
              onClick={() =>
                download("fin-catalogue.json", JSON.stringify(dataset, null, 2))
              }
            >
              <ArrowDownToLine size={16} />
            </button>
          </div>
          <label className="search-field">
            <Search size={15} />
            <input
              type="search"
              placeholder="ISIN, code ou sous-jacent"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Rechercher un warrant"
            />
          </label>
          <div className="catalogue-filters">
            <select
              aria-label="Filtrer par sous-jacent"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
            >
              <option value="all">Tous les sous-jacents</option>
              {Object.entries(dataset.assets).map(([id, h]) => (
                <option key={id} value={id}>
                  {h.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrer les résultats"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Tous les résultats</option>
              <option value="positive">Espérance historique &gt; 0</option>
              <option value="validate">Modèles positifs · à valider</option>
            </select>
          </div>
          <div className="catalogue-label">
            <span>Produit / échéance</span>
            <span>Espérance nette</span>
          </div>
          <div className="product-list" aria-busy={screening}>
            {screening && !rows.length ? (
              <p role="status" className="list-status">
                Analyse du catalogue…
              </p>
            ) : !visible.length ? (
              <div className="list-status">
                <CircleHelp size={20} />
                <h3>Aucun résultat</h3>
                <p>
                  Modifier les filtres. Une espérance positive ne suffit pas à
                  valider un avantage.
                </p>
                <button
                  className="text-link"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                    setAsset("all");
                  }}
                >
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
              visible
                .slice(page * 30, page * 30 + 30)
                .map(({ product: p, result: r }) => (
                  <button
                    key={p.isin}
                    className={`product-row ${selected === p.id ? "selected" : ""}`}
                    onClick={() => select(p.id)}
                    aria-pressed={selected === p.id}
                  >
                    <span
                      className={`asset-monogram asset-${p.underlying.toLowerCase()}`}
                      aria-hidden="true"
                    >
                      {p.underlying === "NDX" ? "N" : p.underlying.slice(0, 1)}
                    </span>
                    <span className="product-name">
                      <strong>
                        {p.id} <small>{p.direction.toUpperCase()}</small>
                      </strong>
                      <span>
                        {dataset.assets[p.underlying]?.name ?? p.underlying} ·{" "}
                        {p.expiry.slice(5).split("-").reverse().join("/")}
                      </span>
                      <span className="row-status">{r.error ?? r.status}</span>
                    </span>
                    <span className="product-result">
                      <strong
                        className={
                          r.long?.expected >= 0 ? "positive" : "negative"
                        }
                      >
                        {r.long ? signedEuro(r.long.expected) : "—"}
                      </strong>
                      <small>{euro(p.ask, p.ask < 0.1 ? 3 : 2)} / unité</small>
                    </span>
                    <ChevronRight size={13} />
                  </button>
                ))
            )}
          </div>
          {visible.length > 30 && (
            <div className="pagination">
              <button disabled={!page} onClick={() => setPage(page - 1)}>
                Précédent
              </button>
              <span>
                {page + 1} / {Math.ceil(visible.length / 30)}
              </span>
              <button
                disabled={(page + 1) * 30 >= visible.length}
                onClick={() => setPage(page + 1)}
              >
                Suivant
              </button>
            </div>
          )}
          <div className="catalogue-bottom">
            <p>
              Classement exploratoire par espérance sur cinq ans. Aucun produit
              n’est présenté comme un avantage validé.
            </p>
            <a href="/research/catalogue.csv" download>
              Modèle CSV <ArrowDownToLine size={12} />
            </a>
          </div>
        </section>
        <div className="analysis-column">
          <div className="settings-bar">
            <div className="budget-control">
              <label htmlFor="budget">Budget</label>
              <span>
                <input
                  id="budget"
                  type="number"
                  min="1"
                  max="10000000"
                  step="100"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                />
                <b>€</b>
              </span>
            </div>
            <div className="multiple-control">
              <label htmlFor="multiple">Cible</label>
              <select
                id="multiple"
                value={multiple}
                onChange={(e) => setMultiple(Number(e.target.value))}
              >
                <option value={2}>×2</option>
                <option value={5}>×5</option>
                <option value={10}>×10</option>
              </select>
            </div>
            <button
              className={`settings-toggle ${showSettings ? "active" : ""}`}
              aria-expanded={showSettings}
              aria-controls="research-settings"
              onClick={() => setShowSettings(!showSettings)}
            >
              <SlidersHorizontal size={14} /> Hypothèses
            </button>
          </div>
          {showSettings && (
            <div id="research-settings" className="settings-expanded">
              <label>
                Date de calcul
                <input
                  type="date"
                  value={asOf}
                  onChange={(e) => setAsOf(e.target.value)}
                />
              </label>
              <label>
                EUR/USD
                <input
                  type="number"
                  min=".1"
                  max="5"
                  step=".001"
                  value={fx}
                  onChange={(e) => setFx(Number(e.target.value))}
                />
              </label>
              <label>
                Prix d’achat saisi (€)
                <input
                  type="number"
                  min=".001"
                  step=".01"
                  value={editingAsk ?? product?.ask ?? 0}
                  onChange={(e) => setEditingAsk(Number(e.target.value))}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={neutral}
                  onChange={(e) => setNeutral(e.target.checked)}
                />{" "}
                Retirer la hausse moyenne passée
              </label>
              {editingAsk != null && (
                <p>
                  Prix modifié manuellement ; la cotation source garde son
                  horodatage.{" "}
                  <button
                    className="text-link"
                    onClick={() => setEditingAsk(null)}
                  >
                    Rétablir
                  </button>
                </p>
              )}
            </div>
          )}
          {busy && !detail ? (
            <div className="analysis-loading" role="status">
              <span className="loading-line" />
              <h2>Calcul de la distribution</h2>
              <p>Scénarios historiques, frais et incertitude.</p>
            </div>
          ) : (
            product && (
              <Detail
                product={product}
                result={detail}
                interval={interval}
                dataset={dataset}
                options={options}
                busy={busy}
                onSave={save}
                saved={saved}
              />
            )
          )}
        </div>
      </div>
    </>
  );
}
