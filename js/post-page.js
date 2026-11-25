import { getPost, getComments, createComment, likeComment, unlikeComment, getProfile } from "./api.js";
import { loadWithCache } from "./cache.js";
import { showToast, formatRelativeTime, haptic, escapeHTML, emptyLabelHTML, emptyStateHTML, backBarHTML } from "./utils.js";
import { icon } from "./icons.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { verifiedBadgeHTML } from "./verified.js";
import { avatarSrc } from "./avatar.js";
import { postCardHTML, attachPostCardListeners, adjustCount } from "./post-card.js";

function commentRowHTML(comment, { className = "", delay = 0 } = {}) {
  const likes = comment.like_count ?? 0;
  const author = comment.profiles ?? { display_name: "Desconocido" };
  // Anonymous comments show only the generated avatar, never a name.
  const nameHTML = comment.anonymous
    ? ""
    : `${escapeHTML(author.display_name)}${verifiedBadgeHTML(author)}`;
  return `
    <div class="comment-row${className}"${delay ? ` style="animation-delay: ${delay}ms"` : ""}>
      <img class="avatar" src="${escapeHTML(avatarSrc(author))}" alt="" loading="lazy" decoding="async" />
      <div>
        <p class="comment-author">${nameHTML}<span class="comment-time${comment.anonymous ? " alone" : ""}">${formatRelativeTime(comment.created_at)}</span></p>
        <p class="comment-text">${escapeHTML(comment.text_content)}</p>
      </div>
      <button class="comment-like${comment.liked_by_me ? " liked" : ""}" data-comment-id="${comment.id ?? ""}" aria-label="Me gusta"${comment.id ? "" : " disabled"}>
        <span class="heart-out">${icon("heart", "regular")}</span>
        <span class="heart-in">${icon("heart", "fill")}</span>
        <span class="comment-like-count">${likes || ""}</span>
      </button>
    </div>
  `;
}

function unavailableHTML(err) {
  if (err.status === 404) {
    return emptyStateHTML("chat-circle", "Esta publicación ya no está disponible", "Las publicaciones duran 24 horas.");
  }
  return emptyLabelHTML(escapeHTML(err.message), "error");
}

export async function renderPostPage(appEl, postId) {
  appEl.innerHTML = `${backBarHTML()}<div class="post-page fade-in" data-post-page>${loaderHTML()}</div>`;
  const pageEl = appEl.querySelector(".post-page");

  appEl.querySelector(".back-btn").addEventListener("click", () => {
    haptic();
    history.back();
  });

  // Both requests start together, so the replies are usually ready when the post shows up.
  const commentsRequest = getComments(postId);
  commentsRequest.catch(() => {});

  let post;
  try {
    ({ post } = await getPost(postId));
  } catch (err) {
    if (pageEl.isConnected) pageEl.innerHTML = unavailableHTML(err);
    return;
  }
  if (!pageEl.isConnected) return;

  const anonymous = post.post_content.anonymous === true;

  pageEl.innerHTML = `
    ${postCardHTML(post)}
    <div class="reply-box">
      <input class="reply-input" type="text" placeholder="Escribe una respuesta" maxlength="500" autocomplete="off" />
      <button class="send-btn" aria-label="Enviar" disabled>${icon("paper-plane-right", "fill")}</button>
    </div>
    <p class="sheet-note">${anonymous ? "Las respuestas en hashtags son anónimas." : "Solo ves las respuestas de tus amigos."}</p>
    <div class="comments-list">${loaderHTML()}</div>
  `;
  attachPostCardListeners(pageEl);

  const listEl = pageEl.querySelector(".comments-list");
  const inputEl = pageEl.querySelector(".reply-input");
  const sendBtn = pageEl.querySelector(".send-btn");
  const commentBtn = pageEl.querySelector(".comment-btn");
  const shown = new Set();
  let loadedOnce = false;
  let me = null;

  // Needed to show your own reply right away, before the server confirms it.
  loadWithCache("profile", getProfile, ({ profile }) => {
    me = profile;
  }).catch(() => {});

  // The first load fades the rows in one after another; later loads only animate the new ones.
  function animationFor(comment, index, { firstLoad, quiet }) {
    const key = comment.id ?? comment.created_at;
    const isNew = !shown.has(key);
    shown.add(key);
    if (quiet) return { className: "" };
    if (firstLoad) return { className: " enter", delay: Math.min(index, 8) * 40 };
    return { className: isNew ? " fresh" : "" };
  }

  function showComments(comments, options) {
    const firstLoad = !loadedOnce;
    loadedOnce = true;
    listEl.innerHTML = comments.length
      ? comments.map((comment, i) => commentRowHTML(comment, animationFor(comment, i, { firstLoad, ...options }))).join("")
      : emptyLabelHTML("Aún no hay respuestas visibles");
  }

  // quiet: syncing after your own reply, so nothing animates again.
  async function loadComments({ quiet = false } = {}) {
    try {
      const { comments } = await (quiet ? getComments(postId) : commentsRequest);
      if (listEl.isConnected) showComments(comments, { quiet });
    } catch (err) {
      removeLoader(listEl);
      showToast(err.message, "error");
    }
  }

  function addLocalRow(text) {
    listEl.querySelector(".empty-label, .loader")?.remove();
    listEl.insertAdjacentHTML(
      "beforeend",
      commentRowHTML({ profiles: me, text_content: text, created_at: new Date().toISOString() }, { className: " fresh" }),
    );
    const row = listEl.lastElementChild;
    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return row;
  }

  async function handleSend() {
    const text = inputEl.value.trim();
    if (!text) return;

    sendBtn.disabled = true;
    inputEl.value = "";
    // Anonymous replies wait for the server: their avatar is generated there.
    const row = !anonymous && me ? addLocalRow(text) : null;

    try {
      await createComment(postId, text);
      if (commentBtn) adjustCount(commentBtn, 1);
      await loadComments({ quiet: true });
    } catch (err) {
      row?.remove();
      inputEl.value = text;
      sendBtn.disabled = false;
      showToast(err.message, "error");
    }
  }

  // Optimistic like on a comment; goes back if the request fails.
  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest(".comment-like");
    if (!btn) return;

    haptic();
    const countEl = btn.querySelector(".comment-like-count");
    const liked = !btn.classList.contains("liked");
    const apply = (value, delta) => {
      btn.classList.toggle("liked", value);
      countEl.textContent = Math.max(0, (Number(countEl.textContent) || 0) + delta) || "";
    };

    apply(liked, liked ? 1 : -1);
    try {
      await (liked ? likeComment(postId, btn.dataset.commentId) : unlikeComment(postId, btn.dataset.commentId));
    } catch (err) {
      apply(!liked, liked ? -1 : 1);
      showToast(err.message, "error");
    }
  });

  inputEl.addEventListener("input", () => {
    sendBtn.disabled = inputEl.value.trim().length === 0;
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });

  sendBtn.addEventListener("click", () => {
    haptic();
    handleSend();
  });

  loadComments();
}
