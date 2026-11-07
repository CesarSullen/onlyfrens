import { API_BASE_URL } from "./config.js";

function getToken() {
  return localStorage.getItem("onlyfrens_token");
}

function setToken(token) {
  localStorage.setItem("onlyfrens_token", token);
}

function clearToken() {
  localStorage.removeItem("onlyfrens_token");
}

async function apiFetch(path, options = {}) {
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

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data?.error ?? "Algo salió mal";
      throw new Error(message);
    }

    return data;
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error("No hay conexión con el servidor");
    }
    throw err;
  }
}

function getFeed(before) {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  return apiFetch(`/posts${query}`, { method: "GET" });
}

function deletePost(postId) {
  return apiFetch(`/posts/${postId}`, { method: "DELETE" });
}


function createPost(body) {
  return apiFetch("/posts", { method: "POST", body: JSON.stringify(body) });
}

function getFriends() {
  return apiFetch("/friends", { method: "GET" });
}

function addFriend(username) {
  return apiFetch("/friends/add", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

function acceptFriendRequest(requestId) {
  return apiFetch(`/friends/${requestId}/accept`, { method: "POST" });
}

function removeFriend(requestId) {
  return apiFetch(`/friends/${requestId}`, { method: "DELETE" });
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
  return apiFetch("/profile", { method: "PUT", body: JSON.stringify(body) });
}

function likePost(postId) {
  return apiFetch(`/posts/${postId}/like`, { method: "POST" });
}

function unlikePost(postId) {
  return apiFetch(`/posts/${postId}/like`, { method: "DELETE" });
}

function getLikes(postId) {
  return apiFetch(`/posts/${postId}/like`, { method: "GET" });
}

function getComments(postId) {
  return apiFetch(`/posts/${postId}/comments`, { method: "GET" });
}

function createComment(postId, textContent) {
  return apiFetch(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ text_content: textContent }),
  });
}

function repost(postId) {
  return apiFetch(`/posts/${postId}/repost`, { method: "POST" });
}

function undoRepost(postId) {
  return apiFetch(`/posts/${postId}/repost`, { method: "DELETE" });
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
    if (!response.ok) throw new Error(data?.error ?? "No se pudo subir la imagen");
    return data;
  });
}

function getNotifications() {
  return apiFetch("/notifications", { method: "GET" });
}

function markNotificationRead(notificationId) {
  return apiFetch(`/notifications/${notificationId}/read`, { method: "POST" });
}

export {
  getToken,
  setToken,
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
