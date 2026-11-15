import { getBadges } from "./api.js";

const POLL_INTERVAL_MS = 90_000;

let notificationsViewOpen = false;
let started = false;
let refreshTimer;

function setBadge(screen, on) {
  document.querySelector(`.nav-item[data-screen="${screen}"]`)?.toggleAttribute("data-badge", on);
}

// Inside the notifications view the red dot is hidden: the unread ones show their own blue dot.
export function setNotificationsViewOpen(open) {
  notificationsViewOpen = open;
  if (open) setBadge("notifications", false);
}

function updateAppBadge(total) {
  if (!("setAppBadge" in navigator)) return;
  const update = total > 0 ? navigator.setAppBadge(total) : navigator.clearAppBadge();
  update?.catch(() => {});
}

export async function refreshBadges() {
  try {
    const { notifications, friend_requests } = await getBadges();
    setBadge("friends", friend_requests > 0);
    setBadge("notifications", notifications > 0 && !notificationsViewOpen);
    updateAppBadge(notifications + friend_requests);
  } catch {
    // The dots keep their last state until the next try.
  }
}

// Several changes in a row cause a single request.
function refreshSoon() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refreshBadges, 400);
}

export function startBadges() {
  refreshBadges();
  if (started) return;
  started = true;

  window.addEventListener("onlyfrens:mutated", refreshSoon);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshBadges();
  });
  setInterval(() => {
    if (document.visibilityState === "visible") refreshBadges();
  }, POLL_INTERVAL_MS);
  navigator.serviceWorker?.addEventListener("message", ({ data }) => {
    if (data?.type === "push-received") refreshBadges();
  });
}
