import { getUserProfile, getUserPosts, removeFriend, acceptFriendRequest } from "./api.js";
import { showToast, showConfirm, haptic, escapeHTML } from "./utils.js";
import { icon } from "./icons.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { loadWithCache, livePosts } from "./cache.js";
import { postCardHTML, attachPostCardListeners } from "./post-card.js";
import { profileCardHTML, shareProfile } from "./profile-view.js";

function actionsHTML(relation) {
  const share = `<button class="outline-btn large" id="share-btn">Compartir</button>`;

  if (relation === "incoming") {
    return `
      <button class="solid-btn large" id="accept-btn">Aceptar</button>
      <button class="outline-btn danger large" id="remove-btn">Eliminar</button>`;
  }
  if (relation === "outgoing") {
    return `${share}<button class="outline-btn danger large" id="remove-btn">Cancelar solicitud</button>`;
  }
  return `${share}<button class="outline-btn danger large" id="remove-btn">Eliminar</button>`;
}

function confirmText(relation, name) {
  if (relation === "incoming") return `¿Eliminar la solicitud de ${name}?`;
  if (relation === "outgoing") return `¿Cancelar la solicitud a ${name}?`;
  return `¿Eliminar a ${name} de tus amigos?`;
}

function showUserPosts(listEl, posts) {
  if (posts.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon("package", "regular")}</div>
        <p class="empty-state-title">Aún no ha publicado nada</p>
        <p class="empty-state-text">Quizás es boomer y no sabe usar la app.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = `<div class="feed-list">${posts.map(postCardHTML).join("")}</div>`;
  attachPostCardListeners(listEl);
}

async function loadUserPosts(listEl, username) {
  listEl.innerHTML = loaderHTML();

  try {
    await loadWithCache(
      `user:${username}:posts`,
      () => getUserPosts(username),
      ({ posts }, { cached }) => {
        if (listEl.isConnected) showUserPosts(listEl, cached ? livePosts(posts) : posts);
      },
      30_000,
    );
  } catch (err) {
    removeLoader(listEl);
    listEl.innerHTML = `<p class="empty-label profile-error">${escapeHTML(err.message)}</p>`;
  }
}

function showUserProfile(cardEl, { profile, relation, friendship_id }, refresh) {
  cardEl.innerHTML = profileCardHTML(profile, {
    actionsHTML: actionsHTML(relation),
    divider: relation === "friend",
  });

  document.getElementById("share-btn")?.addEventListener("click", () => {
    haptic();
    shareProfile(profile);
  });

  document.getElementById("accept-btn")?.addEventListener("click", async () => {
    haptic();
    try {
      await acceptFriendRequest(friendship_id);
      showToast("Solicitud aceptada");
      refresh();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("remove-btn").addEventListener("click", () => {
    haptic();
    showConfirm(
      confirmText(relation, profile.display_name),
      async () => {
        try {
          await removeFriend(friendship_id);
          showToast(relation === "friend" ? "Amigo eliminado" : "Solicitud eliminada");
          history.back();
        } catch (err) {
          showToast(err.message, "error");
        }
      },
      true,
    );
  });
}

export async function renderUserProfile(appEl, username, { onSelf }) {
  appEl.innerHTML = `
    <div class="user-profile-bar">
      <button class="back-btn" id="back-btn" aria-label="Volver">${icon("caret-left", "regular")}</button>
    </div>
    <div class="profile-screen fade-in" id="user-profile-card">${loaderHTML()}</div>
    <div id="user-posts"></div>
  `;

  const cardEl = document.getElementById("user-profile-card");
  const postsEl = document.getElementById("user-posts");
  let postsStarted = false;

  document.getElementById("back-btn").addEventListener("click", () => {
    haptic();
    history.back();
  });

  try {
    await loadWithCache(
      `user:${username}`,
      () => getUserProfile(username),
      (data) => {
        if (!cardEl.isConnected) return;
        if (data.relation === "self") {
          onSelf();
          return;
        }
        showUserProfile(cardEl, data, () => renderUserProfile(appEl, username, { onSelf }));

        if (data.relation === "friend" && !postsStarted) {
          postsStarted = true;
          loadUserPosts(postsEl, username);
        }
      },
      60_000,
    );
  } catch (err) {
    removeLoader(cardEl);
    cardEl.innerHTML = `<p class="empty-label profile-error">${escapeHTML(err.message)}</p>`;
  }
}
