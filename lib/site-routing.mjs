export function legacyRedirect(url) {
  if (url.hostname === "crp.keff.uk") return "https://fin.keff.uk/";
  const map = {
    "/warrants/": "/",
    "/warrants/experience/": "/positions/",
    "/warrants/suivi/": "/positions/",
    "/warrants/methode/": "/methode/",
    "/donnees/": "/methode/",
  };
  const normalized = url.pathname.endsWith("/")
    ? url.pathname
    : url.pathname + "/";
  if (map[normalized])
    return new URL(map[normalized] + url.search, "https://fin.keff.uk").href;
  return null;
}
export function htmlEntry(path) {
  return [
    "/",
    "/index.html",
    "/positions/",
    "/resultats/",
    "/methode/",
  ].includes(path)
    ? "/index.html"
    : null;
}
