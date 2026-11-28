import { getFeed, getProfile, getThoughts } from "./api.js";
import { showToast, emptyStateHTML, haptic } from "./utils.js";
import { shareProfile } from "./profile-view.js";
import { thoughtRowHTML, tintClouds } from "./thought.js";
import { openPost } from "./navigation.js";
import { loadModule } from "./utils.js";
import { postCardHTML, attachPostCardListeners, renderPosts } from "./post-card.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { loadWithCache, livePosts, cacheGet } from "./cache.js";

const EMPTY_FEED_HTML = emptyStateHTML(
  "image",
  "Ninguno de tus amigos ha subido nada",
  "Deberías conseguir nuevos amigos :)",
  "",
  `<button class="text-btn primary" id="feed-invite">Invitar amigos</button>`,
);

// Shares the own profile link, same as the share button of the profile.
async function inviteFriends() {
  try {
    const profile = cacheGet("profile")?.profile ?? (await getProfile()).profile;
    shareProfile(profile);
  } catch (err) {
    showToast(err.message, "error");
  }
}

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

// The row only shows once someone, including you, has a thought.
function showThoughtRow(rowEl, thoughts) {
  if (!rowEl.isConnected) return;
  rowEl.hidden = thoughts.length === 0;
  if (thoughts.length === 0) return;
  const own = cacheGet("profile")?.profile ?? {};
  rowEl.innerHTML = thoughtRowHTML(thoughts, own);
  tintClouds(rowEl);
}

function bindThoughtRow(rowEl) {
  rowEl.addEventListener("click", (event) => {
    const item = event.target.closest(".thought-item");
    if (!item) return;
    haptic();
    if (item.dataset.post) {
      openPost(item.dataset.post);
      return;
    }
    loadModule(
      () => import("./composer.js"),
      ({ openComposer }) => openComposer(() => {}, { thought: true }),
    );
  });
}

export async function renderHome(appEl) {
  appEl.innerHTML = `<div class="thought-row" id="thought-row" hidden></div><div class="feed-list" id="feed-list">${loaderHTML()}</div>`;
  const rowEl = document.getElementById("thought-row");
  bindThoughtRow(rowEl);
  loadWithCache("thoughts", getThoughts, ({ thoughts }) => showThoughtRow(rowEl, thoughts), 30_000).catch(() => {});
  const feedListEl = document.getElementById("feed-list");

  feedListEl.addEventListener("click", (event) => {
    if (!event.target.closest("#feed-invite")) return;
    haptic();
    inviteFriends();
  });

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
