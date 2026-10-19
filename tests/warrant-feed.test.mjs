import test from "node:test";
import assert from "node:assert/strict";
import { parseProduct, parseSearch } from "../lib/warrant-feed.mjs";
const isin = "DE000FG35JX0",
  candidate = {
    isin,
    underlying: "PLTR",
    brokerUrl: `https://www.boursorama.com/bourse/produits-de-bourse/cours/warrants/3rP${isin}`,
  };
const fact = (k, v) =>
  `<li class="c-list-info__item"><p class="c-list-info__heading">${k}</p><p class="c-list-info__value">${v}</p></li>`;
const html = `<h2 class="c-faceplate__isin">${isin}</h2><div class="c-faceplate"><div class="c-faceplate__offer-logo" title="Produit Boursomarkets : 0€ de commission"></div><div class="c-faceplate__price"><span data-ist-bid-price>0,330</span><span data-ist-ask-price>0,340</span></div></div>${[
  ["Sous-jacent", "PALANTIR TECHNOLOGIES"],
  ["Quanto", "Non"],
  ["Statuts", "Actif"],
  ["Nature / Type", "Warrants Call"],
  ["Émetteur", "SOCIETE GENERALE"],
  ["Strike", "225 USD"],
  ["Parité", "20"],
  ["Maturité", "18/12/26"],
]
  .map(([k, v]) => fact(k, v))
  .join("")}`;
test("public quote observation keeps source uncertainty, ratio and fees explicit", () => {
  const p = parseProduct(html, candidate, "2026-10-20T06:00:00Z");
  assert.equal(p.ask, 0.34);
  assert.equal(p.bid, 0.33);
  assert.equal(p.ratio, 0.05);
  assert.equal(p.strike, 225);
  assert.equal(p.expiry, "2026-12-18");
  assert.equal(p.sourceQuoteAt, null);
  assert.equal(p.quoteTimeKind, "observation");
  assert.equal(p.contractVerified, false);
  assert.equal(p.venueVerified, true);
  assert.equal(p.minOrder, 500);
  assert.equal(p.quoteAt, p.observedAt);
});
test("mismatched pages, missing ask, quanto and inactive contracts fail closed", () => {
  for (const text of [
    html.replace(isin, "DE000FG32YX6"),
    html.replace("0,340", ""),
    html.replace(">Non<", ">Oui<"),
    html.replace(">Actif<", ">Expiré<"),
    html.replace(">20<", ">0<"),
    html.replace("PALANTIR TECHNOLOGIES", "AMAZON.COM"),
  ])
    assert.throws(() => parseProduct(text, candidate));
});
test("catalogue discovery rejects unpriced, expired and unsupported products", () => {
  const row = (cells) =>
    `<table class="c-table"><tbody><tr>${cells.map((v) => `<td>${v}</td>`).join("")}</tr></tbody></table>`;
  const cells = [
    isin,
    "",
    "Warrants Call",
    "PALANTIR",
    "225,000",
    "18/12/26",
    "",
    "0,330",
    "0,340",
    "",
    "",
    "SOCIETE GENERALE",
  ];
  assert.equal(
    parseSearch(row(cells), "PLTR", Date.parse("2026-10-20")).length,
    1,
  );
  for (const change of [
    { 2: "Turbo Call" },
    { 7: "0,000" },
    { 8: "0,000" },
    { 5: "18/09/26" },
    { 11: "AUTRE" },
  ])
    assert.equal(
      parseSearch(
        row(Object.assign([...cells], change)),
        "PLTR",
        Date.parse("2026-10-20"),
      ).length,
      0,
    );
});
