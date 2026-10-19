import React, { useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Download,
  Info,
  ChevronDown,
} from "lucide-react";
import type { Dataset, Product } from "./types";
import { Distribution, PriceChart } from "./Charts";
import {
  date,
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
  const [tab, setTab] = useState("distribution");
  if (!r || r.error)
    return (
      <section className="detail-empty" aria-live="polite">
        <Info size={23} />
        <h2>{r?.error ?? "Sélectionner un produit"}</h2>
        <p>Un contrat valide et un historique sont nécessaires au calcul.</p>
      </section>
    );
  const m = r.long,
    h = dataset.assets[p.underlying];
  if (!m)
    return (
      <section className="detail-empty">
        <h2>Budget insuffisant</h2>
        <p>Augmenter le budget pour acheter au moins une unité.</p>
      </section>
    );
  const thresholds = [
    p.strike,
    r.breakEven,
    r.multipleThreshold,
    r.spot * (p.direction === "call" ? 1.4 : 0.6),
  ];
  const exportResult = () =>
    download(
      `fin-${p.id}-${options.asOf}.json`,
      JSON.stringify(
        {
          engine: "1.0.0",
          exportedAt: new Date().toISOString(),
          options,
          product: p,
          underlying: {
            spot: r.spot,
            historyDate: h.dates.at(-1),
            source: h.source,
            sourceUrl: h.sourceUrl,
          },
          result: r,
          bootstrap: interval,
          interpretation:
            "Recherche exploratoire à échéance. Aucun avantage prédictif démontré.",
        },
        null,
        2,
      ),
    );
  return (
    <section
      className={`detail-panel ${busy ? "calculating" : ""}`}
      aria-busy={busy}
    >
      <div className="detail-heading">
        <div>
          <div className="eyebrow">
            {h.name} <span className="dot-separator">/</span> Warrant{" "}
            {p.direction}
          </div>
          <h2>
            {p.id}
            <span className="status-chip">{r.status}</span>
          </h2>
          <p>
            {p.isin} · strike {number(p.strike)} $ · {date(p.expiry, true)}
          </p>
        </div>
        <div className="detail-tools">
          <button
            className="icon-button"
            aria-label="Exporter cette analyse"
            onClick={exportResult}
          >
            <Download size={17} />
          </button>
          <button
            className="button secondary compact"
            onClick={onSave}
            disabled={busy}
          >
            {saved ? (
              "Enregistré"
            ) : (
              <>
                <Bookmark size={14} /> Enregistrer l’analyse
              </>
            )}
          </button>
        </div>
      </div>
      <div className="metric-row">
        <div className="metric main-metric">
          <span>
            Espérance nette estimée{" "}
            <a
              href="/warrants/methode/#maths"
              aria-label="Comprendre l’espérance"
            >
              <Info size={13} />
            </a>
          </span>
          <strong className={m.expected >= 0 ? "positive" : "negative"}>
            {signedEuro(m.expected)}
          </strong>
          <small>
            {interval ? (
              <>
                Intervalle conditionnel 95 % :<br />
                {signedEuro(interval.lower)} à {signedEuro(interval.upper)}
              </>
            ) : (
              "Calcul de l’incertitude…"
            )}
          </small>
        </div>
        <div className="metric">
          <span>Probabilité de ×{options.multiple}</span>
          <strong>{percent(m.multiple)}</strong>
          <small>
            À l’échéance
            <br />
            selon le modèle historique
          </small>
        </div>
        <div className="metric">
          <span>Risque de perte totale</span>
          <strong className="negative">{percent(m.zero)}</strong>
          <small>
            {euro(r.maxLoss)} exposés
            <br />
            sans appel de marge
          </small>
        </div>
      </div>
      <div className="interpretation">
        <span className="interpretation-mark">i</span>
        <p>
          {interval?.lower > 0 && r.pessimistic > 0
            ? "Les modèles comparés restent positifs. Il faut encore corriger la sélection multiple et valider dans le futur."
            : "L’espérance change selon les hypothèses. Ce résultat ne démontre pas un avantage exploitable."}
        </p>
      </div>
      <div
        className="detail-tabs"
        role="tablist"
        aria-label="Détails du warrant"
      >
        {[
          ["distribution", "Distribution"],
          ["sensitivity", "Sensibilité"],
          ["contract", "Contrat & sources"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-controls={`panel-${id}`}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="detail-tab-content"
      >
        {tab === "distribution" && (
          <>
            <div className="section-caption">
              <h3>Ce que donnent les scénarios</h3>
              <span>
                {number(m.samples)} fenêtres glissantes · {r.horizon} séances
              </span>
            </div>
            <Distribution net={m.net} budget={r.cost} />
            <div className="scenario-heading">
              <h3>Seuils à l’échéance</h3>
              <span>
                Palantir, Nasdaq ou action : référence à la date du contrat
              </span>
            </div>
            <table className="scenario-table">
              <thead>
                <tr>
                  <th>Niveau du sous-jacent</th>
                  <th>Variation</th>
                  <th>Gain net</th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((s, i) => (
                  <tr key={i}>
                    <td>
                      {number(s, 2)} ${" "}
                      <span>
                        {
                          [
                            "Strike",
                            "Rentabilité",
                            `Warrant ×${options.multiple}`,
                            "Scénario de mouvement",
                          ][i]
                        }
                      </span>
                    </td>
                    <td>{percent(s / r.spot - 1)}</td>
                    <td
                      className={
                        r.quantity * payoff(p, s, options.fx) - r.cost >= -0.001
                          ? "positive"
                          : "negative"
                      }
                    >
                      {signedEuro(
                        r.quantity * payoff(p, s, options.fx) - r.cost,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small muted">
              Remboursements à échéance, avant impôts. Le gain d’une revente
              avant cette date dépend aussi de la volatilité et du spread.
            </p>
          </>
        )}
        {tab === "sensitivity" && (
          <>
            <h3>Le signe de l’espérance tient-il ?</h3>
            <p className="small muted">
              Même contrat, prix d’achat et budget. Seule la distribution des
              scénarios change.
            </p>
            <table className="sensitivity-table">
              <thead>
                <tr>
                  <th>Modèle</th>
                  <th>Gain moyen net</th>
                  <th>Chance de gain</th>
                  <th>Chance ×{options.multiple}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Historique · 5 ans", r.long],
                  ["Historique · 1 an", r.short],
                  [
                    `Lognormal · vol. 20 séances (${percent(r.vol20, 0)})`,
                    r.model20,
                  ],
                  [
                    `Lognormal · vol. 60 séances (${percent(r.vol60, 0)})`,
                    r.model60,
                  ],
                  [
                    `Lognormal · vol. 252 séances (${percent(r.vol252, 0)})`,
                    r.model252,
                  ],
                ].map(([label, v]) => {
                  const row = v as any;
                  return (
                    <tr key={String(label)}>
                      <td>{String(label)}</td>
                      <td
                        className={row?.expected >= 0 ? "positive" : "negative"}
                      >
                        {row ? signedEuro(row.expected) : "—"}
                      </td>
                      <td>{row ? percent(row.profit) : "—"}</td>
                      <td>{row ? percent(row.multiple) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="model-footnote">
              <h4>Un intervalle conditionnel</h4>
              <p>
                {interval
                  ? `${number(interval.repetitions)} rééchantillonnages de blocs de ${interval.block} observations. `
                  : ""}
                La dépendance entre fenêtres est prise en compte. Le choix du
                modèle, les changements de régime et les comparaisons multiples
                ne le sont pas entièrement.
              </p>
            </div>
            <h3 className="chart-heading">Le sous-jacent sur un an</h3>
            <PriceChart closes={h.closes} dates={h.dates} name={h.name} />
            <p className="small muted">
              Dernière clôture : {number(r.spot, 2)} $ ·{" "}
              {date(h.dates.at(-1)!, true)} · {h.source}
            </p>
          </>
        )}
        {tab === "contract" && (
          <>
            <dl className="contract-grid">
              {[
                ["Achat / vente", `${euro(p.ask, 3)} / ${euro(p.bid, 3)}`],
                ["Quantité", number(r.quantity)],
                ["Coût total", euro(r.cost, 2)],
                ["Espèces restantes", euro(r.cash, 2)],
                [
                  "Spread immédiat",
                  `${euro(r.spreadCost, 2)} (${percent(r.spread)})`,
                ],
                [
                  "Courtage",
                  p.commission || p.commissionPct
                    ? `${euro(p.commission ?? 0)} + ${number(p.commissionPct ?? 0, 2)} %`
                    : p.venueVerified
                      ? "0 € · BoursoMarkets vérifié"
                      : "0 € · hypothèse à vérifier",
                ],
                ["Ratio", `${number(p.ratio, 4)} (${number(1 / p.ratio)}:1)`],
                ["Change supposé", `1 € = ${number(options.fx, 3)} $`],
                ["Référence du prix", date(p.quoteAt)],
                [
                  "Disponibilité Bourso",
                  p.venueVerified
                    ? "Page et badge vérifiés"
                    : "À vérifier chez le courtier",
                ],
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
                [p.sourceUrl, "Lire les caractéristiques émetteur"],
                [p.kidUrl, "Lire le DIC"],
                [h.sourceUrl, "Source de l’historique"],
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
                    <ArrowUpRight size={15} />
                  </a>
                ))}
            </div>
            <p className="small muted">
              Le contrat et la négociabilité doivent être revérifiés auprès de
              l’émetteur et du courtier. Le calcul ne couvre ni défaut de
              l’émetteur, ni événement extraordinaire, ni fiscalité. Un change
              plus défavorable réduit le remboursement.
            </p>
          </>
        )}
      </div>
      <details className="assumptions">
        <summary>
          Hypothèses de cette analyse <ChevronDown size={14} />
        </summary>
        <p>
          Analyse au {date(options.asOf)}. Modèle historique sur cinq ans ;{" "}
          {options.neutral
            ? "hausse moyenne retirée"
            : "hausse moyenne conservée : hypothèse optimiste possible"}
          . EUR/USD constant à {number(options.fx, 3)}. {r.horizon} séances
          estimées jusqu’à l’échéance. Frais du contrat incorporés au prix
          d’achat ; aucun second spread soustrait au remboursement final.
          Données et réglages dans l’export.
        </p>
      </details>
    </section>
  );
}
