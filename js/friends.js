import {
  getFriends,
  getSuggestions,
  addFriend,
  acceptFriendRequest,
  removeFriend,
} from "./api.js";
import { showToast, showConfirm, haptic, sortByDisplayName, escapeHTML, undoable, loadModule } from "./utils.js";
import { openUserProfile } from "./navigation.js";
import { verifiedBadgeHTML } from "./verified.js";
import { avatarSrc } from "./avatar.js";
import { icon } from "./icons.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { loadWithCache } from "./cache.js";
import { whatsappUrl } from "./contact.js";
import { patchKeyed } from "./patch-list.js";

function rowHTML(
  profile,
  actionsHTML,
  requestId = "",
  subtitle = "",
  stacked = false,
  tappable = true,
) {
  return `
    <div class="friend-row" data-key="${escapeHTML(requestId || profile.friendship_id || profile.username)}" data-request-id="${requestId}">
      <img class="avatar${tappable ? " tappable" : ""}"${tappable ? ` data-profile="${escapeHTML(profile.username)}"` : ""} src="${escapeHTML(avatarSrc(profile))}" alt="" loading="lazy" />
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
    `${message}<button class="outline-btn danger icon-only remove-friend-btn" data-friendship-id="${profile.friendship_id}" aria-label="Eliminar amigo">${icon("user-minus", "regular")}</button>`,
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

function sectionHTML(key, title, itemsHTML) {
  if (!itemsHTML) return "";
  return `
    <section data-key="${key}" data-nested>
      <h2 class="friends-section-title" data-key="title">${title}</h2>
      ${itemsHTML}
    </section>
  `;
}

async function handleAccept(requestId, refresh) {
  try {
    await acceptFriendRequest(requestId);
    showToast("Ahora son amigos");
    refresh();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function handleReject(requestId) {
  const row = document.querySelector(`.friend-row[data-request-id="${requestId}"]`);
  if (!row) return;

  undoable({
    message: "Solicitud eliminada",
    hide: () => {
      row.style.height = `${row.offsetHeight}px`;
      row.classList.add("leaving");
    },
    restore: () => {
      row.classList.remove("leaving");
      row.style.height = "";
    },
    commit: async (options) => {
      await removeFriend(requestId, options);
      row.remove();
    },
  });
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

  return sectionHTML("suggestions", "Sugerencias para ti", rows);
}

async function handleSuggestionAdd(suggestionsEl, button, refresh) {
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
    refresh();
  } catch (err) {
    showToast(err.message, "error");
    button.disabled = false;
  }
}

function showSuggestions(suggestionsEl, suggestions) {
  patchKeyed(suggestionsEl, suggestionsHTML(suggestions));
}

function handleRemoveFriend(friend, refresh) {
  showConfirm(
    `¿Eliminar a ${friend.display_name} de tus amigos?`,
    async () => {
      try {
        await removeFriend(friend.friendship_id);
        showToast("Amigo eliminado");
        refresh();
      } catch (err) {
        showToast(err.message, "error");
      }
    },
    true,
  );
}

function friendsListHTML({ friends, incomingRequests, outgoingRequests }) {
  const sections =
    sectionHTML("incoming", "Solicitudes recibidas", incomingRequests.map(incomingRequestHTML).join("")) +
    sectionHTML("outgoing", "Solicitudes enviadas", outgoingRequests.map(outgoingRequestHTML).join("")) +
    sectionHTML("friends", `Amigos (${friends.length})`, sortByDisplayName(friends).map(friendRowHTML).join(""));

  return (
    sections ||
    `<p class="empty-label friends-empty" data-key="empty">Aún no tienes amigos agregados. ¿Necesitas un abrazo?</p>`
  );
}

function showFriends(listEl, data) {
  patchKeyed(listEl, friendsListHTML(data));
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

  const screenEl = appEl.firstElementChild;
  const listEl = document.getElementById("friends-list");
  const suggestionsEl = document.getElementById("suggestions");
  let friendsData = { friends: [] };

  const showList = (data) => {
    friendsData = data;
    showFriends(listEl, data);
  };

  // Only the list repaints after a change, so the screen does not flash a loader.
  const refreshList = () => getFriends().then(showList).catch(() => {});

  loadWithCache(
    "suggestions",
    getSuggestions,
    ({ suggestions }) => {
      if (suggestionsEl.isConnected) showSuggestions(suggestionsEl, suggestions);
    },
    10 * 60_000,
  ).catch(() => {});

  screenEl.addEventListener("click", (event) => {
    const target = event.target.closest(
      ".accept-btn, .reject-btn, .remove-friend-btn, .message-btn, .suggestion-add-btn, #add-friend-btn, #hashtags-btn, [data-profile]",
    );
    if (!target) return;

    if (target.matches(".accept-btn")) {
      haptic();
      handleAccept(target.dataset.requestId, refreshList);
    } else if (target.matches(".reject-btn")) {
      handleReject(target.dataset.requestId);
    } else if (target.matches(".remove-friend-btn")) {
      const friend = friendsData.friends.find((f) => f.friendship_id === target.dataset.friendshipId);
      if (friend) handleRemoveFriend(friend, refreshList);
    } else if (target.matches(".suggestion-add-btn")) {
      handleSuggestionAdd(suggestionsEl, target, refreshList);
    } else if (target.matches("#add-friend-btn")) {
      haptic();
      loadModule(
        () => import("./friend-search.js"),
        ({ openFriendSearch }) => openFriendSearch(refreshList),
      );
    } else if (target.matches("#hashtags-btn")) {
      haptic();
      loadModule(
        () => import("./hashtag-search.js"),
        ({ openHashtagSearch }) => openHashtagSearch(),
      );
    } else {
      haptic();
      if (target.dataset.profile) openUserProfile(target.dataset.profile);
    }
  });

  try {
    await loadWithCache("friends", getFriends, (data) => {
      if (listEl.isConnected) showList(data);
    });
  } catch (err) {
    removeLoader(listEl);
    showToast(err.message, "error");
  }
}
