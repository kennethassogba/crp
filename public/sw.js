const CACHE='crp-shell-v5';
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  const response=await fetch('/crp/');
  if(!response.ok)throw new Error('App shell unavailable');
  const html=await response.clone().text();
  const entries=[...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map(match=>match[1]);
  await cache.put('/crp/',response);
  await cache.addAll([...new Set([...entries,'/icon-192.png','/icon-512.png','/crp/manifest.webmanifest'])]);
 })());
 self.skipWaiting();
});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))]));});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||event.request.method!=='GET')return;
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/data/')||url.pathname.startsWith('/research/'))return;
 const dev=['localhost','127.0.0.1'].includes(url.hostname);
 if(!dev&&!url.pathname.startsWith('/crp/')&&!url.pathname.startsWith('/assets/')&&!url.pathname.startsWith('/icon-'))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?caches.match('/crp/'):new Response('Offline',{status:503})))));
});
