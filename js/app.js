import { showToast, showConfirm, haptic, loadModule } from "./utils.js";
import { icon } from "./icons.js";
import { getToken, getProfile, addFriend, getFriends, getNotifications, trackProjectActivity } from "./api.js";
import { readAuthRedirect, startSession, getAuthUser } from "./auth.js";
import { renderHome } from "./home.js";
import { renderFriends } from "./friends.js";
import { renderProfile } from "./profile.js";
import { renderNotifications } from "./notifications.js";
import { renderUserProfile } from "./user-profile.js";
import { OPEN_PROFILE_EVENT, OPEN_PAGE_EVENT } from "./navigation.js";
import { renderRewards } from "./rewards.js";
import { startBadges, setNotificationsViewOpen } from "./badges.js";
import { markAllNotificationsRead } from "./api.js";
import { syncPush } from "./push.js";
import { cacheDelete, cacheMarkStale, prefetch } from "./cache.js";
import { takeSharedContent } from "./share.js";
import { initPullToRefresh } from "./pull-refresh.js";

const appEl = document.getElementById("app");
const navButtons = document.querySelectorAll(".nav-item");
const fab = document.getElementById("composer-fab");
const pageHeader = document.getElementById("page-header");

const NAV_ICONS = { home: "house", friends: "users", notifications: "bell", profile: "user" };

navButtons.forEach((btn) => {
  const name = NAV_ICONS[btn.dataset.screen];
  btn.insertAdjacentHTML("afterbegin", icon(name, "regular", "icon-outline") + icon(name, "fill", "icon-filled"));
});
fab.insertAdjacentHTML("afterbegin", icon("plus", "bold"));

function openComposerLazy(afterPublish, shared) {
  loadModule(
    () => import("./composer.js"),
    ({ openComposer }) => openComposer(afterPublish, shared),
  );
}

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

const REFRESH_KEYS = {
  home: ["feed"],
  friends: ["friends", "suggestions"],
  notifications: ["notifications"],
  profile: ["profile", "ownPosts"],
};

let currentScreen = "home";
let viewingUser = false;
let homeScroll = 0;

// Only the feed remembers where you were; the other tabs always open at the top.
function rememberHomeScroll() {
  if (currentScreen === "home" && !viewingUser) homeScroll = window.scrollY;
}

function restoreHomeScroll() {
  if (!homeScroll) return;
  const target = homeScroll;
  requestAnimationFrame(() => window.scrollTo(0, target));
}

// Content slides in from the side of the tab it comes after.
function slideIn(offset) {
  if (!offset) return;
  appEl.style.setProperty("--slide", `${offset}px`);
  appEl.classList.remove("slide-in");
  void appEl.offsetWidth;
  appEl.classList.add("slide-in");
}

function bounceNavItem(btn) {
  btn.classList.remove("bounce");
  void btn.offsetWidth;
  btn.classList.add("bounce");
  btn.addEventListener("animationend", () => btn.classList.remove("bounce"), { once: true });
}

let notificationsOpen = false;

function enterNotifications() {
  notificationsOpen = true;
  setNotificationsViewOpen(true);
}

// Leaving the view is what marks the notifications as read.
function leaveNotifications(options) {
  if (!notificationsOpen) return;
  notificationsOpen = false;
  setNotificationsViewOpen(false);

  // Only if the user actually saw unread ones: otherwise nothing changes on the server.
  if (appEl.querySelector(".notification-row.unread")) {
    markAllNotificationsRead(options).catch(() => {});
  }
}

function goToScreen(screenName, { restore = false } = {}) {
  rememberHomeScroll();
  if (screenName === "notifications") enterNotifications();
  else leaveNotifications();

  const order = Object.keys(SCREENS);
  slideIn(viewingUser ? -16 : Math.sign(order.indexOf(screenName) - order.indexOf(currentScreen)) * 16);

  currentScreen = screenName;
  viewingUser = false;
  window.scrollTo(0, 0);
  pageHeader.textContent = SCREEN_TITLES[screenName];

  navButtons.forEach((btn) => {
    const active = btn.dataset.screen === screenName;
    if (active && !btn.classList.contains("active")) bounceNavItem(btn);
    btn.classList.toggle("active", active);
  });

  fab.hidden = screenName !== "home";

  const render = SCREENS[screenName];
  if (render) render();
  if (screenName === "home" && restore) restoreHomeScroll();
}

function showUserProfile(username) {
  rememberHomeScroll();
  leaveNotifications();
  slideIn(16);
  viewingUser = true;
  fab.hidden = true;
  pageHeader.textContent = SCREEN_TITLES.profile;
  history.pushState({ profile: username }, "");
  window.scrollTo(0, 0);
  renderUserProfile(appEl, username, { onSelf: () => goToScreen("profile") });
}

// Rewards and hashtag pages reuse the "viewing someone" behavior: back returns to the tab.
const SUB_PAGES = {
  rewards: { title: "Recompensas", render: () => renderRewards(appEl) },
  hashtag: {
    title: "Hashtag",
    render: ({ tag }) =>
      loadModule(
        () => import("./hashtag-page.js"),
        ({ renderHashtagPage }) => renderHashtagPage(appEl, tag),
      ),
  },
};

window.addEventListener(OPEN_PAGE_EVENT, ({ detail }) => {
  const page = SUB_PAGES[detail.page];
  if (!page) return;

  rememberHomeScroll();
  leaveNotifications();
  slideIn(16);
  viewingUser = true;
  fab.hidden = true;
  pageHeader.textContent = page.title;
  history.pushState({ page: detail.page }, "");
  window.scrollTo(0, 0);
  page.render(detail);
});

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
  bottomNav.hidden = false;
  goToScreen("home");
  handleInviteLink();
  openFromHash();
  startBadges();
  syncPush();
  warmTabs();
}

async function openSharedPost() {
  const shared = await takeSharedContent();
  if (shared) openComposerLazy(afterPublish, shared);
}

// Push notifications and the manifest shortcuts start the app on #<screen>, the share sheet on #share.
function openFromHash() {
  const target = location.hash.slice(1);
  if (target !== "share" && !Object.hasOwn(SCREENS, target)) return;
  history.replaceState(null, "", location.pathname + location.search);

  if (target === "share") {
    openSharedPost();
  } else {
    goToScreen(target);
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    leaveNotifications({ keepalive: true });
  } else if (currentScreen === "notifications" && !viewingUser && !bottomNav.hidden) {
    goToScreen("notifications");
  }
});

navigator.serviceWorker?.addEventListener("message", ({ data }) => {
  if (data?.type === "open-notifications" && !bottomNav.hidden) {
    goToScreen("notifications");
  } else if (data?.type === "push-received" && currentScreen === "notifications" && !viewingUser) {
    cacheDelete("notifications");
    SCREENS.notifications?.();
  }
});

const PREFETCH = {
  friends: () => prefetch("friends", getFriends),
  notifications: () => prefetch("notifications", getNotifications),
  profile: () => prefetch("profile", getProfile),
};

// When the tab opens the data is usually already there.
function warmTabs() {
  const run = () => Object.values(PREFETCH).forEach((fetch) => fetch());
  if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2000);
}

function refreshCurrent() {
  cacheMarkStale(...REFRESH_KEYS[currentScreen]);
  return SCREENS[currentScreen]();
}

navButtons.forEach((btn) => {
  btn.addEventListener("pointerdown", () => PREFETCH[btn.dataset.screen]?.(), { passive: true });
  btn.addEventListener("click", () => {
    haptic();
    const screen = btn.dataset.screen;

    // Tapping the active tab: first scroll to the top, and from the top refresh.
    if (screen === currentScreen && !viewingUser) {
      if (window.scrollY > 80) window.scrollTo({ top: 0, behavior: "smooth" });
      else refreshCurrent();
      return;
    }
    goToScreen(screen, { restore: true });
  });
});

function afterPublish() {
  homeScroll = 0;
  window.scrollTo(0, 0);
  renderHome(appEl);
}

fab.addEventListener("click", () => {
  haptic();
  openComposerLazy(afterPublish);
});

initPullToRefresh({
  content: appEl,
  canPull: () =>
    !bottomNav.hidden &&
    !viewingUser &&
    !document.querySelector(".sheet-overlay, #modal-ui.active"),
  onRefresh: refreshCurrent,
});

window.addEventListener("popstate", () => {
  if (modalUI.classList.contains("active")) modalUI.classList.remove("active");
  if (viewingUser) goToScreen(currentScreen, { restore: true });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalUI.classList.contains("active")) {
    modalUI.classList.remove("active");
  }
});

history.pushState({ modal: false }, "");

function hideNavigation() {
  document.body.classList.add("auth");
  bottomNav.hidden = true;
  fab.hidden = true;
}

function showAuth() {
  hideNavigation();
  loadModule(
    () => import("./auth-screen.js"),
    ({ renderAuthScreen }) => renderAuthScreen(appEl, showApp),
  );
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
      loadModule(
        () => import("./complete-profile.js"),
        ({ renderCompleteProfileScreen }) =>
          renderCompleteProfileScreen(appEl, { displayName: metadata.full_name ?? metadata.name ?? "" }, showApp),
      );
      return;
    }
  }
  showApp();
}

function initApp() {
  const redirect = readAuthRedirect();

  if (redirect?.type === "recovery") {
    hideNavigation();
    loadModule(
      () => import("./password-reset.js"),
      ({ renderResetScreen }) =>
        renderResetScreen(appEl, redirect.session, (session) => {
          startSession(session);
          enterApp();
        }),
    );
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
trackProjectActivity("OnlyFrens");

if ("serviceWorker" in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);

  window.addEventListener("load", async () => {
    const registration = await navigator.serviceWorker.register("./sw.js");
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") registration.update();
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) location.reload();
  });
}
