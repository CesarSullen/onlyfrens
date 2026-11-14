import { showToast, showConfirm, haptic } from "./utils.js";
import { getToken, getProfile, addFriend } from "./api.js";
import { readAuthRedirect, startSession, getAuthUser } from "./auth.js";
import { renderAuthScreen } from "./auth-screen.js";
import { renderResetScreen } from "./password-reset.js";
import { renderCompleteProfileScreen } from "./complete-profile.js";
import { renderHome } from "./home.js";
import { renderFriends } from "./friends.js";
import { renderProfile } from "./profile.js";
import { renderNotifications } from "./notifications.js";
import { renderUserProfile } from "./user-profile.js";
import { OPEN_PROFILE_EVENT } from "./navigation.js";
import { openComposer } from "./composer.js";

const appEl = document.getElementById("app");
const navButtons = document.querySelectorAll(".nav-item");
const fab = document.getElementById("composer-fab");
const pageHeader = document.getElementById("page-header");

const SCREEN_TITLES = {
  home: "Inicio",
  friends: "Amigos",
  notifications: "Notificaciones",
  profile: "Perfil",
};
const bottomNav = document.getElementById("bottom-nav");
const modalUI = document.getElementById("modal-ui");

const SCREENS = {
  home: () => renderHome(appEl),
  friends: () => renderFriends(appEl),
  notifications: () => renderNotifications(appEl),
  profile: () => renderProfile(appEl),
};

let currentScreen = "home";
let viewingUser = false;

function goToScreen(screenName) {
  currentScreen = screenName;
  viewingUser = false;
  window.scrollTo(0, 0);
  pageHeader.textContent = SCREEN_TITLES[screenName];

  navButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.screen === screenName);
  });

  fab.style.display = screenName === "home" ? "flex" : "none";

  const render = SCREENS[screenName];
  if (render) render();
}

function showUserProfile(username) {
  viewingUser = true;
  fab.style.display = "none";
  pageHeader.textContent = SCREEN_TITLES.profile;
  history.pushState({ profile: username }, "");
  window.scrollTo(0, 0);
  renderUserProfile(appEl, username, { onSelf: () => goToScreen("profile") });
}

window.addEventListener(OPEN_PROFILE_EVENT, ({ detail }) => {
  if (detail.username) {
    showUserProfile(detail.username);
  } else {
    goToScreen("profile");
  }
});

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
  document.body.classList.remove("auth");
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
  if (viewingUser) goToScreen(currentScreen);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalUI.classList.contains("active")) {
    modalUI.classList.remove("active");
  }
});

history.pushState({ modal: false }, "");

function hideNavigation() {
  document.body.classList.add("auth");
  bottomNav.style.display = "none";
  fab.style.display = "none";
}

function showAuth() {
  hideNavigation();
  renderAuthScreen(appEl, showApp);
}

window.addEventListener("onlyfrens:session-expired", showAuth);

async function enterApp() {
  try {
    await getProfile();
  } catch (err) {
    if (err.status === 404) {
      const user = await getAuthUser(getToken()).catch(() => null);
      const metadata = user?.user_metadata ?? {};
      hideNavigation();
      renderCompleteProfileScreen(appEl, { displayName: metadata.full_name ?? metadata.name ?? "" }, showApp);
      return;
    }
  }
  showApp();
}

function initApp() {
  const redirect = readAuthRedirect();

  if (redirect?.type === "recovery") {
    hideNavigation();
    renderResetScreen(appEl, redirect.session, (session) => {
      startSession(session);
      enterApp();
    });
    return;
  }

  if (redirect?.type === "session") {
    startSession(redirect.session);
    enterApp();
    return;
  }

  if (redirect?.type === "error") showToast(redirect.message, "error");

  if (getToken()) {
    showApp();
  } else {
    showAuth();
  }
}

initApp();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
