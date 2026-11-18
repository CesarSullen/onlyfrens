import {
  getFriends,
  getProfile,
  getSuggestions,
  addFriend,
  acceptFriendRequest,
  removeFriend,
} from "./api.js";
import { showToast, showConfirm, haptic, sortByDisplayName } from "./utils.js";
import { openUserProfile } from "./navigation.js";
import { verifiedBadgeHTML } from "./verified.js";
import { avatarSrc } from "./avatar.js";
import { icon } from "./icons.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { loadWithCache } from "./cache.js";
import { whatsappUrl } from "./contact.js";
import { openHashtagSearch } from "./hashtag-search.js";
import { openFriendSearch } from "./friend-search.js";


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
  tappable = true,
) {
  return `
    <div class="friend-row" data-request-id="${requestId}">
      <img class="avatar${tappable ? " tappable" : ""}"${tappable ? ` data-profile="${escapeHTML(profile.username)}"` : ""} src="${avatarSrc(profile)}" alt="" loading="lazy" />
      <div class="friend-info">
        <p class="friend-name${tappable ? " tappable" : ""}"${tappable ? ` data-profile="${escapeHTML(profile.username)}"` : ""}>${escapeHTML(profile.display_name)}${verifiedBadgeHTML(profile)}</p>
        ${subtitle ? `<span class="friend-sub">${subtitle}</span>` : ""}
        ${stacked ? `<div class="friend-actions-stacked">${actionsHTML}</div>` : ""}
      </div>
      ${stacked ? "" : `<div class="friend-row-actions">${actionsHTML}</div>`}
    </div>
  `;
}

// The message button only exists when the friend has a phone number.
function friendRowHTML(profile) {
  const message = profile.phone
    ? `<a class="outline-btn icon-only message-btn" href="${whatsappUrl(profile.phone)}" target="_blank" rel="noopener noreferrer" aria-label="Escribir por WhatsApp">${icon("chat-circle", "regular")}</a>`
    : "";

  return rowHTML(
    profile,
    `${message}<button class="outline-btn danger icon-only remove-friend-btn" data-friendship-id="${profile.friendship_id}" aria-label="Eliminar amigo">${icon("user-slash", "regular")}</button>`,
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

// Suggested people are not related to you yet, so their profile can't be opened.
function suggestionsHTML(suggestions) {
  const rows = suggestions
    .map((profile) =>
      rowHTML(
        profile,
        `<button class="solid-btn suggestion-add-btn" data-username="${escapeHTML(profile.username)}">Agregar</button>`,
        "",
        `${profile.mutual_friends} amigos en común`,
        false,
        false,
      ),
    )
    .join("");

  return sectionHTML("Sugerencias para ti", rows);
}

async function handleSuggestionAdd(suggestionsEl, button) {
  haptic();
  button.disabled = true;

  try {
    await addFriend(button.dataset.username);
    showToast("Solicitud enviada");

    const row = button.closest(".friend-row");
    row.classList.add("leaving");
    setTimeout(() => {
      row.remove();
      if (!suggestionsEl.querySelector(".friend-row")) suggestionsEl.innerHTML = "";
    }, 300);

    // The new request shows up in the list below.
    const listEl = document.getElementById("friends-list");
    if (listEl) getFriends().then((data) => showFriends(listEl, data)).catch(() => {});
  } catch (err) {
    showToast(err.message, "error");
    button.disabled = false;
  }
}

function showSuggestions(suggestionsEl, suggestions) {
  suggestionsEl.innerHTML = suggestionsHTML(suggestions);
  suggestionsEl.querySelectorAll(".suggestion-add-btn").forEach((button) => {
    button.addEventListener("click", () => handleSuggestionAdd(suggestionsEl, button));
  });
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
    sectionHTML(`Amigos (${friends.length})`, sortByDisplayName(friends).map(friendRowHTML).join(""));

  return (
    sections ||
    `<p class="empty-label" style="margin-top: 24px; text-align: center;">Aún no tienes amigos agregados. ¿Necesitas un abrazo?</p>`
  );
}

function showFriends(listEl, data) {
  listEl.innerHTML = friendsListHTML(data);

  listEl.querySelectorAll(".accept-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      haptic();
      handleAccept(btn.dataset.requestId);
    });
  });

  listEl.querySelectorAll(".reject-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleReject(btn.dataset.requestId));
  });

  listEl.querySelectorAll(".remove-friend-btn").forEach((btn) => {
    const friend = data.friends.find((f) => f.friendship_id === btn.dataset.friendshipId);
    btn.addEventListener("click", () => friend && handleRemoveFriend(friend));
  });

  listEl.querySelectorAll(".message-btn").forEach((link) => {
    link.addEventListener("click", () => haptic());
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
      <div class="friends-actions">
        <button class="primary-btn" id="add-friend-btn">${icon("user-plus", "regular")}Agregar</button>
        <button class="outline-btn tags-btn" id="hashtags-btn" aria-label="Buscar hashtags">${icon("hash", "regular")}Hashtags</button>
      </div>
      <div id="suggestions"></div>
      <div class="friends-list" id="friends-list">${loaderHTML()}</div>
    </div>
  `;

  const listEl = document.getElementById("friends-list");
  const suggestionsEl = document.getElementById("suggestions");

  // Only verified accounts get suggestions: the profile tells which one this is.
  let suggestionsStarted = false;
  loadWithCache("profile", getProfile, ({ profile }) => {
    if (!profile.verified || suggestionsStarted || !suggestionsEl.isConnected) return;
    suggestionsStarted = true;

    loadWithCache(
      "suggestions",
      getSuggestions,
      ({ suggestions }) => {
        if (suggestionsEl.isConnected) showSuggestions(suggestionsEl, suggestions);
      },
      10 * 60_000,
    ).catch(() => {});
  }).catch(() => {});

  document.getElementById("add-friend-btn").addEventListener("click", () => {
    haptic();
    openFriendSearch(() => renderFriends(document.getElementById("app")));
  });

  document.getElementById("hashtags-btn").addEventListener("click", () => {
    haptic();
    openHashtagSearch();
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
