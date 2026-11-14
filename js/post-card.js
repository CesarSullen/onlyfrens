import { likePost, unlikePost, repost, undoRepost, deletePost, getUserId } from "./api.js";
import { showToast, showConfirm, formatPostTime, haptic } from "./utils.js";
import { icon } from "./icons.js";
import { openComments } from "./comments-sheet.js";
import { openInteractions } from "./interactions.js";
import { openUserProfile } from "./navigation.js";
import { verifiedBadgeHTML } from "./verified.js";
import { avatarSrc } from "./avatar.js";


function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function isBirthdayToday(profile) {
  if (!profile?.birthday_day || !profile?.birthday_month) return false;
  const today = new Date();
  return profile.birthday_day === today.getDate() && profile.birthday_month === today.getMonth() + 1;
}

function actionButtonHTML({ cls, label, name, active, count, extra = "" }) {
  return `
    <button class="action-btn ${cls}${active ? " active" : ""}" aria-label="${label}" ${extra}>
      <span class="action-icon">
        ${icon(name, "regular", "icon-outline")}
        ${icon(name, "fill", "icon-filled")}
      </span>
      <span class="action-count">${count ?? 0}</span>
    </button>
  `;
}

export function postCardHTML(post) {
  const author = post.author ?? { display_name: "Desconocido", username: "" };
  const content = post.post_content;

  const birthdayPill = isBirthdayToday(author)
    ? `<div class="pill pill-birthday">${icon("cake", "fill")}Cumpleaños</div>`
    : "";

  const repostPill = post.is_repost
    ? `<div class="pill pill-repost">${icon("arrows-clockwise", "regular")}Compartido</div>`
    : "";

  const textHTML = content.text_content
    ? `<p class="post-text">${escapeHTML(content.text_content)}</p>`
    : "";

  const images = [content.image_url, content.image_url_2].filter(Boolean);
  const imagesHTML = images.length
    ? `<div class="post-images${images.length === 2 ? " two" : ""}">${images
        .map((url) => `<img class="post-image" src="${url}" loading="lazy" alt="" />`)
        .join("")}</div>`
    : "";

  const repostButton = content.is_repostable
    ? actionButtonHTML({
        cls: "repost-btn",
        label: "Compartir",
        name: "arrows-clockwise",
        active: post.reposted_by_me,
        count: post.repost_count,
        extra: `data-content-id="${content.id}"`,
      })
    : "";

  const isContentOwner = content.author_id
    ? content.author_id === getUserId()
    : post.is_mine && !post.is_repost;

  const metricsButton = isContentOwner
    ? `<button class="action-btn metrics-btn" aria-label="Ver interacciones">${icon("chart-bar", "regular")}</button>`
    : "";

  const profileAttr = post.is_mine
    ? 'data-profile=""'
    : author.username
      ? `data-profile="${escapeHTML(author.username)}"`
      : "";

  return `
    <article class="post-card fade-in" data-post-id="${post.id}" data-is-repost="${post.is_repost}">
      ${birthdayPill}
      ${repostPill}
      <header class="post-header">
        <img class="avatar${profileAttr ? " tappable" : ""}" ${profileAttr} src="${avatarSrc(author)}" alt="" loading="lazy" />
        <div>
          <p class="post-author${profileAttr ? " tappable" : ""}" ${profileAttr}>${escapeHTML(author.display_name)}${verifiedBadgeHTML(author)}</p>
          <p class="post-time">${formatPostTime(post.created_at)}</p>
        </div>
        ${post.is_mine ? `<button class="post-delete-btn" aria-label="Eliminar publicación">${icon("trash")}</button>` : ""}
      </header>
      ${textHTML}
      ${imagesHTML}
      <div class="post-actions">
        ${actionButtonHTML({ cls: "like-btn", label: "Me gusta", name: "heart", active: post.liked_by_me, count: post.like_count })}
        ${actionButtonHTML({ cls: "comment-btn", label: "Respuestas", name: "chat-circle", active: false, count: post.comment_count })}
        ${repostButton}
        ${metricsButton}
      </div>
    </article>
  `;
}

function adjustCount(btn, delta) {
  const countEl = btn.querySelector(".action-count");
  countEl.textContent = Math.max(0, Number(countEl.textContent) + delta);
}

async function handleToggle(btn, postId, { add, remove }) {
  const wasActive = btn.classList.contains("active");
  btn.classList.toggle("active", !wasActive);
  adjustCount(btn, wasActive ? -1 : 1);

  try {
    await (wasActive ? remove(postId) : add(postId));
  } catch (err) {
    btn.classList.toggle("active", wasActive);
    adjustCount(btn, wasActive ? 1 : -1);
    showToast(err.message, "error");
  }
}

function handleDelete(card, postId) {
  const message =
    card.dataset.isRepost === "true"
      ? "¿Quitar esta publicación compartida?"
      : "¿Eliminar esta publicación? Se borrará para todos, incluidos quienes la compartieron.";

  showConfirm(message, async () => {
    try {
      await deletePost(postId);
      card.remove();
      showToast("Publicación eliminada");
    } catch (err) {
      showToast(err.message, "error");
    }
  }, true);
}

export function attachPostCardListeners(container) {
  container.querySelectorAll(".post-card").forEach((card) => {
    if (card.dataset.bound) return;
    card.dataset.bound = "true";
    const postId = card.dataset.postId;

    card.querySelector(".like-btn").addEventListener("click", (e) =>
      handleToggle(e.currentTarget, postId, { add: likePost, remove: unlikePost })
    );

    card.querySelectorAll("[data-profile]").forEach((el) => {
      el.addEventListener("click", () => {
        haptic();
        openUserProfile(el.dataset.profile);
      });
    });

    card.querySelector(".metrics-btn")?.addEventListener("click", () => {
      haptic();
      openInteractions(postId);
    });

    card.querySelector(".repost-btn")?.addEventListener("click", (e) =>
      handleToggle(e.currentTarget, postId, { add: repost, remove: undoRepost })
    );

    card.querySelector(".post-delete-btn")?.addEventListener("click", () => handleDelete(card, postId));

    const commentBtn = card.querySelector(".comment-btn");
    commentBtn.addEventListener("click", () =>
      openComments(postId, (delta) => adjustCount(commentBtn, delta))
    );
  });
}
