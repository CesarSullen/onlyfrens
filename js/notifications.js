import { getNotifications, markNotificationRead } from "./api.js";
import { showToast, formatRelativeTime, haptic, escapeHTML } from "./utils.js";
import { icon } from "./icons.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { loadWithCache } from "./cache.js";
import { canAskForPush, needsInstallForPush, enablePush } from "./push.js";
import { patchKeyed } from "./patch-list.js";
import { openPost } from "./navigation.js";

const MESSAGE_BY_TYPE = {
  like: (name) => [`A ${name} le gustó`, "tu publicación."],
  comment: (name) => [`${name} comentó en`, "tu publicación."],
  comment_like: (name) => [`A ${name} le gustó`, "tu respuesta."],
  repost: (name) => [`${name} compartió`, "tu publicación."],
  friend_request: (name) => [`${name} quiere agregarte`, "como amigo."],
  friend_accepted: (name) => [`${name} aceptó tu`, "solicitud de amistad."],
  birthday: (name) => ["Hoy es el cumpleaños", `de ${name}.`],
};

const ICON_BY_TYPE = {
  like: ["heart", "fill"],
  comment: ["chat-circle", "fill"],
  comment_like: ["heart", "fill"],
  repost: ["arrows-clockwise", "regular"],
  friend_request: ["user-plus", "fill"],
  friend_accepted: ["user-check", "fill"],
  birthday: ["cake", "fill"],
};

// Likes and comments on anonymous posts arrive without an actor and name nobody.
const ANONYMOUS_MESSAGE_BY_TYPE = {
  like: ["A alguien le gustó", "tu publicación."],
  comment: ["Alguien comentó en", "tu publicación."],
  comment_like: ["A alguien le gustó", "tu respuesta."],
};

// These notifications open the post they are about.
const POST_TYPES = new Set(["like", "comment", "comment_like", "repost"]);

// These ones take you to the friends screen.
const FRIEND_TYPES = new Set(["friend_request", "friend_accepted"]);

function notificationRowHTML(notification) {
  const anonymous = !notification.actor && ANONYMOUS_MESSAGE_BY_TYPE[notification.type];
  const actorName = notification.actor?.display_name ?? "Alguien";
  const [head, tail] = anonymous
    ? ANONYMOUS_MESSAGE_BY_TYPE[notification.type]
    : MESSAGE_BY_TYPE[notification.type]?.(actorName) ?? ["Nueva notificación.", ""];
  const [iconName, iconWeight] = ICON_BY_TYPE[notification.type] ?? ["bell", "fill"];
  const postAttr = notification.post_id && POST_TYPES.has(notification.type) ? ` data-post-id="${escapeHTML(notification.post_id)}"` : "";

  return `
    <div class="notification-row${notification.read ? "" : " unread"}" data-key="${notification.id}" data-notification-id="${notification.id}"${postAttr}${FRIEND_TYPES.has(notification.type) ? " data-friends" : ""}>
      <div class="notification-icon">${icon(iconName, iconWeight)}</div>
      <p class="notification-message">${escapeHTML(head)}<span class="notification-tail">${escapeHTML(tail)}</span></p>
      <div class="notification-meta">
        <span class="notification-time">${formatRelativeTime(notification.created_at)}</span>
      </div>
    </div>
  `;
}

async function handleRowClick(row) {
  // Leaving this screen marks everything as read, so the post only needs to be opened.
  if (row.dataset.postId) {
    haptic();
    openPost(row.dataset.postId);
    return;
  }

  if (row.hasAttribute("data-friends")) {
    haptic();
    document.querySelector('.nav-item[data-screen="friends"]')?.click();
    return;
  }

  if (!row.classList.contains("unread")) return;
  row.classList.remove("unread");

  try {
    await markNotificationRead(row.dataset.notificationId);
  } catch (err) {
    row.classList.add("unread");
    showToast(err.message, "error");
  }
}

const EMPTY_NOTIFICATIONS_HTML = `
  <div class="empty-state fade-in" data-key="empty">
    <div class="empty-state-icon">${icon("bell", "regular")}</div>
    <p class="empty-state-title">Todo tranquilo por aquí</p>
    <p class="empty-state-text">Sal a tomar el aire. Toca césped my fren.</p>
  </div>
`;

function pushBannerHTML() {
  if (canAskForPush()) {
    return `
      <div class="push-banner" data-key="banner">
        ${icon("bell", "fill")}
        <p>Activa las notificaciones para enterarte al instante.</p>
        <button class="solid-btn" id="enable-push">Activar</button>
      </div>`;
  }
  if (needsInstallForPush()) {
    return `
      <div class="push-banner" data-key="banner">
        ${icon("bell", "fill")}
        <p>Para recibir notificaciones, agrega la app a tu pantalla de inicio.</p>
      </div>`;
  }
  return "";
}

async function enableFromBanner(screenEl, button) {
  haptic();
  button.disabled = true;
  try {
    const enabled = await enablePush();
    if (enabled) {
      screenEl.querySelector(".push-banner")?.remove();
      showToast("Notificaciones activadas");
    } else {
      button.disabled = false;
    }
  } catch (err) {
    showToast(err.message, "error");
    button.disabled = false;
  }
}

function showNotifications(screenEl, notifications) {
  const rows = notifications.length ? notifications.map(notificationRowHTML).join("") : EMPTY_NOTIFICATIONS_HTML;
  patchKeyed(screenEl, pushBannerHTML() + rows);
}

export async function renderNotifications(appEl) {
  appEl.innerHTML = `<div class="notifications-screen fade-in">${loaderHTML()}</div>`;
  const screenEl = appEl.firstElementChild;

  screenEl.addEventListener("click", (event) => {
    const button = event.target.closest("#enable-push");
    if (button) return enableFromBanner(screenEl, button);
    const row = event.target.closest(".notification-row");
    if (row) handleRowClick(row);
  });

  try {
    await loadWithCache("notifications", getNotifications, ({ notifications }) => {
      if (screenEl.isConnected) showNotifications(screenEl, notifications);
    }, 30_000);
  } catch (err) {
    removeLoader(screenEl);
    showToast(err.message, "error");
  }
}
