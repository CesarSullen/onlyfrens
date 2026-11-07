import { showToast, showConfirm, haptic } from "./utils.js";
import { getToken, getProfile, addFriend } from "./api.js";
import { renderAuthScreen } from "./auth-screen.js";
import { renderHome } from "./home.js";
import { renderFriends } from "./friends.js";
import { renderProfile } from "./profile.js";
import { renderNotifications } from "./notifications.js";
import { openComposer } from "./composer.js";

const appEl = document.getElementById("app");
const navButtons = document.querySelectorAll(".nav-item");
const fab = document.getElementById("composer-fab");
const bottomNav = document.getElementById("bottom-nav");
const modalUI = document.getElementById("modal-ui");

const SCREENS = {
  home: () => renderHome(appEl),
  friends: () => renderFriends(appEl),
  notifications: () => renderNotifications(appEl),
  profile: () => renderProfile(appEl),
};

function goToScreen(screenName) {
  navButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.screen === screenName);
  });

  fab.style.display = screenName === "home" ? "flex" : "none";

  const render = SCREENS[screenName];
  if (render) render();
}

function handleInviteLink() {
  const match = location.hash.match(/^#add=([a-z0-9_]{3,20})$/);
  if (!match) return;

  const username = match[1];
  history.replaceState(null, "", location.pathname + location.search);

  showConfirm(`¿Enviar solicitud de amistad a @${username}?`, async () => {
    try {
      await addFriend(username);
      showToast("Solicitud enviada");
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

function showApp() {
  bottomNav.style.display = "flex";
  goToScreen("home");
  handleInviteLink();
}

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    haptic();
    goToScreen(btn.dataset.screen);
  });
});

fab.addEventListener("click", () => {
  haptic();
  openComposer(() => renderHome(appEl));
});

window.addEventListener("popstate", () => {
  if (modalUI.classList.contains("active")) modalUI.classList.remove("active");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalUI.classList.contains("active")) {
    modalUI.classList.remove("active");
  }
});

history.pushState({ modal: false }, "");

async function initApp() {
  const token = getToken();

  if (!token) {
    bottomNav.style.display = "none";
    fab.style.display = "none";
    renderAuthScreen(appEl, showApp);
    return;
  }

  try {
    await getProfile();
    showApp();
  } catch {
    bottomNav.style.display = "none";
    fab.style.display = "none";
    renderAuthScreen(appEl, showApp);
  }
}

Promise.race([
  initApp(),
  new Promise((resolve) => setTimeout(resolve, 3000)),
]);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
