import React, { useRef, useState } from "react";
import { ArrowUpRight, Bookmark, Download } from "lucide-react";
import type { Dataset, Product } from "./types";
import { Distribution, PriceChart } from "./Charts";
import {
  date,
  observedTime,
  download,
  euro,
  number,
  percent,
  safeUrl,
  signedEuro,
} from "./format";
import { payoff } from "../../lib/warrants.mjs";
type Props = {
  product: Product;
  result: any;
  interval: any;
  dataset: Dataset;
  options: {
    budget: number;
    fx: number;
    multiple: number;
    neutral: boolean;
    asOf: string;
  };
  busy: boolean;
  onSave: () => void;
  saved: boolean;
};
export function Detail({
  product: p,
  result: r,
  interval,
  dataset,
  options,
  busy,
  onSave,
  saved,
}: Props) {
  const [tab, setTab] = useState("summary"),
    [finalPrice, setFinalPrice] = useState<number | null>(null),
    tablist = useRef<HTMLDivElement>(null);
  if (!r || r.error)
    return (
      <section className="detail-empty">
        <h2>{r?.error ?? "Analyse indisponible"}</h2>
        <p>Vérifier le contrat, le budget et l’historique, puis réessayer.</p>
      </section>
    );
  const m = r.long,
    h = dataset.assets[p.underlying];
  if (!m || r.status === "Budget insuffisant")
    return (
      <section className="detail-empty">
        <h2>Budget insuffisant</h2>
        <p>
          Augmenter le budget. Ce produit exige au moins{" "}
          {euro(p.minOrder ?? p.ask)} par ordre.
        </p>
      </section>
    );
  const value = finalPrice ?? r.breakEven,
    gain = r.quantity * payoff(p, value, options.fx) - r.cost;
  const models = [
    ["Historique · 5 ans", r.long],
    ["Historique · 1 an", r.short],
    [`Volatilité · 20 séances (${percent(r.vol20, 0)})`, r.model20],
    [`Volatilité · 60 séances (${percent(r.vol60, 0)})`, r.model60],
    [`Volatilité · 252 séances (${percent(r.vol252, 0)})`, r.model252],
  ] as [string, any][];
  const positive = models.filter(([, m]) => m?.expected > 0).length;
  const tabs = [
    ["summary", "Résumé"],
    ["models", "Modèles"],
    ["contract", "Contrat"],
  ];
  function exportResult() {
    download(
      `fin-${p.id}-${options.asOf}.json`,
      JSON.stringify(
        {
          engine: "1.0.0",
          exportedAt: new Date().toISOString(),
          options,
          product: p,
          history: {
            through: h.dates.at(-1),
            source: h.source,
            sourceUrl: h.sourceUrl,
          },
          result: r,
          bootstrap: interval,
        },
        null,
        2,
      ),
    );
  }
  return (
    <section className="detail-panel" aria-busy={busy}>
      <div className="detail-heading">
        <div>
          <h2>
            {p.id}
            <span className="direction-label">
              {p.direction === "call" ? "Hausse" : "Baisse"} · {h.name}
            </span>
          </h2>
          <p>
            {p.isin} · {date(p.expiry, true)} · {euro(p.ask, 3)} / unité
          </p>
        </div>
        <div className="detail-tools">
          <button
            className="icon-button"
            aria-label="Exporter cette analyse"
            onClick={exportResult}
          >
            <Download size={16} />
          </button>
          <button
            className="button secondary compact"
            onClick={onSave}
            disabled={busy || saved}
          >
            <Bookmark size={14} />
            {saved ? "Enregistré" : "Enregistrer l’analyse"}
          </button>
        </div>
      </div>
      <div className="metric-row">
        <div className="metric main-metric">
          <span>Gain moyen net</span>
          <strong>{signedEuro(m.expected)}</strong>
          <small>Modèle historique · 5 ans</small>
        </div>
        <div className="metric">
          <span>Chance de ×{options.multiple}</span>
          <strong>{percent(m.multiple)}</strong>
          <small>Remboursement à l’échéance</small>
        </div>
        <div className="metric">
          <span>Perte totale</span>
          <strong className="negative">{percent(m.zero)}</strong>
          <small>{euro(r.maxLoss)} au maximum</small>
        </div>
      </div>
      <div className="model-verdict">
        <span className="status-chip">{positive}/5 modèles positifs</span>
        <p>
          {positive < 5
            ? "Le résultat change selon le modèle."
            : "Les cinq estimations sont positives ; cela reste à valider."}
        </p>
      </div>
      <div
        className="detail-tabs"
        role="tablist"
        aria-label="Détails du warrant"
        ref={tablist}
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            const i = tabs.findIndex((t) => t[0] === tab),
              next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? 2
                    : (i + (e.key === "ArrowRight" ? 1 : 2)) % 3;
            setTab(tabs[next][0]);
            tablist.current
              ?.querySelectorAll<HTMLButtonElement>("button")
              [next].focus();
          }
        }}
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-controls={`panel-${id}`}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className="detail-tab-content"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "summary" && (
          <>
            <div className="section-heading">
              <h3>Gains nets possibles</h3>
              <span>
                {number(m.samples)} scénarios · {r.horizon} séances
              </span>
            </div>
            <Distribution net={m.net} budget={r.cost} />
            <section className="payoff-simulator">
              <div className="section-heading">
                <h3>Tester un cours final</h3>
                <span>À l’échéance</span>
              </div>
              <div className="simulator-input">
                <label htmlFor="final-price">{h.name}</label>
                <span>
                  <input
                    id="final-price"
                    type="number"
                    min="0"
                    max={r.spot * 10}
                    step={p.underlying === "NDX" ? 10 : 0.01}
                    value={Math.round(value * 100) / 100}
                    onChange={(e) =>
                      setFinalPrice(Math.max(0, Number(e.target.value)))
                    }
                  />
                  {p.currency === "EUR" ? "€" : "$"}
                </span>
                <strong className={gain >= 0 ? "positive" : "negative"}>
                  {signedEuro(gain)}
                  <small>Gain net</small>
                </strong>
              </div>
              <input
                className="payoff-range"
                type="range"
                min="0"
                max={Math.ceil(Math.max(r.spot * 2, r.multipleThreshold * 1.2))}
                step=".01"
                value={value}
                onChange={(e) => setFinalPrice(Number(e.target.value))}
                aria-label={`Cours final de ${h.name}`}
              />
              <div className="scenario-shortcuts">
                <button onClick={() => setFinalPrice(r.spot)}>
                  Cours actuel
                </button>
                <button onClick={() => setFinalPrice(r.breakEven)}>
                  Seuil de rentabilité
                </button>
                <button onClick={() => setFinalPrice(r.multipleThreshold)}>
                  Warrant ×{options.multiple}
                </button>
              </div>
              <p className="small muted">
                {number(r.quantity)} unités · {euro(r.cost, 2)} investis ·
                change fixé à {number(options.fx, 3)}.
              </p>
            </section>
            <details className="explainer">
              <summary>Que signifie le gain moyen ?</summary>
              <p>
                C’est la moyenne des gains des scénarios historiques, pas le
                gain le plus probable. La moitié des scénarios donne moins de{" "}
                {signedEuro(m.median)}.
              </p>
              <p>
                {interval
                  ? `Intervalle conditionnel à 95 % : ${signedEuro(interval.lower)} à ${signedEuro(interval.upper)}. `
                  : ""}
                Le choix du modèle et la sélection des produits ajoutent une
                incertitude non couverte par cet intervalle.
              </p>
              <a
                href="/warrants/methode/#maths"
                target="_blank"
                rel="noreferrer"
              >
                Lire les calculs
              </a>
            </details>
            <p className="small muted">
              Après frais, avant impôts. Une revente anticipée dépend aussi du
              spread et de la volatilité.
            </p>
          </>
        )}
        {tab === "models" && (
          <>
            <div className="section-heading">
              <h3>Comparer les hypothèses</h3>
            </div>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Comparaison des modèles"
            >
              <table className="data-table sensitivity-table">
                <thead>
                  <tr>
                    <th>Modèle</th>
                    <th>Gain moyen</th>
                    <th>Chance de gain</th>
                    <th>Chance ×{options.multiple}</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map(([label, v]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>{v ? signedEuro(v.expected) : "—"}</td>
                      <td>{v ? percent(v.profit) : "—"}</td>
                      <td>{v ? percent(v.multiple) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted">
              Même prix et même budget. Seule la distribution des variations
              change.
            </p>
            <div className="section-heading">
              <h3>{h.name} · un an</h3>
            </div>
            <PriceChart closes={h.closes} dates={h.dates} name={h.name} />
            <details className="explainer">
              <summary>Incertitude du calcul</summary>
              <p>
                {interval
                  ? `${number(interval.repetitions)} rééchantillonnages par blocs de ${interval.block} observations. `
                  : ""}
                Les fenêtres historiques se chevauchent. Le modèle ne garantit
                pas que la volatilité ou les événements passés se répètent.
              </p>
            </details>
          </>
        )}
        {tab === "contract" && (
          <>
            {!p.contractVerified && (
              <p className="notice">
                Contrat européen standard supposé. Vérifier la formule du DIC
                avant d’utiliser ces estimations.
              </p>
            )}
            <dl className="contract-grid">
              {[
                ["Achat / vente", `${euro(p.ask, 3)} / ${euro(p.bid, 3)}`],
                [
                  "Strike",
                  `${number(p.strike)} ${p.currency === "USD" ? "$" : "€"}`,
                ],
                ["Quantité", number(r.quantity)],
                ["Coût total", euro(r.cost, 2)],
                ["Espèces restantes", euro(r.cash, 2)],
                [
                  "Spread immédiat",
                  `${euro(r.spreadCost, 2)} · ${percent(r.spread)}`,
                ],
                [
                  "Courtage",
                  p.venueVerified
                    ? `0 € sous condition d’ordre ≥ ${euro(p.minOrder ?? 500)}`
                    : `${number(p.commissionPct ?? 0, 2)} % · minimum ${euro(p.commissionMin ?? 0, 2)}`,
                ],
                ["Ratio", `${number(p.ratio, 4)} · ${number(1 / p.ratio)}:1`],
                ["Relevé du prix", observedTime(p.quoteAt)],
                ["Historique au", date(h.dates.at(-1)!, true)],
                ["EUR/USD", number(options.fx, 3)],
                ["Horizon", `${r.horizon} séances estimées`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="source-list">
              {[
                [p.brokerUrl, "Vérifier le prix chez Bourso"],
                [p.kidUrl, "Lire le DIC"],
                [h.sourceUrl, "Source des clôtures"],
              ]
                .filter(([url]) => safeUrl(url))
                .map(([url, title]) => (
                  <a
                    key={title}
                    href={safeUrl(url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {title}
                    <ArrowUpRight size={14} />
                  </a>
                ))}
            </div>
            <p className="small muted">
              {p.quoteTimeKind === "observation"
                ? "Heure du relevé, pas horodatage émetteur. "
                : ""}
              Fiscalité, défaut de l’émetteur et événements extraordinaires ne
              sont pas modélisés.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
