import { useSyncExternalStore } from "react";

export type Language = "fr" | "en";
const STORAGE_KEY = "fin-language";
const listeners = new Set<() => void>();
function savedLanguage(): Language {
  try { return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "fr"; }
  catch { return "fr"; }
}
let language: Language = savedLanguage();
function notify() {
  document.documentElement.lang = language;
  for (const listener of listeners) listener();
}
export function setLanguage(value: Language) {
  language = value;
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Storage is optional. */ }
  notify();
}
export const getLanguage = () => language;
export const locale = () => language === "fr" ? "fr-FR" : "en-GB";
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const useLanguage = () => useSyncExternalStore(subscribe, getLanguage);
if (typeof window !== "undefined") {
  document.documentElement.lang = language;
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      language = savedLanguage();
      notify();
    }
  });
}

export const english: Record<string, string> = {
  "Sélection": "Selection",
  "Positions": "Positions",
  "Résultats": "Results",
  "Indisponible": "Unavailable",
  "Objectif atteint": "Target reached",
  "Seuil de perte atteint": "Loss limit reached",
  "20 séances écoulées": "20 sessions elapsed",
  "Clôturée": "Closed",
  "Prix indisponible": "Price unavailable",
  "Sortie en attente": "Exit pending",
  "En cours": "Open",
  "Méthode": "Method",
  "Aller au contenu": "Skip to content",
  "Navigation principale": "Main navigation",
  "Jour de sélection": "Selection date",
  "État des positions": "Position status",
  "Clôturées": "Closed",
  "Toutes": "All",
  "Rechercher un warrant": "Find a warrant",
  "Menu de l’application": "App menu",
  "Collecte en retard. Derniers relevés conservés.": "Data collection delayed. Showing the last observations.",
  "Connexion interrompue. Reconnexion automatique.": "Connection lost. Reconnecting automatically.",
  "Hors ligne. Reconnexion automatique.": "Offline. Reconnecting automatically.",
  "Reconnexion en cours…": "Reconnecting…",
  "Chargement…": "Loading…",
  "Sélections du jour": "Daily selections",
  "Positions simulées": "Simulated positions",
  "Aucun résultat": "No results",
  "Aucune clôture": "No closed positions",
  "Aucune sélection": "No selections",
  "Effacer la recherche": "Clear search",
  "Analyse du warrant": "Warrant analysis",
  "Exporter le journal": "Export journal",
  "Code, ISIN ou sous-jacent": "Code, ISIN or underlying",
  "Afficher": "Show",
  "Page précédente": "Previous page",
  "Page suivante": "Next page",
  "Mise initiale": "Initial investment",
  "Achat": "Purchase",
  "Frais d’achat": "Entry fees",
  "Espèces": "Cash",
  "Échéance": "Expiry",
  "Parité": "Ratio",
  "Valeur nette": "Net value",
  "Perte maximale": "Maximum loss",
  "Sortie": "Exit",
  "Règle": "Rule",
  "+100 % ou −50 %": "+100% or −50%",
  "Scénario bas · P10": "Low scenario · P10",
  "Scénario médian": "Median scenario",
  "Scénario haut · P90": "High scenario · P90",
  "Gain moyen": "Mean profit",
  "Probabilité de gain": "Chance of profit",
  "Atteindre +100 %": "Reach +100%",
  "Volatilité −20 %": "Volatility −20%",
  "Scénarios": "Scenarios",
  "Historique arrêté au": "History through",
  "Volatilité implicite": "Implied volatility",
  "Prévision figée le": "Forecast fixed on",
  "Retour à la liste": "Back to list",
  "Ouvrir ce warrant chez BoursoBank": "Open this warrant at BoursoBank",
  "Gain moyen prévu": "Expected profit",
  "Valeur de la position": "Position value",
  "Comprendre le gain moyen prévu": "About expected profit",
  "Comprendre la valorisation": "About position value",
  "Série affichée": "Displayed series",
  " · Sous-jacent ($)": " · Underlying ($)",
  " · Warrant (€)": " · Warrant (€)",
  "Capital simulé (€)": "Simulated capital (€)",
  "Source et date des cours": "Price source and date",
  " · sous-jacent": " · underlying",
  " · prix bid du warrant": " · warrant bid price",
  "Capital simulé": "Simulated capital",
  "Un seul relevé disponible.": "Only one observation available.",
  "Position": "Position",
  "Prévision": "Forecast",
  "Valorisation": "Valuation",
  "Gain moyen simulé pour une mise de 1 000 €, après spread et courtage, avant impôts.": "Mean simulated profit on €1,000, after spread and brokerage fees, before tax.",
  "Valeur de revente simulée au dernier bid disponible, frais et espèces restantes inclus, avant impôts.": "Simulated sale value at the latest available bid, including fees and remaining cash, before tax.",
  "Sortie après 20 séances ou au premier relevé à +100 % / −50 %. Un gap peut dépasser ces seuils.": "Exit after 20 sessions or at the first observation at +100% / −50%. A price gap can exceed these thresholds.",
  "Modèle non validé. La perte peut atteindre le montant engagé.": "Unvalidated model. The full investment may be lost.",
  "Cours et sélection": "Prices and selection",
  "Warrant relevé le": "Warrant observed",
  "Mise à jour": "Updates",
  "Automatique · relevés quotidiens": "Automatic · daily observations",
  "Gris : avant sélection. Bleu : depuis la sélection. Le sous-jacent, le bid du warrant et le capital sont des séries distinctes.": "Grey: before selection. Blue: since selection. The underlying, warrant bid and capital are separate series.",
  "Les prix publics sont indicatifs ; l’heure de cotation émetteur est inconnue.": "Public prices are indicative; the issuer’s quote time is unknown.",
  "Informations sur la position": "Position information",
  "Entrée": "Entry",
  "Contrat": "Contract",
  "Document émetteur": "Issuer document",
  "Prévision initiale": "Initial forecast",
  "Chances": "Chances",
  "Modèle": "Model",
  "Résultats affichés": "Displayed results",
  "Bilan": "Summary",
  "Clôtures": "Closed",
  "Gain réalisé": "Realised profit",
  "Gagnantes": "Win rate",
  "Évaluer le modèle": "Evaluate model",
  "Qualité du modèle": "Model quality",
  "Probabilité moyenne prévue": "Mean forecast probability",
  "Clôtures gagnantes": "Profitable exits",
  "Brier · plus bas = mieux": "Brier · lower is better",
  "Référence à 50 %": "50% baseline",
  "{count} clôtures sur 30 minimum. Échantillon insuffisant.": "{count} exits out of a minimum of 30. Insufficient sample.",
  "Échantillon exploratoire ; les positions peuvent être corrélées.": "Exploratory sample; positions may be correlated.",
  "{count} positions sans prix récent restent dans le suivi.": "{count} positions without a recent price remain in the tracker.",
  "Aucune clôture pour comparer les prévisions aux résultats.": "No closed positions to compare forecasts with outcomes.",
  "Filtrer": "Filter",
  "Prix récents, offre BoursoMarkets confirmée, spread de 8 % maximum et échéance au moins sept jours après la sortie prévue. Un contrat déjà sélectionné n’est jamais repris.": "Recent prices, a confirmed BoursoMarkets offer, a spread of at most 8% and expiry at least seven days after the planned exit. A selected contract is never selected again.",
  "Classer": "Rank",
  "Les trajectoires historiques sont rejouées sur 20 séances, sans leur tendance passée. Le score combine le gain P90 et la plus faible espérance entre cinq ans, un an et volatilité réduite de 20 %.": "Historical paths are replayed over 20 sessions with their past trend removed. The score combines P90 profit with the lowest expected profit across five years, one year and volatility reduced by 20%.",
  "Simuler 1 000 €": "Simulate €1,000",
  "Jusqu’à trois nouveaux warrants, sur des sous-jacents différents. Une mise indépendante de 1 000 € chacun, achetée à l’ask en unités entières. Les espèces restantes sont conservées.": "Up to three new warrants on different underlyings. Each has an independent €1,000 investment, bought at the ask in whole units. Remaining cash is kept.",
  "Clôturer": "Close",
  "Au premier relevé à +100 % ou −50 %, sinon après 20 séances américaines. La sortie utilise le bid observé, même après un gap. Un prix manquant ne devient jamais un résultat nul.": "At the first observation at +100% or −50%, otherwise after 20 US trading sessions. The exit uses the observed bid, even after a gap. A missing price is never treated as a zero return.",
  "Évaluer": "Evaluate",
  "Prix d’entrée, prévisions et règle restent figés. Toutes les clôtures sont comptées. Le score de Brier compare les probabilités initiales aux résultats. Aucun avantage prédictif n’est encore démontré.": "Entry prices, forecasts and rules stay fixed. Every exit is counted. The Brier score compares initial probabilities with outcomes. No predictive edge has been demonstrated yet.",
  "Connaître les limites": "Understand the limits",
  "Relevés publics indicatifs ; heure émetteur inconnue. Le modèle suppose taux et dividendes nuls, change et spread constants. Le DIC reste à vérifier avant un achat réel. Aucun ordre n’est envoyé.": "Indicative public observations; issuer quote time unknown. The model assumes zero rates and dividends, and constant FX and spread. The KID must be checked before a real purchase. No orders are sent.",
  "Sources et données": "Sources and data",
  "Protocole": "Protocol (FR)",
  "Dernier calcul": "Last calculation",
  "Univers observé": "Observed universe",
  "Collecte": "Collection",
  "Lun.–ven. · 21 h 30 UTC": "Mon–Fri · 21:30 UTC",
  "Code et données": "Code and data",
  "Période du cours": "Chart period",
  "1S": "1W",
  "1A": "1Y",
  "Dézoomer le graphique": "Zoom out chart",
  "Zoomer le graphique": "Zoom in chart",
  "Afficher tout l’historique": "Show all history",
  "Flèches pour lire les prix, début et fin pour les extrêmes.": "Use arrow keys to read prices, Home and End for the first and last points.",
  "Courbe grise avant sélection, bleue à partir du": "Grey line before selection, blue from",
  "Fermer": "Close",
  "Installer Fin": "Install Fin",
  "Ouverture…": "Opening…",
  "Installer": "Install",
  "Masquer la proposition d’installation": "Dismiss installation suggestion",
  "Fermer le guide d’installation": "Close installation guide",
  "Ajouter Fin à l’écran d’accueil.": "Add Fin to the home screen.",
  "Partager": "Share",
  "Sur l’écran d’accueil": "Add to Home Screen",
  "Ouvrir comme app web": "Open as Web App",
  "Ajouter": "Add",
  "Si le partage est absent, ouvrir cette page dans Safari.": "If Share is missing, open this page in Safari.",
  "Ouvrir le menu ": "Open the ",
  " du navigateur": " menu in the browser",
  "Choisir ": "Choose ",
  "Activer ": "Enable ",
  " si proposé, puis choisir ": " if offered, then choose ",
  "Ouvrir le menu du navigateur et choisir Installer. Si l’installation est indisponible, recharger la page puis réessayer.": "Open the browser menu and choose Install. If installation is unavailable, reload the page and try again.",
};

export function t(text: string, values: Record<string, string | number> = {}) {
  const translated = language === "en" ? (english[text] ?? text) : text;
  return translated.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}
