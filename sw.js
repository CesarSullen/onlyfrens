const CACHE_NAME = "onlyfrens-v0.0.34";
const IMAGE_CACHE = "onlyfrens-images";
const SHARE_CACHE = "onlyfrens-share";
const MAX_IMAGES = 150;
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/accents.js",
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
  "./js/post-page.js",
  "./js/compress.js",
  "./js/composer.js",
  "./js/audience-picker.js",
  "./js/friend-search.js",
  "./js/hashtag-page.js",
  "./js/hashtag-search.js",
  "./js/hashtags.js",
  "./js/hashtag-suggest.js",
  "./js/rewards.js",
  "./js/config.js",
  "./js/contact.js",
  "./js/friends.js",
  "./js/home.js",
  "./js/icons.js",
  "./js/loader.js",
  "./js/notifications.js",
  "./js/patch-list.js",
  "./js/post-card.js",
  "./js/post-capture.js",
  "./js/image-viewer.js",
  "./js/profile.js",
  "./js/pull-refresh.js",
  "./js/settings.js",
  "./js/share.js",
  "./js/utils.js",
  "./assets/opengraph/logo-blue.svg",
  "./assets/rewards/verified_blue.svg",
  "./assets/rewards/verified_gold.svg",
  "./assets/rewards/verified_purple.svg",
  "./assets/rewards/photo_downloads.svg",
  "./assets/rewards/anonymous_hashtags.svg",
  "./assets/rewards/hide_friends.svg",
  "./assets/rewards/only_friends.svg",
  "./assets/rewards/long_posts.svg",
  "./assets/rewards/very_long_posts.svg",
  "./assets/rewards/lock.svg",
  "./assets/shortcuts/friends.png",
  "./assets/shortcuts/notifications.png",
  "./assets/shortcuts/profile.png",
  "./typography/jost-400.woff2",
  "./typography/jost-500.woff2",
  "./typography/jost-600.woff2",
  "./typography/jost-700.woff2",
];

// Bypass the browser HTTP cache so an update never mixes old and new modules.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ASSETS.map((asset) => cache.add(new Request(asset, { cache: "reload" })).catch(() => {})))
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
      const network = fetch(e.request, { cache: "no-cache" })
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
        data: { postId: data.post_id ?? null },
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
  const postId = event.notification.data?.postId;

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.length > 0) {
        await windows[0].focus();
        windows[0].postMessage(postId ? { type: "open-post", postId } : { type: "open-notifications" });
      } else {
        await clients.openWindow(`${self.registration.scope}#${postId ? `post=${postId}` : "notifications"}`);
      }
    })(),
  );
});
