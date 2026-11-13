import { getUserProfile, removeFriend, acceptFriendRequest } from "./api.js";
import { showToast, showConfirm, haptic, escapeHTML } from "./utils.js";
import { icon } from "./icons.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { loadWithCache } from "./cache.js";
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

function showUserProfile(cardEl, { profile, relation, friendship_id }, refresh) {
  cardEl.innerHTML = profileCardHTML(profile, {
    actionsHTML: actionsHTML(relation),
    divider: false,
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
  `;

  const cardEl = document.getElementById("user-profile-card");

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
      },
      60_000,
    );
  } catch (err) {
    removeLoader(cardEl);
    cardEl.innerHTML = `<p class="empty-label profile-error">${escapeHTML(err.message)}</p>`;
  }
}
