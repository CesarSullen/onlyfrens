const CACHE_NAME = "onlyfrens-v0.0.6";
const IMAGE_CACHE = "onlyfrens-images";
const MAX_IMAGES = 150;
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/api.js",
  "./js/auth.js",
  "./js/auth-screen.js",
  "./js/cache.js",
  "./js/likers.js",
  "./js/oauth.js",
  "./js/password-field.js",
  "./js/password-reset.js",
  "./js/complete-profile.js",
  "./js/comments-sheet.js",
  "./js/compress.js",
  "./js/composer.js",
  "./js/config.js",
  "./js/friends.js",
  "./js/home.js",
  "./js/icons.js",
  "./js/loader.js",
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
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== IMAGE_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

async function cachedImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return cached;

  try {
    const response = await fetch(request.url, { mode: "cors", credentials: "omit" });
    if (response.ok) {
      await cache.put(request.url, response.clone());
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_IMAGES)).map((k) => cache.delete(k)));
    }
    return response;
  } catch {
    return fetch(request);
  }
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  if (e.request.destination === "image" && url.origin !== self.location.origin) {
    e.respondWith(cachedImage(e.request));
    return;
  }

  if (url.origin !== self.location.origin) return;

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
