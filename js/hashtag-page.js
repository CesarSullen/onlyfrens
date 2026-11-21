import { getHashtag, followHashtag, unfollowHashtag, getProfile } from "./api.js";
import { haptic, showToast, escapeHTML, loadModule } from "./utils.js";
import { icon } from "./icons.js";
import { loaderHTML } from "./loader.js";
import { loadWithCache } from "./cache.js";
import { postCardHTML, attachPostCardListeners } from "./post-card.js";

function followLabel(following) {
  return following ? "Siguiendo" : "Seguir";
}

function postsHTML(posts) {
  if (posts.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icon("hash", "regular")}</div>
        <p class="empty-state-title">Aún no hay nada por aquí</p>
        <p class="empty-state-text">Las publicaciones con este hashtag aparecerán aquí durante 24 horas.</p>
      </div>`;
  }
  return `<div class="feed-list">${posts.map(postCardHTML).join("")}</div>`;
}

export async function renderHashtagPage(appEl, tag, { onPublished } = {}) {
  appEl.innerHTML = `
    <div class="user-profile-bar">
      <button class="back-btn" id="back-btn" aria-label="Volver">${icon("caret-left", "regular")}</button>
    </div>
    <div class="hashtag-page fade-in" id="hashtag-page">${loaderHTML()}</div>
  `;

  document.getElementById("back-btn").addEventListener("click", () => {
    haptic();
    history.back();
  });

  const pageEl = document.getElementById("hashtag-page");

  try {
    const data = await getHashtag(tag);
    if (!pageEl.isConnected) return;
    let following = data.following;

    pageEl.innerHTML = `
      <header class="hashtag-head">
        <span class="hashtag-mark">${icon("hash", "regular")}</span>
        <div class="hashtag-title">
          <h1>${escapeHTML(tag)}</h1>
          <p>${data.posts.length === 1 ? "1 publicación" : `${data.posts.length} publicaciones`}</p>
        </div>
        <button class="outline-btn follow-btn${following ? " following" : ""}" id="follow-btn">${followLabel(following)}</button>
      </header>
      <label class="switch-row feed-toggle" id="feed-toggle-row"${following ? "" : " hidden"}>
        <span>Mostrar en mi feed</span>
        <input type="checkbox" id="feed-toggle"${data.in_feed ? " checked" : ""} />
      </label>
      <p class="sheet-note">Solo tus amigos ven quién publica; el resto aparece como anónimo. Puedes dar me gusta y responder en las publicaciones anónimas.</p>
      <div id="hashtag-compose"></div>
      <div id="hashtag-posts">${postsHTML(data.posts)}</div>
    `;

    attachPostCardListeners(pageEl);

    const followBtn = document.getElementById("follow-btn");
    const feedRow = document.getElementById("feed-toggle-row");
    const feedToggle = document.getElementById("feed-toggle");

    function showFollowState() {
      followBtn.classList.toggle("following", following);
      followBtn.textContent = followLabel(following);
      feedRow.hidden = !following;
      if (!following) feedToggle.checked = false;
    }

    followBtn.addEventListener("click", async () => {
      haptic();
      following = !following;
      showFollowState();

      try {
        await (following ? followHashtag(tag) : unfollowHashtag(tag));
      } catch (err) {
        following = !following;
        showFollowState();
        showToast(err.message, "error");
      }
    });

    // Followed hashtags can also bring their posts into the home feed.
    feedToggle.addEventListener("change", async () => {
      haptic();
      const value = feedToggle.checked;
      try {
        await followHashtag(tag, { inFeed: value });
        showToast(value ? "Verás este hashtag en tu feed" : "Ya no aparece en tu feed");
      } catch (err) {
        feedToggle.checked = !value;
        showToast(err.message, "error");
      }
    });

    // Only verified accounts can publish here.
    loadWithCache("profile", getProfile, ({ profile }) => {
      const composeEl = document.getElementById("hashtag-compose");
      if (!profile.verified || !composeEl || composeEl.childElementCount) return;

      composeEl.innerHTML = `<button class="primary-btn" id="hashtag-publish">${icon("hash", "regular")}Publicar en #${escapeHTML(tag)}</button>`;
      document.getElementById("hashtag-publish").addEventListener("click", () => {
        haptic();
        loadModule(
          () => import("./composer.js"),
          ({ openComposer }) =>
            openComposer(() => renderHashtagPage(appEl, tag, { onPublished }), { text: `#${tag} `, anonymous: true }),
        );
      });
    }).catch(() => {});
  } catch (err) {
    pageEl.innerHTML = `<p class="empty-label profile-error">${escapeHTML(err.message)}</p>`;
  }
}
