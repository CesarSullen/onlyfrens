import { getNotifications, markNotificationRead } from "./api.js";
import { showToast, formatRelativeTime } from "./utils.js";
import { icon } from "./icons.js";

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

const MESSAGE_BY_TYPE = {
  like: (name) => [`A ${name} le gustó`, "tu publicación."],
  comment: (name) => [`${name} comentó en`, "tu publicación."],
  repost: (name) => [`${name} compartió`, "tu publicación."],
  friend_request: (name) => [`${name} quiere agregarte`, "como amigo."],
  friend_accepted: (name) => [`${name} aceptó tu`, "solicitud de amistad."],
  birthday: (name) => ["Hoy es el cumpleaños", `de ${name}.`],
};

const ICON_BY_TYPE = {
  like: ["heart", "fill"],
  comment: ["chat-circle", "fill"],
  repost: ["repeat", "regular"],
  friend_request: ["user-plus", "fill"],
  friend_accepted: ["user-check", "fill"],
  birthday: ["cake", "fill"],
};

function notificationRowHTML(notification) {
  const actorName = notification.actor?.display_name ?? "Alguien";
  const [head, tail] = MESSAGE_BY_TYPE[notification.type]?.(actorName) ?? ["Nueva notificación.", ""];
  const [iconName, iconWeight] = ICON_BY_TYPE[notification.type] ?? ["bell", "fill"];

  return `
    <div class="notification-row${notification.read ? "" : " unread"}" data-notification-id="${notification.id}">
      <div class="notification-icon">${icon(iconName, iconWeight)}</div>
      <p class="notification-message">${escapeHTML(head)}<span class="notification-tail">${escapeHTML(tail)}</span></p>
      <div class="notification-meta">
        <span class="notification-time">${formatRelativeTime(notification.created_at)}</span>
      </div>
    </div>
  `;
}

async function handleRowClick(row) {
  if (!row.classList.contains("unread")) return;
  row.classList.remove("unread");

  try {
    await markNotificationRead(row.dataset.notificationId);
  } catch (err) {
    row.classList.add("unread");
    showToast(err.message, "error");
  }
}

export async function renderNotifications(appEl) {
  appEl.innerHTML = `<div class="notifications-screen fade-in"></div>`;

  try {
    const { notifications } = await getNotifications();

    if (notifications.length === 0) {
      appEl.innerHTML = `
        <div class="empty-state fade-in">
          <div class="empty-state-icon">${icon("bell", "regular")}</div>
          <p class="empty-state-title">Todo tranquilo por aquí</p>
          <p class="empty-state-text">Sal a tomar el aire. Toca césped my fren.</p>
        </div>
      `;
      return;
    }

    appEl.innerHTML = `
      <div class="notifications-screen fade-in">
        ${notifications.map(notificationRowHTML).join("")}
      </div>
    `;

    appEl.querySelectorAll(".notification-row").forEach((row) => {
      row.addEventListener("click", () => handleRowClick(row));
    });
  } catch (err) {
    showToast(err.message, "error");
  }
}
