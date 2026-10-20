const CACHE = "fin-shell-v9";
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE),
        response = await fetch("/");
      if (!response.ok) throw Error("App shell unavailable");
      const html = await response.clone().text();
      const entries = [
        ...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g),
      ].map((m) => m[1]);
      await cache.put("/", response);
      await cache.addAll([
        ...new Set([
          ...entries,
          "/manifest.webmanifest",
          "/icon-192.png",
          "/icon-512.png",
        ]),
      ]);
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET")
    return;
  if (
    ["/api/", "/data/", "/research/", "/cdn-cgi/"].some((prefix) =>
      url.pathname.startsWith(prefix),
    )
  )
    return;
  const dev = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    !dev &&
    event.request.mode !== "navigate" &&
    !["/assets/", "/icon-", "/manifest.webmanifest"].some((p) =>
      url.pathname.startsWith(p),
    )
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)),
          );
        }
        return response;
      })
      .catch(
        async () =>
          (await caches.match(event.request)) ||
          (event.request.mode === "navigate"
            ? await caches.match("/")
            : new Response("Offline", { status: 503 })),
      ),
  );
});
