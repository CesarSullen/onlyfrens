const PREFIX = "onlyfrens_cache:";
const POST_LIFETIME_MS = 24 * 60 * 60 * 1000;

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + key));
  } catch {
    return null;
  }
}

function write(key, data) {
  try {
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ data, savedAt: Date.now() }),
    );
  } catch {}
}

export function cacheDelete(...keys) {
  keys.forEach((key) => localStorage.removeItem(PREFIX + key));
}

export function cacheMarkStale(...keys) {
  keys.forEach((key) => {
    const entry = read(key);
    if (entry)
      localStorage.setItem(
        PREFIX + key,
        JSON.stringify({ ...entry, savedAt: 0 }),
      );
  });
}

export function clearCache() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(PREFIX))
    .forEach((key) => localStorage.removeItem(key));
}

export function livePosts(posts) {
  const limit = Date.now() - POST_LIFETIME_MS;
  return posts.filter((post) => new Date(post.created_at).getTime() > limit);
}

export async function loadWithCache(key, fetcher, onData, maxAgeMs = 60_000) {
  const cached = read(key);

  if (cached) {
    onData(cached.data, { cached: true });
    if (Date.now() - cached.savedAt < maxAgeMs) return;
  }

  try {
    const data = await fetcher();
    write(key, data);
    if (!cached || JSON.stringify(cached.data) !== JSON.stringify(data)) {
      onData(data, { cached: false });
    }
  } catch (err) {
    if (!cached) throw err;
  }
}
