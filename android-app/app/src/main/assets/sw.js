const CACHE_NAME = "bomb-battle-v3";
const ASSETS = [
  "/",
  "/emulator",
  "/emulator.html",
  "/styles.css",
  "/game.js",
  "/manifest.json",
  "/icon.png",
  "/chiikawa-royale-logo.png",
  "/film-lobby-background.png",
  "/lobby-pedestal.png",
  "/select-film-background.png",
  "/uwauwa.mp3",
  "/assets/chihua-studio-logo.png",
  "/assets/chiikawa-royale-characters.png",
  "/assets/vs.png",
  "/assets/cards/chiikawa.png",
  "/assets/cards/hachiware.png",
  "/assets/cards/usagi.png",
  "/assets/cards/momonga.png",
  "/assets/lobby cards/chiikawa character card.png",
  "/assets/lobby cards/hachiware character card.png",
  "/assets/lobby cards/usagi character card.png",
  "/assets/lobby cards/momonga character card.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn("Service worker caching failed on install:", err);
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

  const url = event.request.url;
  // Ignore WebSockets, Supabase API endpoints, or database endpoints
  if (url.startsWith("ws:") || url.startsWith("wss:") || url.includes("supabase.co")) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version immediately, but refresh cache in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => { /* ignore offline network failures */ });
        return cachedResponse;
      }

      // If not cached, retrieve from network and cache dynamically for offline play
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== "basic" && networkResponse.type !== "cors")) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch((err) => {
        return cachedResponse || Promise.reject(err);
      });
    })
  );
});
