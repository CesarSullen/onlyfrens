import { getFeed } from "./api.js";
import { showToast, emptyStateHTML } from "./utils.js";
import { postCardHTML, attachPostCardListeners, renderPosts } from "./post-card.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { loadWithCache, livePosts } from "./cache.js";

const EMPTY_FEED_HTML = emptyStateHTML("image", "Ninguno de tus amigos ha dicho nada", "Sal y toca césped.");

let oldestLoadedDate = null;
let isLoadingMore = false;
let reachedEnd = false;
let pagesLoaded = 0;
let observer = null;

function showFirstPage(feedListEl, posts) {
  renderPosts(feedListEl, posts, EMPTY_FEED_HTML);
  oldestLoadedDate = posts.at(-1)?.created_at ?? null;
  reachedEnd = posts.length === 0;
  pagesLoaded = 1;
}

// Resolves true when a new page was added.
async function loadMorePosts(feedListEl) {
  if (isLoadingMore || reachedEnd || !oldestLoadedDate) return false;
  isLoadingMore = true;

  try {
    const { posts } = await getFeed(oldestLoadedDate);
    if (!feedListEl.isConnected) return false;

    if (posts.length === 0) {
      reachedEnd = true;
      return false;
    }

    feedListEl.insertAdjacentHTML("beforeend", posts.map(postCardHTML).join(""));
    attachPostCardListeners(feedListEl);
    oldestLoadedDate = posts.at(-1).created_at;
    pagesLoaded += 1;
    return true;
  } catch (err) {
    showToast(err.message, "error");
    return false;
  } finally {
    isLoadingMore = false;
  }
}

// An invisible marker below the feed asks for the next page when it gets close, with no scroll handler running.
function watchEnd(feedListEl) {
  observer?.disconnect();
  const sentinel = document.createElement("div");
  sentinel.className = "feed-sentinel";
  feedListEl.after(sentinel);

  observer = new IntersectionObserver(
    async (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (!feedListEl.isConnected) {
        observer.disconnect();
        return;
      }
      const added = await loadMorePosts(feedListEl);
      // Still visible after adding a page (short pages): look again.
      if (added) {
        observer.unobserve(sentinel);
        observer.observe(sentinel);
      }
    },
    { rootMargin: "0px 0px 600px 0px" },
  );
  observer.observe(sentinel);
}

export async function renderHome(appEl) {
  appEl.innerHTML = `<div class="feed-list" id="feed-list">${loaderHTML()}</div>`;
  const feedListEl = document.getElementById("feed-list");

  oldestLoadedDate = null;
  isLoadingMore = false;
  reachedEnd = false;
  pagesLoaded = 0;
  watchEnd(feedListEl);

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
