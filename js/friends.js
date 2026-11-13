import {
  getFriends,
  addFriend,
  acceptFriendRequest,
  removeFriend,
} from "./api.js";
import { showToast, showPrompt, showConfirm, haptic } from "./utils.js";
import { openUserProfile } from "./navigation.js";
import { verifiedBadgeHTML } from "./verified.js";
import { icon } from "./icons.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { loadWithCache } from "./cache.js";

const PLACEHOLDER_AVATAR = "./assets/icons/avatar-placeholder.svg";

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function rowHTML(
  profile,
  actionsHTML,
  requestId = "",
  subtitle = "",
  stacked = false,
) {
  return `
    <div class="friend-row" data-request-id="${requestId}">
      <img class="avatar tappable" data-profile="${escapeHTML(profile.username)}" src="${profile.avatar_url || PLACEHOLDER_AVATAR}" alt="" loading="lazy" />
      <div class="friend-info">
        <p class="friend-name tappable" data-profile="${escapeHTML(profile.username)}">${escapeHTML(profile.display_name)}${verifiedBadgeHTML(profile)}</p>
        ${subtitle ? `<span class="friend-sub">${subtitle}</span>` : ""}
        ${stacked ? `<div class="friend-actions-stacked">${actionsHTML}</div>` : ""}
      </div>
      ${stacked ? "" : `<div class="friend-row-actions">${actionsHTML}</div>`}
    </div>
  `;
}

function friendRowHTML(profile) {
  return rowHTML(
    profile,
    `<button class="outline-btn danger remove-friend-btn" data-friendship-id="${profile.friendship_id}">Eliminar</button>`,
  );
}

function incomingRequestHTML(request) {
  return rowHTML(
    request.profile,
    `<button class="solid-btn accept-btn" data-request-id="${request.requestId}">Aceptar</button>
     <button class="outline-btn danger reject-btn" data-request-id="${request.requestId}">Eliminar</button>`,
    request.requestId,
    "",
    true,
  );
}

function outgoingRequestHTML(request) {
  return rowHTML(
    request.profile,
    `<button class="outline-btn danger reject-btn" data-request-id="${request.requestId}">Eliminar</button>`,
    request.requestId,
    "Solicitud pendiente",
  );
}

function sectionHTML(title, itemsHTML) {
  if (!itemsHTML) return "";
  return `
    <section>
      <h2 class="friends-section-title">${title}</h2>
      ${itemsHTML}
    </section>
  `;
}

function handleAddFriend() {
  showPrompt("Ingresa el username de tu amigo", "@usuario", async (value) => {
    const username = value.trim().replace(/^@/, "").toLowerCase();
    if (!username) return;

    try {
      await addFriend(username);
      showToast("Solicitud enviada");
      renderFriends(document.getElementById("app"));
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

async function handleAccept(requestId) {
  try {
    await acceptFriendRequest(requestId);
    showToast("Ahora son amigos");
    renderFriends(document.getElementById("app"));
  } catch (err) {
    showToast(err.message, "error");
  }
}

function handleReject(requestId) {
  showConfirm(
    "¿Eliminar esta solicitud?",
    async () => {
      try {
        await removeFriend(requestId);
        renderFriends(document.getElementById("app"));
      } catch (err) {
        showToast(err.message, "error");
      }
    },
    true,
  );
}

function handleRemoveFriend(friend) {
  showConfirm(
    `¿Eliminar a ${friend.display_name} de tus amigos?`,
    async () => {
      try {
        await removeFriend(friend.friendship_id);
        showToast("Amigo eliminado");
        renderFriends(document.getElementById("app"));
      } catch (err) {
        showToast(err.message, "error");
      }
    },
    true,
  );
}

function friendsListHTML({ friends, incomingRequests, outgoingRequests }) {
  const sections =
    sectionHTML(
      "Solicitudes recibidas",
      incomingRequests.map(incomingRequestHTML).join(""),
    ) +
    sectionHTML(
      "Solicitudes enviadas",
      outgoingRequests.map(outgoingRequestHTML).join(""),
    ) +
    sectionHTML("Amigos", friends.map(friendRowHTML).join(""));

  return (
    sections ||
    `<p class="empty-label" style="margin-top: 24px; text-align: center;">Aún no tienes amigos agregados. ¿Necesitas un abrazo?</p>`
  );
}

function showFriends(listEl, data) {
  listEl.innerHTML = friendsListHTML(data);

  listEl.querySelectorAll(".accept-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleAccept(btn.dataset.requestId));
  });

  listEl.querySelectorAll(".reject-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleReject(btn.dataset.requestId));
  });

  listEl.querySelectorAll(".remove-friend-btn").forEach((btn) => {
    const friend = data.friends.find((f) => f.friendship_id === btn.dataset.friendshipId);
    btn.addEventListener("click", () => friend && handleRemoveFriend(friend));
  });

  listEl.querySelectorAll("[data-profile]").forEach((el) => {
    el.addEventListener("click", () => {
      haptic();
      openUserProfile(el.dataset.profile);
    });
  });
}

export async function renderFriends(appEl) {
  appEl.innerHTML = `
    <div class="friends-screen fade-in">
      <button class="primary-btn" id="add-friend-btn">${icon("user-plus", "regular")}Agregar amigo</button>
      <div class="friends-list" id="friends-list">${loaderHTML()}</div>
    </div>
  `;

  const listEl = document.getElementById("friends-list");

  document.getElementById("add-friend-btn").addEventListener("click", () => {
    haptic();
    handleAddFriend();
  });

  try {
    await loadWithCache("friends", getFriends, (data) => {
      if (listEl.isConnected) showFriends(listEl, data);
    });
  } catch (err) {
    removeLoader(listEl);
    showToast(err.message, "error");
  }
}
