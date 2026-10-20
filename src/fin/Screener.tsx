import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChevronRight,
  FileUp,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { parseCSV, validateProduct } from "../../lib/warrants.mjs";
import type { Dataset, Observation, Product } from "./types";
import { Detail } from "./Detail";
import { MarketStrip } from "./MarketStrip";
import {
  date,
  observedTime,
  download,
  euro,
  number,
  percent,
  signedEuro,
} from "./format";

export function Screener({
  dataset,
  setDataset,
  onSave,
  active = true,
}: {
  active?: boolean;
  dataset: Dataset;
  setDataset: (d: Dataset) => void;
  onSave: (r: Observation) => void;
}) {
  const [budget, setBudget] = useState(3000),
    [fx, setFx] = useState(dataset.fx),
    [multiple, setMultiple] = useState(5),
    [asOf, setAsOf] = useState(dataset.analysisDate),
    [neutral, setNeutral] = useState(true);
  const [rows, setRows] = useState<any[]>([]),
    [selected, setSelected] = useState(
      dataset.products.find((p) => p.id === "Z377S")?.id ??
        dataset.products[0]?.id ??
        "",
    ),
    [detail, setDetail] = useState<any>(null),
    [interval, setInterval] = useState<any>(null),
    [busy, setBusy] = useState(true),
    [screening, setScreening] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [query, setQuery] = useState(""),
    [asset, setAsset] = useState("all"),
    [filter, setFilter] = useState("current"),
    [sort, setSort] = useState("multiple"),
    [page, setPage] = useState(0),
    [open, setOpen] = useState(false),
    [saved, setSaved] = useState(false),
    [editingAsk, setEditingAsk] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null),
    drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);
  const options = useMemo(
    () => ({ budget, fx, multiple, asOf, neutral }),
    [budget, fx, multiple, asOf, neutral],
  );
  const original =
    dataset.products.find((p) => p.id === selected) ?? dataset.products[0];
  const product = useMemo(
    () =>
      original
        ? { ...original, ...(editingAsk !== null ? { ask: editingAsk } : {}) }
        : null,
    [original, editingAsk],
  );
  useEffect(() => {
    setFx(dataset.fx);
    setAsOf(dataset.analysisDate);
  }, [dataset.fx, dataset.analysisDate]);
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
      setError("Calcul interrompu. Réduire le catalogue ou recharger.");
      setScreening(false);
    };
    worker.postMessage({ type: "screen", dataset, options });
    return () => worker.terminate();
  }, [dataset, options]);
  useEffect(() => {
    if (!product || !open) return;
    setBusy(true);
    setDetail(null);
    setInterval(null);
    setSaved(false);
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
      setError("Analyse interrompue. Fermer le détail et réessayer.");
      setBusy(false);
    };
    const timer = setTimeout(
      () => worker.postMessage({ type: "detail", product, dataset, options }),
      80,
    );
    return () => {
      clearTimeout(timer);
      worker.terminate();
    };
  }, [dataset, product, options, open]);
  useEffect(() => {
    if (open) drawer.current?.showModal();
    else drawer.current?.close();
  }, [open]);
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
            (filter !== "validate" || r.status === "À valider") &&
            (filter !== "current" ||
              (r.quoteAge <= 1 &&
                r.historyAge <= 1 &&
                !!p.observedAt &&
                !r.error)),
        )
        .sort((a, b) =>
          sort === "multiple"
            ? (b.result.long?.multiple ?? -1) - (a.result.long?.multiple ?? -1)
            : sort === "expected"
              ? (b.result.long?.expected ?? -Infinity) -
                (a.result.long?.expected ?? -Infinity)
              : sort === "spread"
                ? (a.result.spread ?? Infinity) - (b.result.spread ?? Infinity)
                : (b.result.pessimistic ?? -Infinity) -
                  (a.result.pessimistic ?? -Infinity),
        ),
    [rows, query, asset, filter, sort],
  );
  useEffect(() => setPage(0), [query, asset, filter, sort]);
  const openProduct = (id: string) => {
    setSelected(id);
    setEditingAsk(null);
    setOpen(true);
  };
  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    if (!f) return;
    setError("");
    setMessage("");
    try {
      if (f.size > 4000000) throw Error("Fichier limité à 4 Mo.");
      const text = await f.text();
      let next: Dataset;
      if (f.name.toLowerCase().endsWith(".csv"))
        next = {
          ...dataset,
          products: parseCSV(text).map((p: any) => ({
            ...p,
            venueVerified: false,
            contractVerified: false,
          })) as Product[],
        };
      else {
        next = JSON.parse(text);
        if (
          !next?.products?.length ||
          next.products.length > 10000 ||
          !next.assets ||
          !(next.fx > 0) ||
          !Number.isFinite(Date.parse(next.analysisDate))
        )
          throw Error("JSON invalide. Utiliser le modèle d’import.");
        const seen = new Set();
        for (const p of next.products) {
          const errors = validateProduct(p);
          if (errors.length || seen.has(p.isin))
            throw Error(
              `Contrat ${p.id ?? "?"} : ${errors.join(", ") || "ISIN dupliqué"}`,
            );
          seen.add(p.isin);
        }
        for (const [key, h] of Object.entries(next.assets))
          if (
            !Array.isArray(h.closes) ||
            !Array.isArray(h.dates) ||
            h.closes.length !== h.dates.length ||
            h.closes.length < 100 ||
            h.closes.length > 10000 ||
            h.closes.some((x) => !Number.isFinite(x) || x <= 0) ||
            h.dates.some(
              (d, i) =>
                !Number.isFinite(Date.parse(d)) ||
                (i > 0 && d <= h.dates[i - 1]),
            )
          )
            throw Error(
              `Historique ${key} invalide. Vérifier les dates et les cours.`,
            );
      }
      next = {
        ...next,
        quotesCollection: undefined,
        importedAt: new Date().toISOString(),
        warrantExperiment: undefined,
        quoteDate: next.products
          .map((p) => p.quoteAt.slice(0, 10))
          .sort()
          .at(-1)!,
      };
      setDataset(next);
      setQuery("");
      setAsset("all");
      setPage(0);
      setSelected(next.products[0].id);
      setFilter("all");
      setDetail(null);
      setMessage(
        `${number(next.products.length)} produits importés dans ce navigateur.`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Import impossible. Vérifier le format du fichier.",
      );
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
      note: `Moteur 1.0.0 · données au ${asOf} · relevé ${product.quoteAt}${editingAsk !== null ? " · prix manuel" : ""}`,
    });
    setSaved(true);
  }
  const snapshot = dataset.quotesCollection;
  return (
    <section className="screener-page" hidden={!active}>
      <div className="page-heading">
        <div>
          <h1>Warrants</h1>
          <p>
            {dataset.importedAt
              ? `Import local · ${dataset.products.length} contrats`
              : snapshot
                ? `${snapshot.observed} prix · ${snapshot.added} nouveaux`
                : "Catalogue de référence"}
            <a href="/donnees/">
              {snapshot
                ? `Relevé ${observedTime(snapshot.at)}`
                : `Prix du ${date(dataset.quoteDate)}`}
              <ArrowUpRight size={12} />
            </a>
          </p>
        </div>
        <div className="heading-actions">
          {dataset.importedAt && (
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  const r = await fetch("/research/snapshot.json", {
                    cache: "no-store",
                  });
                  if (!r.ok) throw Error();
                  setDataset(await r.json());
                  setMessage("Catalogue public chargé.");
                  setFilter("current");
                } catch {
                  setError("Catalogue public indisponible. Réessayer.");
                }
              }}
            >
              Catalogue public
            </button>
          )}
          <button
            className="button secondary"
            onClick={() => file.current?.click()}
          >
            <FileUp size={14} />
            Importer
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
          <input
            className="visually-hidden"
            ref={file}
            type="file"
            accept=".csv,.json"
            onChange={importFile}
            aria-label="Importer un catalogue CSV ou JSON"
          />
        </div>
      </div>
      <nav className="view-tabs" aria-label="Vues Warrants">
        <a href="/warrants/experience/">Simulation 100 €</a>
        <a href="/warrants/" aria-current="page">
          Catalogue
        </a>
      </nav>
      <MarketStrip dataset={dataset} selected={asset} onSelect={setAsset} />
      <div role="status" className={message ? "notice" : ""}>
        {message}
      </div>
      {error && (
        <div className="notice error-notice" role="alert">
          {error}
          <button
            aria-label="Fermer le message d’erreur"
            className="icon-button"
            onClick={() => setError("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="toolbar research-toolbar">
        <label className="search-field">
          <Search size={15} />
          <input
            type="search"
            placeholder="Code, ISIN, sous-jacent"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Rechercher un warrant"
          />
        </label>
        <label className="inline-label">
          Budget
          <input
            type="number"
            min="1"
            max="10000000"
            step="100"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            aria-label="Budget"
          />
          <span>€</span>
        </label>
        <label className="inline-label">
          Cible
          <select
            value={multiple}
            onChange={(e) => setMultiple(Number(e.target.value))}
            aria-label="Cible"
          >
            {[2, 5, 10].map((n) => (
              <option key={n} value={n}>
                ×{n}
              </option>
            ))}
          </select>
        </label>
        <details className="filter-disclosure">
          <summary>
            <SlidersHorizontal size={14} />
            Filtres
          </summary>
          <div className="filter-fields">
            <label>
              Sous-jacent
              <select
                aria-label="Filtrer par sous-jacent"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
              >
                <option value="all">Tous</option>
                {Object.entries(dataset.assets).map(([id, h]) => (
                  <option key={id} value={id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Résultats
              <select
                aria-label="Filtrer les résultats"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="current">Relevés récents</option>
                <option value="all">Tous les contrats</option>
                <option value="positive">Gain moyen historique positif</option>
                <option value="validate">Positif dans les cinq modèles</option>
              </select>
            </label>
            <a href="/research/catalogue.csv" download>
              Modèle CSV
            </a>
          </div>
        </details>
      </div>
      <div className="list-heading">
        <span role="status">
          {screening ? "Calcul…" : `${visible.length} contrats`}
        </span>
        <label>
          Trier
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Trier les warrants"
          >
            <option value="models">Modèle le plus défavorable</option>
            <option value="multiple">Chance de ×{multiple}</option>
            <option value="expected">Gain moyen sur cinq ans</option>
            <option value="spread">Spread le plus faible</option>
          </select>
        </label>
      </div>
      <div className="warrant-table-wrap" aria-busy={screening}>
        <table className="data-table warrant-table">
          <thead>
            <tr>
              <th>Contrat</th>
              <th className="column-expiry">Échéance</th>
              <th className="column-price">Prix d’achat</th>
              <th>Chance ×{multiple}</th>
              <th className="column-mean">
                Gain moyen<small>Historique 5 ans</small>
              </th>
              <th className="column-risk">Perte totale</th>
              <th className="column-agreement">Modèles positifs</th>
              <th>
                <span className="visually-hidden">Détail</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible
              .slice(page * 10, page * 10 + 10)
              .map(({ product: p, result: r }) => {
                const models = [
                    r.long,
                    r.short,
                    r.model20,
                    r.model60,
                    r.model252,
                  ].filter(Boolean),
                  positive = models.filter((m) => m.expected > 0).length;
                return (
                  <tr key={p.isin} onClick={() => openProduct(p.id)}>
                    <th scope="row">
                      <button
                        className="contract-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openProduct(p.id);
                        }}
                      >
                        <strong>{p.id}</strong>
                        <span>
                          {dataset.assets[p.underlying]?.name ?? p.underlying}
                          <small>
                            {p.direction === "call" ? "Hausse" : "Baisse"}
                          </small>
                        </span>
                      </button>
                    </th>
                    <td className="column-expiry">
                      {date(p.expiry, true)}
                      <small>{r.days ?? "—"} j</small>
                    </td>
                    <td className="column-price">
                      {euro(p.ask, p.ask < 0.1 ? 3 : 2)}
                      {!p.observedAt && <small>Ancien prix</small>}
                    </td>
                    <td>{r.long ? percent(r.long.multiple) : "—"}</td>
                    <td className="column-mean">
                      {r.long ? signedEuro(r.long.expected) : "—"}
                    </td>
                    <td className="column-risk">
                      {r.long ? percent(r.long.zero) : "—"}
                    </td>
                    <td className="column-agreement">
                      <span className="model-agreement">
                        {positive}/{models.length || 5}
                      </span>
                    </td>
                    <td>
                      <ChevronRight size={14} />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        {!screening && !visible.length && (
          <div className="empty-state">
            <h2>Aucun résultat</h2>
            <p>Essayer un autre filtre ou importer un catalogue.</p>
            <button
              className="button secondary"
              onClick={() => {
                setQuery("");
                setFilter("all");
                setAsset("all");
              }}
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
        {screening && !rows.length && (
          <p className="empty-state" role="status">
            Calcul du catalogue…
          </p>
        )}
      </div>
      <div className="list-footer">
        <span>
          Estimations historiques à l’échéance, après frais et avant impôts.
          Ouvrir un contrat pour tester les hypothèses.
        </span>
        {visible.length > 10 && (
          <div className="pagination">
            <button disabled={!page} onClick={() => setPage(page - 1)}>
              Précédent
            </button>
            <span>
              {page + 1}/{Math.ceil(visible.length / 10)}
            </span>
            <button
              disabled={(page + 1) * 10 >= visible.length}
              onClick={() => setPage(page + 1)}
            >
              Suivant
            </button>
          </div>
        )}
      </div>
      <dialog
        ref={drawer}
        className="detail-dialog"
        aria-label="Analyse du warrant"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <div className="dialog-topbar">
          <span>
            Warrants <ChevronRight size={13} />
            {selected}
          </span>
          <button
            className="icon-button"
            aria-label="Fermer l’analyse"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="detail-settings">
          <label>
            Budget
            <input
              type="number"
              value={budget}
              min="1"
              max="10000000"
              step="100"
              onChange={(e) => setBudget(Number(e.target.value))}
            />
            <span>€</span>
          </label>
          <details>
            <summary>Hypothèses</summary>
            <div className="settings-expanded">
              <label>
                Date de référence
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
                  step=".001"
                  value={editingAsk ?? product?.ask ?? 0}
                  onChange={(e) => setEditingAsk(Number(e.target.value))}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={neutral}
                  onChange={(e) => setNeutral(e.target.checked)}
                />
                Retirer la hausse moyenne passée
              </label>
            </div>
          </details>
        </div>
        {error && (
          <p className="notice" role="alert">
            {error} Fermer le détail puis réessayer.
          </p>
        )}
        {busy ? (
          <div className="analysis-loading" role="status">
            Calcul des scénarios et de l’incertitude…
          </div>
        ) : (
          product && (
            <Detail
              key={product.isin}
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
      </dialog>
    </section>
  );
}
