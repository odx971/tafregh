"use strict";

const SHARE_CACHE = "tafregh-shared";
const PRECACHE = "tafregh-static-v1";
const PRECACHE_URLS = [
  "/tafregh/",
  "/tafregh/index.html",
  "/tafregh/manifest.webmanifest",
  "/tafregh/icons/icon-192.png",
  "/tafregh/icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(PRECACHE).then(cache => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== PRECACHE && k !== SHARE_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  const isSharePost =
    request.method === "POST" &&
    (url.pathname === "/tafregh/" || url.pathname === "/tafregh/index.html") &&
    url.searchParams.get("shared") !== null;

  if (isSharePost) {
    event.respondWith(
      (async () => {
        try {
          const fd = await request.formData();
          let file = fd.get("audio");
          if (!(file instanceof File)) {
            const all = Array.from(fd.values());
            file = all.find(v => v instanceof File) || null;
          }
          const title = (fd.get("title") || "").toString();
          if (file instanceof File && file.size > 0) {
            const cache = await caches.open(SHARE_CACHE);
            await cache.delete("shared");
            await cache.put("shared", new Response(file, {
              headers: {
                "Content-Type": file.type || "application/octet-stream",
                "X-File-Name": encodeURIComponent(file.name),
                "X-File-Title": encodeURIComponent(title)
              }
            }));
          }
          const clients = await self.clients.matchAll({ includeUncontrolled: true });
          for (const client of clients) client.postMessage({ type: "SHARED_FILE_READY" });
          return Response.redirect("/tafregh/", 303);
        } catch (err) {
          return Response.redirect("/tafregh/", 303);
        }
      })()
    );
    return;
  }

  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(PRECACHE).then(cache => cache.put("/tafregh/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/tafregh/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        const copy = res.clone();
        caches.open(PRECACHE).then(cache => cache.put(request, copy));
        return res;
      });
    })
  );
});
