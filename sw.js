const CACHE_NAME = "onlyfrens-v0.0.3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/api.js",
  "./js/auth.js",
  "./js/auth-screen.js",
  "./js/comments-sheet.js",
  "./js/compress.js",
  "./js/composer.js",
  "./js/config.js",
  "./js/friends.js",
  "./js/home.js",
  "./js/icons.js",
  "./js/notifications.js",
  "./js/post-card.js",
  "./js/profile.js",
  "./js/utils.js",
  "./typography/jost-400.woff2",
  "./typography/jost-500.woff2",
  "./typography/jost-600.woff2",
  "./typography/jost-700.woff2",
  "./assets/icons/avatar-placeholder.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ASSETS.map((asset) => cache.add(asset).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request)
        .then((response) => {
          if (response.ok) cache.put(e.request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
