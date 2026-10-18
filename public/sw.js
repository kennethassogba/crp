const CACHE='crp-shell-v3';
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  const response=await fetch('/');
  if(!response.ok)throw new Error('App shell unavailable');
  const html=await response.clone().text();
  const entries=[...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map(match=>match[1]);
  await cache.put('/',response);
  await cache.addAll([...new Set([...entries,'/icon-192.png','/icon-512.png','/manifest.webmanifest'])]);
 })());
 self.skipWaiting();
});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))]));});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||event.request.method!=='GET')return;
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/data/'))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?caches.match('/'):new Response('Offline',{status:503})))));
});
