import { getFeed } from "./api.js";
import { showToast } from "./utils.js";
import { postCardHTML, attachPostCardListeners } from "./post-card.js";
import { icon } from "./icons.js";

const EMPTY_FEED_HTML = `
  <div class="empty-state">
    <div class="empty-state-icon">${icon("image", "regular")}</div>
    <p class="empty-state-title">Ninguno de tus amigos ha dicho nada</p>
    <p class="empty-state-text">Sal y toca césped.</p>
  </div>
`;

let oldestLoadedDate = null;
let isLoadingMore = false;
let reachedEnd = false;
let scrollHandler = null;

async function loadMorePosts(feedListEl) {
  if (isLoadingMore || reachedEnd) return;
  isLoadingMore = true;

  try {
    const { posts } = await getFeed(oldestLoadedDate);

    if (posts.length === 0) {
      reachedEnd = true;
      if (!feedListEl.hasChildNodes()) feedListEl.innerHTML = EMPTY_FEED_HTML;
      return;
    }

    const html = posts.map(postCardHTML).join("");
    feedListEl.insertAdjacentHTML("beforeend", html);
    attachPostCardListeners(feedListEl);

    oldestLoadedDate = posts[posts.length - 1].created_at;
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    isLoadingMore = false;
  }
}

export async function renderHome(appEl) {
  appEl.innerHTML = `<div class="feed-list" id="feed-list"></div>`;
  const feedListEl = document.getElementById("feed-list");

  oldestLoadedDate = null;
  reachedEnd = false;

  await loadMorePosts(feedListEl);

  if (scrollHandler) window.removeEventListener("scroll", scrollHandler);
  scrollHandler = () => {
    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;
    if (nearBottom) loadMorePosts(feedListEl);
  };
  window.addEventListener("scroll", scrollHandler);
}
