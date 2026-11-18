const CACHE_NAME = "onlyfrens-v0.0.17";
const IMAGE_CACHE = "onlyfrens-images";
const SHARE_CACHE = "onlyfrens-share";
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
  "./js/badges.js",
  "./js/push.js",
  "./js/avatar.js",
  "./js/verified.js",
  "./js/navigation.js",
  "./js/profile-view.js",
  "./js/user-profile.js",
  "./js/interactions.js",
  "./js/oauth.js",
  "./js/password-field.js",
  "./js/password-reset.js",
  "./js/complete-profile.js",
  "./js/comments-sheet.js",
  "./js/compress.js",
  "./js/composer.js",
  "./js/audience-picker.js",
  "./js/friend-search.js",
  "./js/hashtag-page.js",
  "./js/hashtag-search.js",
  "./js/hashtags.js",
  "./js/rewards.js",
  "./js/config.js",
  "./js/contact.js",
  "./js/friends.js",
  "./js/home.js",
  "./js/icons.js",
  "./js/loader.js",
  "./js/notifications.js",
  "./js/post-card.js",
  "./js/profile.js",
  "./js/pull-refresh.js",
  "./js/share.js",
  "./js/utils.js",
  "./assets/shortcuts/friends.png",
  "./assets/shortcuts/notifications.png",
  "./assets/shortcuts/profile.png",
  "./typography/jost-400.woff2",
  "./typography/jost-500.woff2",
  "./typography/jost-600.woff2",
  "./typography/jost-700.woff2",
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
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== IMAGE_CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k)))
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

// Files shared from other apps arrive as a POST: keep them for the app and open the composer.
async function receiveShare(request) {
  const form = await request.formData();
  const cache = await caches.open(SHARE_CACHE);
  await Promise.all((await cache.keys()).map((k) => cache.delete(k)));

  const text = [form.get("text"), form.get("url")].filter(Boolean).join(" ");
  if (text) await cache.put(`${self.registration.scope}shared/text`, new Response(text));

  const images = form.getAll("images").filter((file) => file.type.startsWith("image/"));
  await Promise.all(
    images.map((file, i) =>
      cache.put(`${self.registration.scope}shared/image-${i}`, new Response(file, { headers: { "Content-Type": file.type } })),
    ),
  );

  return Response.redirect(`${self.registration.scope}#share`, 303);
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  if (e.request.method === "POST" && url.href === `${self.registration.scope}share-target`) {
    e.respondWith(receiveShare(e.request));
    return;
  }

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

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = {};
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "OnlyFrens", {
        body: data.body,
        tag: data.tag,
        renotify: Boolean(data.tag),
        icon: "./assets/opengraph/icon-192.png",
        badge: "./assets/opengraph/icon-192.png",
      });

      const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
      windows.forEach((client) => client.postMessage({ type: "push-received" }));
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.length > 0) {
        await windows[0].focus();
        windows[0].postMessage({ type: "open-notifications" });
      } else {
        await clients.openWindow(`${self.registration.scope}#notifications`);
      }
    })(),
  );
});
