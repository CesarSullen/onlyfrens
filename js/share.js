const SHARE_CACHE = "onlyfrens-share";

// Reads what the service worker stored from the share sheet and clears it.
export async function takeSharedContent() {
  const cache = await caches.open(SHARE_CACHE);
  const requests = await cache.keys();
  let text = "";
  const files = [];

  for (const request of requests) {
    const response = await cache.match(request);
    const name = new URL(request.url).pathname.split("/").pop();

    if (name === "text") {
      text = await response.text();
    } else {
      const blob = await response.blob();
      files.push(new File([blob], name, { type: blob.type }));
    }
  }

  await Promise.all(requests.map((request) => cache.delete(request)));
  return text || files.length ? { text, files } : null;
}
