import { likePost, unlikePost, repost, undoRepost, deletePost, getUserId } from "./api.js";
import { showToast, showActions, undoable, formatPostTime, haptic, replay, escapeHTML } from "./utils.js";
import { icon } from "./icons.js";
import { verifiedBadgeHTML } from "./verified.js";
import { avatarSrc } from "./avatar.js";
import { linkifyHashtags } from "./hashtags.js";
import { openHashtag, openUserProfile } from "./navigation.js";
import { cacheGet } from "./cache.js";

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

  // Anonymous posts: replies are open (and anonymous), but no reposts and no list of who liked them.
  const anonymous = content.anonymous === true;

  const anonymousPill = anonymous && !post.is_repost
    ? `<div class="pill pill-anonymous">${icon("eye-slash", "regular")}Anónimo</div>`
    : "";

  const repostPill = post.is_repost
    ? `<div class="pill pill-repost">${icon("arrows-clockwise", "regular")}Compartido</div>`
    : "";

  const textHTML = content.text_content
    ? `<p class="post-text">${linkifyHashtags(content.text_content)}</p>`
    : "";

  const images = [content.image_url, content.image_url_2].filter(Boolean);
  const imagesHTML = images.length
    ? `<div class="post-images${images.length === 2 ? " two" : ""}">${images
        .map((url) => `<img class="post-image" src="${url}" loading="lazy" decoding="async" alt="" />`)
        .join("")}</div>`
    : "";

  const repostButton = content.is_repostable && !anonymous
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

  const hasStats = isContentOwner && !anonymous;
  const hasMenu = post.is_mine || hasStats || Boolean(content.text_content);
  const signature = [post.like_count, post.comment_count, post.repost_count, post.liked_by_me, post.reposted_by_me].join("|");

  const profileAttr = anonymous
    ? ""
    : post.is_mine
    ? 'data-profile=""'
    : author.username
      ? `data-profile="${escapeHTML(author.username)}"`
      : "";

  return `
    <article class="post-card fade-in" data-post-id="${post.id}" data-sig="${signature}" data-is-repost="${post.is_repost}" data-anonymous="${anonymous}" data-downloadable="${content.allow_download !== false}" data-mine="${Boolean(post.is_mine)}" data-stats="${hasStats}">
      ${birthdayPill}
      ${anonymousPill}
      ${repostPill}
      <header class="post-header">
        <img class="avatar${profileAttr ? " tappable" : ""}" ${profileAttr} src="${avatarSrc(author)}" alt="" loading="lazy" decoding="async" />
        <div>
          <p class="post-author${profileAttr ? " tappable" : ""}" ${profileAttr}>${escapeHTML(author.display_name)}${verifiedBadgeHTML(author)}</p>
          <p class="post-time">${formatPostTime(post.created_at)}</p>
        </div>
        ${hasMenu ? `<button class="post-menu-btn" aria-label="Más opciones">${icon("dots-three", "bold")}</button>` : ""}
      </header>
      ${textHTML}
      ${imagesHTML}
      <div class="post-actions">
        ${actionButtonHTML({ cls: "like-btn", label: "Me gusta", name: "heart", active: post.liked_by_me, count: post.like_count })}
        ${actionButtonHTML({ cls: "comment-btn", label: "Respuestas", name: "chat-circle", active: false, count: post.comment_count })}
        ${repostButton}
      </div>
    </article>
  `;
}

function adjustCount(btn, delta) {
  const countEl = btn.querySelector(".action-count");
  countEl.textContent = Math.max(0, Number(countEl.textContent) + delta);
  countEl.dataset.dir = delta > 0 ? "up" : "down";
  replay(countEl, "tick");
}

const BURST_DOTS = 6;

function celebrate(btn) {
  const iconEl = btn.querySelector(".action-icon");
  if (!btn.classList.contains("like-btn")) {
    replay(iconEl, "spin");
    return;
  }

  replay(iconEl, "beat");
  for (let i = 0; i < BURST_DOTS; i++) {
    const dot = document.createElement("i");
    dot.className = "burst-dot";
    dot.style.setProperty("--angle", `${(360 / BURST_DOTS) * i}deg`);
    dot.addEventListener("animationend", () => dot.remove());
    iconEl.append(dot);
  }
}

async function handleToggle(btn, postId, { add, remove }) {
  const wasActive = btn.classList.contains("active");
  btn.classList.toggle("active", !wasActive);
  adjustCount(btn, wasActive ? -1 : 1);
  haptic();
  if (!wasActive) celebrate(btn);

  try {
    await (wasActive ? remove(postId) : add(postId));
  } catch (err) {
    btn.classList.toggle("active", wasActive);
    adjustCount(btn, wasActive ? 1 : -1);
    showToast(err.message, "error");
  }
}

// The height is fixed first so the card can shrink to nothing instead of vanishing at once.
function hideCard(card) {
  card.style.height = `${card.offsetHeight}px`;
  card.classList.add("removing");
}

function showCard(card) {
  if (!card.isConnected) return;
  card.classList.remove("removing");
  card.style.height = "";
  replay(card, "fade-in");
}

function handleDelete(card, postId) {
  undoable({
    message: card.dataset.isRepost === "true" ? "Publicación compartida quitada" : "Publicación eliminada",
    hide: () => hideCard(card),
    restore: () => showCard(card),
    commit: async (options) => {
      await deletePost(postId, options);
      card.remove();
    },
  });
}

function copyText(text) {
  navigator.clipboard?.writeText(text).then(
    () => showToast("Texto copiado"),
    () => showToast("No se pudo copiar", "error"),
  );
}

function openPostMenu(card, postId) {
  const items = [];
  const text = card.querySelector(".post-text")?.textContent.trim();

  if (text) items.push({ label: "Copiar texto", onClick: () => copyText(text) });
  if (card.dataset.stats === "true") {
    items.push({
      label: "Ver interacciones",
      onClick: () => import("./interactions.js").then(({ openInteractions }) => openInteractions(postId)),
    });
  }
  if (card.dataset.mine === "true") {
    items.push({
      label: card.dataset.isRepost === "true" ? "Quitar publicación compartida" : "Eliminar publicación",
      destructive: true,
      onClick: () => handleDelete(card, postId),
    });
  }

  showActions(items);
}

function onCardClick(e) {
  const card = e.target.closest(".post-card");
  if (!card) return;
  const postId = card.dataset.postId;
  const hit = (selector) => e.target.closest(selector);
  let el;

  if ((el = hit(".like-btn"))) {
    handleToggle(el, postId, { add: likePost, remove: unlikePost });
  } else if ((el = hit(".repost-btn"))) {
    handleToggle(el, postId, { add: repost, remove: undoRepost });
  } else if ((el = hit(".comment-btn"))) {
    import("./comments-sheet.js").then(({ openComments }) =>
      openComments(postId, (delta) => adjustCount(el, delta), {
        anonymous: card.dataset.anonymous === "true",
      }),
    );
  } else if (hit(".post-menu-btn")) {
    haptic();
    openPostMenu(card, postId);
  } else if ((el = hit("[data-profile]"))) {
    haptic();
    openUserProfile(el.dataset.profile);
  } else if ((el = hit(".hashtag"))) {
    haptic();
    openHashtag(el.dataset.tag);
  } else if ((el = hit(".post-image"))) {
    // Only verified accounts (blue tier or higher) can download, and only when the author allows it.
    const download = card.dataset.downloadable === "true" && (cacheGet("profile")?.profile?.verified_tier ?? 0) >= 1;
    import("./image-viewer.js").then(({ openImageViewer }) => openImageViewer(el.currentSrc || el.src, { download }));
  }
}

// One click listener per container; cards can be swapped without binding again.
export function attachPostCardListeners(container) {
  if (!container.dataset.postListeners) {
    container.dataset.postListeners = "true";
    container.addEventListener("click", onCardClick);
  }

  container.querySelectorAll(".post-image").forEach((image) => {
    if (image.complete) return;
    image.classList.add("pending");
    const ready = () => image.classList.remove("pending");
    image.addEventListener("load", ready, { once: true });
    image.addEventListener("error", ready, { once: true });
  });
}

// Updates the list in place: unchanged cards stay untouched, so a refresh doesn't flash or replay animations.
export function renderPosts(container, posts, emptyHTML = "") {
  const cards = [...container.children].filter((el) => el.classList.contains("post-card"));
  const reconcile = cards.length > 0 && cards.length === container.children.length && posts.length > 0;

  if (!reconcile) {
    container.innerHTML = posts.length ? posts.map(postCardHTML).join("") : emptyHTML;
    attachPostCardListeners(container);
    return;
  }

  const current = new Map(cards.map((card) => [card.dataset.postId, card]));
  const template = document.createElement("template");
  template.innerHTML = posts.map(postCardHTML).join("");

  const nodes = [...template.content.children].map((fresh) => {
    const old = current.get(fresh.dataset.postId);
    if (!old) return fresh;
    if (old.dataset.sig === fresh.dataset.sig) return old;
    fresh.classList.remove("fade-in");
    return fresh;
  });

  const keep = new Set(nodes);
  cards.forEach((card) => {
    if (!keep.has(card)) card.remove();
  });
  nodes.forEach((node, i) => {
    const at = container.children[i];
    if (at !== node) container.insertBefore(node, at ?? null);
  });
  attachPostCardListeners(container);
}
