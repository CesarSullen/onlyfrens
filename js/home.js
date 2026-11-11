import { getFeed } from "./api.js";
import { showToast } from "./utils.js";
import { postCardHTML, attachPostCardListeners } from "./post-card.js";
import { icon } from "./icons.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { loadWithCache, livePosts } from "./cache.js";

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
let pagesLoaded = 0;
let scrollHandler = null;

function showFirstPage(feedListEl, posts) {
  feedListEl.innerHTML = posts.length
    ? posts.map(postCardHTML).join("")
    : EMPTY_FEED_HTML;
  attachPostCardListeners(feedListEl);
  oldestLoadedDate = posts.at(-1)?.created_at ?? null;
  reachedEnd = posts.length === 0;
  pagesLoaded = 1;
}

async function loadMorePosts(feedListEl) {
  if (isLoadingMore || reachedEnd || !oldestLoadedDate) return;
  isLoadingMore = true;

  try {
    const { posts } = await getFeed(oldestLoadedDate);
    if (!feedListEl.isConnected) return;

    if (posts.length === 0) {
      reachedEnd = true;
      return;
    }

    feedListEl.insertAdjacentHTML(
      "beforeend",
      posts.map(postCardHTML).join(""),
    );
    attachPostCardListeners(feedListEl);
    oldestLoadedDate = posts.at(-1).created_at;
    pagesLoaded += 1;
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    isLoadingMore = false;
  }
}

export async function renderHome(appEl) {
  appEl.innerHTML = `<div class="feed-list" id="feed-list">${loaderHTML()}</div>`;
  const feedListEl = document.getElementById("feed-list");

  oldestLoadedDate = null;
  isLoadingMore = false;
  reachedEnd = false;
  pagesLoaded = 0;

  if (scrollHandler) window.removeEventListener("scroll", scrollHandler);
  scrollHandler = () => {
    const nearBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;
    if (nearBottom) loadMorePosts(feedListEl);
  };
  window.addEventListener("scroll", scrollHandler);

  try {
    await loadWithCache(
      "feed",
      getFeed,
      ({ posts }, { cached }) => {
        if (!feedListEl.isConnected || pagesLoaded > 1) return;
        showFirstPage(feedListEl, cached ? livePosts(posts) : posts);
      },
      30_000,
    );
  } catch (err) {
    removeLoader(feedListEl);
    showToast(err.message, "error");
  }
}
