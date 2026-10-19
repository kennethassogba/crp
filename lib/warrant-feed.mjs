import { load } from "cheerio";
import { validateProduct } from "./warrants.mjs";

export const BOURSO = "https://www.boursorama.com";
export const SEARCH = "/bourse/produits-de-bourse/levier/warrants/resultats";
export const UNIVERSE = {
  NDX: "NASDAQ 100 INDEX",
  NVDA: "NVIDIA",
  TSLA: "TESLA",
  AMD: "AMD (ADVANCED MICRO DEVICES)",
  PLTR: "PALANTIR TECHNOLOGIES",
};
export const decimal = (text) => {
  const value = String(text)
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(",", ".");
  return /^[+-]?\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;
};
export function frenchDate(text) {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!m) throw Error("Échéance absente");
  return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2]}-${m[1]}`;
}
export function parseSearch(html, underlying, now = Date.now()) {
  const $ = load(html),
    rows = [];
  $(".c-table tbody tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .map((_, x) => $(x).text().trim().replace(/\s+/g, " "))
      .get();
    const isin = cells[0];
    if (
      !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin ?? "") ||
      !/^Warrants (Call|Put)$/.test(cells[2] ?? "") ||
      !/SOCIETE GENERALE/.test(cells[11] ?? "")
    )
      return;
    try {
      const expiry = frenchDate(cells[5]),
        days = (Date.parse(expiry) - now) / 86400000;
      const bid = decimal(cells[7]),
        ask = decimal(cells[8]);
      if (days < 14 || days > 120 || !(ask > 0 && bid > 0 && ask >= bid))
        return;
      rows.push({
        isin,
        underlying,
        expiry,
        strike: decimal(cells[4]),
        direction: /Put/.test(cells[2]) ? "put" : "call",
        bid,
        ask,
        brokerUrl: `${BOURSO}/bourse/produits-de-bourse/cours/warrants/3rP${isin}`,
      });
    } catch {
      /* An unsupported row is excluded, never repaired by guessing. */
    }
  });
  return rows;
}
export function parseProduct(html, candidate, at = new Date().toISOString()) {
  const $ = load(html),
    facts = {};
  if ($(".c-faceplate__isin").text().trim() !== candidate.isin)
    throw Error("ISIN de la page différent");
  $(".c-list-info__item").each((_, item) => {
    const key = $(item).find(".c-list-info__heading").text().trim();
    if (key) {
      const value = $(item).find(".c-list-info__value");
      facts[key] = (value.find("a").first().text() || value.text())
        .trim()
        .replace(/\s+/g, " ");
    }
  });
  const normalized = (value) =>
    String(value)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  if (
    !UNIVERSE[candidate.underlying] ||
    normalized(facts["Sous-jacent"]) !==
      normalized(UNIVERSE[candidate.underlying])
  )
    throw Error("Sous-jacent différent du filtre demandé");
  if (facts["Quanto"] !== "Non" || facts["Statuts"] !== "Actif")
    throw Error("Produit inactif ou quanto non exclu");
  const type = facts["Nature / Type"] ?? facts.Type;
  if (!/^Warrants (Call|Put)$/.test(type ?? ""))
    throw Error("Produit hors périmètre");
  if (!/SOCIETE GENERALE/.test(facts["Émetteur"] ?? ""))
    throw Error("Émetteur hors périmètre");
  const strike = facts.Strike?.match(/^([\d\s.,]+)\s+(USD|EUR)$/);
  if (!strike) throw Error("Strike ou devise absent");
  const ratioDenominator = decimal(facts["Parité"]);
  if (!(ratioDenominator > 0)) throw Error("Parité absente");
  const venueVerified =
    /Produit Boursomarkets/.test(
      $(".c-faceplate__offer-logo").attr("title") ?? "",
    ) ||
    /Produit Boursomarkets/.test(
      $(".c-faceplate [role=tooltip]").attr("title") ?? "",
    );
  const product = {
    ...candidate,
    id: candidate.id ?? candidate.isin.slice(5),
    direction: /Put/.test(type) ? "put" : "call",
    strike: decimal(strike[1]),
    currency: strike[2],
    ratio: 1 / ratioDenominator,
    expiry: frenchDate(facts["Maturité"] ?? facts["Échéance"]),
    bid: decimal($(".c-faceplate__price [data-ist-bid-price]").first().text()),
    ask: decimal($(".c-faceplate__price [data-ist-ask-price]").first().text()),
    quoteAt: at,
    observedAt: at,
    sourceQuoteAt: null,
    quoteTimeKind: "observation",
    source: "Boursorama · page publique, relevé bid/ask",
    sourceUrl: candidate.brokerUrl,
    issuer: "Société Générale",
    venueVerified,
    minOrder: 500,
    commission: 0,
    commissionPct: venueVerified ? 0 : 0.1,
    commissionMin: venueVerified ? 0 : 9.95,
    style: "european",
    contractVerified: candidate.contractVerified ?? false,
    discoveredAt: candidate.discoveredAt ?? at,
    kidUrl: `https://kid.sgmarkets.com/public/api/kid/isin/${candidate.isin}?lang=fre`,
  };
  const errors = validateProduct(product);
  if (errors.length || !product.bid)
    throw Error(errors.join(", ") || "Fourchette indisponible");
  return product;
}
