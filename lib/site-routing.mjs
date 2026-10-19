export function legacyRedirect(url) {
  if (url.hostname !== "crp.keff.uk") return null;
  const target = new URL(url.pathname + url.search, "https://fin.keff.uk");
  if (["/", "/index.html", "/crp.html"].includes(url.pathname))
    target.pathname = "/crp/";
  return target.href;
}
export function htmlEntry(path) {
  if (path === "/crp/" || path === "/crp.html") return "/crp.html";
  if (
    [
      "/",
      "/index.html",
      "/warrants/",
      "/warrants/methode/",
      "/warrants/suivi/",
    ].includes(path)
  )
    return "/index.html";
  if (path === "/crp/sw.js") return "/sw.js";
  if (path === "/crp/manifest.webmanifest") return "/crp-manifest.webmanifest";
  return null;
}
