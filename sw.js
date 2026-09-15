/* 離線快取：首載後斷網可跑；快取優先 + 背景更新（部署更新於下次開啟生效） */
const CACHE='mt-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(url.searchParams.has('debug'))return; // debug 請求不進快取
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const hit=await c.match(e.request);
    const net=fetch(e.request).then(r=>{
      if(r.ok)c.put(e.request,r.clone()); return r;
    }).catch(()=>hit);
    return hit||net;
  })());
});
