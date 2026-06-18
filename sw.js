const CACHE_NAME = "bomb-battle-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/game.js",
  "/manifest.json",
  "/icon.png",
  "/assets/chihua-studio-logo.png",
  "/assets/chiikawa-royale-characters.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn("Service worker caching failed on install (likely missing icon.png initially, which is fine):", err);
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Ignore WebSocket or socket-like connections
  if (event.request.url.startsWith("ws:") || event.request.url.startsWith("wss:")) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh in background and update cache, but return cached version instantly
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => { /* ignore network errors */ });
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
