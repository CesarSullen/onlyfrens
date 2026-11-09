import { getFriends, addFriend, acceptFriendRequest, removeFriend } from "./api.js";
import { showToast, showPrompt, showConfirm, haptic } from "./utils.js";
import { icon } from "./icons.js";

const PLACEHOLDER_AVATAR = "./assets/icons/avatar-placeholder.svg";

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function rowHTML(profile, actionsHTML, requestId = "", subtitle = "", stacked = false) {
  return `
    <div class="friend-row" data-request-id="${requestId}">
      <img class="avatar" src="${profile.avatar_url || PLACEHOLDER_AVATAR}" alt="" loading="lazy" />
      <div class="friend-info">
        <p class="friend-name">${escapeHTML(profile.display_name)}</p>
        ${subtitle ? `<span class="friend-sub">${subtitle}</span>` : ""}
        ${stacked ? `<div class="friend-actions-stacked">${actionsHTML}</div>` : ""}
      </div>
      ${stacked ? "" : `<div class="friend-row-actions">${actionsHTML}</div>`}
    </div>
  `;
}

function friendRowHTML(profile) {
  return rowHTML(profile, `<span class="solid-btn static">Amigos</span>`);
}

function incomingRequestHTML(request) {
  return rowHTML(
    request.profile,
    `<button class="solid-btn accept-btn" data-request-id="${request.requestId}">Aceptar</button>
     <button class="outline-btn reject-btn" data-request-id="${request.requestId}">Eliminar</button>`,
    request.requestId,
    "",
    true
  );
}

function outgoingRequestHTML(request) {
  return rowHTML(
    request.profile,
    `<button class="outline-btn reject-btn" data-request-id="${request.requestId}">Eliminar</button>`,
    request.requestId,
    "Solicitud pendiente"
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
  showConfirm("¿Eliminar esta solicitud?", async () => {
    try {
      await removeFriend(requestId);
      renderFriends(document.getElementById("app"));
    } catch (err) {
      showToast(err.message, "error");
    }
  }, true);
}

export async function renderFriends(appEl) {
  appEl.innerHTML = `<div class="friends-screen fade-in"></div>`;

  try {
    const { friends, incomingRequests, outgoingRequests } = await getFriends();

    const sections =
      sectionHTML("Solicitudes recibidas", incomingRequests.map(incomingRequestHTML).join("")) +
      sectionHTML("Solicitudes enviadas", outgoingRequests.map(outgoingRequestHTML).join("")) +
      sectionHTML("Amigos", friends.map(friendRowHTML).join(""));

    appEl.innerHTML = `
      <div class="friends-screen fade-in">
        <button class="primary-btn" id="add-friend-btn">${icon("user-plus", "regular")}Agregar amigo</button>
        ${sections || `<p class="empty-label" style="margin-top: 24px; text-align: center;">Aún no tienes amigos agregados. ¿Necesitas un abrazo?</p>`}
      </div>
    `;

    document.getElementById("add-friend-btn").addEventListener("click", () => {
      haptic();
      handleAddFriend();
    });

    appEl.querySelectorAll(".accept-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleAccept(btn.dataset.requestId));
    });

    appEl.querySelectorAll(".reject-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleReject(btn.dataset.requestId));
    });
  } catch (err) {
    showToast(err.message, "error");
  }
}
