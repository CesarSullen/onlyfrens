import { API_BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { cacheDelete, cacheMarkStale, clearCache } from "./cache.js";

const TOKEN_KEY = "onlyfrens_token";
const REFRESH_KEY = "onlyfrens_refresh_token";
const EXPIRES_KEY = "onlyfrens_expires_at";
const REFRESH_MARGIN_SECONDS = 60;
const SESSION_EXPIRED_EVENT = "onlyfrens:session-expired";

let sessionExpired = false;

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setSession({ access_token, refresh_token, expires_at, expires_in }) {
  sessionExpired = false;
  localStorage.setItem(TOKEN_KEY, access_token);
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
  const expiresAt = expires_at ?? Math.floor(Date.now() / 1000) + expires_in;
  localStorage.setItem(EXPIRES_KEY, String(expiresAt));
}

function getUserId() {
  try {
    const payload = getToken().split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).sub;
  } catch {
    return null;
  }
}

function clearToken() {
  [TOKEN_KEY, REFRESH_KEY, EXPIRES_KEY].forEach((key) =>
    localStorage.removeItem(key),
  );
  clearCache();
}

function expireSession() {
  clearToken();
  if (sessionExpired) return;
  sessionExpired = true;
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

function isExpiring() {
  const expiresAt = Number(localStorage.getItem(EXPIRES_KEY));
  return (
    expiresAt > 0 && Date.now() / 1000 >= expiresAt - REFRESH_MARGIN_SECONDS
  );
}

let refreshing = null;

function refreshSession() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return Promise.resolve(false);

  refreshing ??= fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
  )
    .then(async (response) => {
      if (response.ok) {
        setSession(await response.json());
        return true;
      }
      if (response.status >= 400 && response.status < 500) clearToken();
      return false;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

async function apiFetch(path, options = {}, isRetry = false) {
  if (isExpiring()) await refreshSession();

  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      if (!isRetry && (await refreshSession())) {
        return apiFetch(path, options, true);
      }

      if (isRetry || !getToken() || !localStorage.getItem(REFRESH_KEY))
        expireSession();
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(data?.error ?? "Algo salió mal");
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error("No hay conexión con el servidor");
    }
    throw err;
  }
}

async function mutate(path, options, { drop = [], stale = [] } = {}) {
  const result = await apiFetch(path, options);
  cacheDelete(...drop);
  cacheMarkStale(...stale);
  return result;
}

async function getLikers(postId) {
  const { likers } = await apiFetch(`/posts/${postId}/like`);
  return likers ?? [];
}

function getFeed(before) {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  return apiFetch(`/posts${query}`, { method: "GET" });
}

function deletePost(postId) {
  return mutate(
    `/posts/${postId}`,
    { method: "DELETE" },
    { drop: ["feed", "ownPosts"] },
  );
}

function createPost(body) {
  return mutate(
    "/posts",
    { method: "POST", body: JSON.stringify(body) },
    { drop: ["feed", "ownPosts"] },
  );
}

function getFriends() {
  return apiFetch("/friends", { method: "GET" });
}

function addFriend(username) {
  return mutate(
    "/friends/add",
    { method: "POST", body: JSON.stringify({ username }) },
    { drop: ["friends"] },
  );
}

function acceptFriendRequest(requestId) {
  return mutate(
    `/friends/${requestId}/accept`,
    { method: "POST" },
    { drop: ["friends", "feed", "notifications"] },
  );
}

function removeFriend(requestId) {
  return mutate(
    `/friends/${requestId}`,
    { method: "DELETE" },
    { drop: ["friends", "feed"] },
  );
}

function createProfile(body) {
  return apiFetch("/profile", { method: "POST", body: JSON.stringify(body) });
}

function getProfile() {
  return apiFetch("/profile", { method: "GET" });
}

function getOwnPosts() {
  return apiFetch("/profile/posts", { method: "GET" });
}

function updateProfile(body) {
  return mutate(
    "/profile",
    { method: "PUT", body: JSON.stringify(body) },
    { drop: ["profile"], stale: ["feed", "ownPosts"] },
  );
}

function likePost(postId) {
  return mutate(
    `/posts/${postId}/like`,
    { method: "POST" },
    { stale: ["feed", "ownPosts"] },
  );
}

function unlikePost(postId) {
  return mutate(
    `/posts/${postId}/like`,
    { method: "DELETE" },
    { stale: ["feed", "ownPosts"] },
  );
}

function getLikes(postId) {
  return apiFetch(`/posts/${postId}/like`, { method: "GET" });
}

function getComments(postId) {
  return apiFetch(`/posts/${postId}/comments`, { method: "GET" });
}

function createComment(postId, textContent) {
  return mutate(
    `/posts/${postId}/comments`,
    { method: "POST", body: JSON.stringify({ text_content: textContent }) },
    { stale: ["feed", "ownPosts"] },
  );
}

function repost(postId) {
  return mutate(
    `/posts/${postId}/repost`,
    { method: "POST" },
    { drop: ["feed", "ownPosts"] },
  );
}

function undoRepost(postId) {
  return mutate(
    `/posts/${postId}/repost`,
    { method: "DELETE" },
    { drop: ["feed", "ownPosts"] },
  );
}

function getRepostCount(postId) {
  return apiFetch(`/posts/${postId}/repost`, { method: "GET" });
}

function uploadImage(file) {
  const token = getToken();
  const formData = new FormData();
  formData.append("image", file);

  return fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  }).then(async (response) => {
    const data = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(data?.error ?? "No se pudo subir la imagen");
    return data;
  });
}

function getNotifications() {
  return apiFetch("/notifications", { method: "GET" });
}

function markNotificationRead(notificationId) {
  return mutate(
    `/notifications/${notificationId}/read`,
    { method: "POST" },
    { stale: ["notifications"] },
  );
}

export {
  getToken,
  getUserId,
  getLikers,
  setSession,
  clearToken,
  getFeed,
  createPost,
  deletePost,
  getFriends,
  addFriend,
  acceptFriendRequest,
  removeFriend,
  getProfile,
  createProfile,
  getOwnPosts,
  updateProfile,
  likePost,
  unlikePost,
  getLikes,
  getComments,
  createComment,
  repost,
  undoRepost,
  getRepostCount,
  uploadImage,
  getNotifications,
  markNotificationRead,
};
