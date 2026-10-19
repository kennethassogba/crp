import React from "react";
import { Download, Trash2, Bookmark } from "lucide-react";
import type { Observation } from "./types";
import { date, download, euro, number, percent, signedEuro } from "./format";

export function Journal({
  rows,
  onDelete,
}: {
  rows: Observation[];
  onDelete: (id: string) => void;
}) {
  return (
    <section className="journal-page">
      <div className="page-heading">
        <div>
          <h1>Analyses enregistrées</h1>
          <p>Prix et hypothèses conservés dans ce navigateur.</p>
        </div>
        <button
          className="button secondary"
          disabled={!rows.length}
          onClick={() =>
            download(
              "fin-observations.json",
              JSON.stringify({ version: 1, observations: rows }, null, 2),
            )
          }
        >
          <Download size={15} /> Exporter
        </button>
      </div>
      {!rows.length ? (
        <div className="empty-state">
          <Bookmark size={26} />
          <h2>Aucune analyse enregistrée</h2>
          <p>Ouvrir un contrat puis choisir « Enregistrer l’analyse ».</p>
          <a className="button" href="/warrants/">
            Voir les warrants
          </a>
        </div>
      ) : (
        <div className="observations">
          {rows.map((r) => (
            <article className="observation" key={r.id}>
              <div className="observation-top">
                <div>
                  <span className="eyebrow">{date(r.at, true)}</span>
                  <h2>
                    {r.product.id}{" "}
                    <span>
                      {r.product.underlying} ·{" "}
                      {r.product.direction.toUpperCase()}
                    </span>
                  </h2>
                  <p>
                    Échéance {date(r.product.expiry, true)} · prix enregistré{" "}
                    {euro(r.product.ask, 3)}
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Retirer l’observation ${r.product.id}`}
                  onClick={() => onDelete(r.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <dl className="observation-stats">
                <div>
                  <dt>Budget</dt>
                  <dd>{euro(r.budget)}</dd>
                </div>
                <div>
                  <dt>Gain moyen estimé</dt>
                  <dd>{signedEuro(r.expected)}</dd>
                </div>
                <div>
                  <dt>Probabilité ×{number(r.multiple)}</dt>
                  <dd>{percent(r.probability)}</dd>
                </div>
                <div>
                  <dt>Référence</dt>
                  <dd>{number(r.spot, 2)} $</dd>
                </div>
              </dl>
              <p className="small muted">
                {r.note} · Rendement moyen{" "}
                {r.neutral ? "retiré" : "historique conservé"} · EUR/USD{" "}
                {number(r.fx, 3)}. Aucun rendement réalisé calculé avant
                l’échéance.
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
