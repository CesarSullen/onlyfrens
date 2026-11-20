import { getComments, createComment, likeComment, unlikeComment, getProfile } from "./api.js";
import { loadWithCache } from "./cache.js";
import { showToast, formatRelativeTime, haptic, openSheet, escapeHTML, emptyLabelHTML } from "./utils.js";
import { icon } from "./icons.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { verifiedBadgeHTML } from "./verified.js";
import { avatarSrc } from "./avatar.js";

function commentRowHTML(comment, { className = "", delay = 0 } = {}) {
  const likes = comment.like_count ?? 0;
  const author = comment.profiles ?? { display_name: "Desconocido" };
  // Anonymous comments show only the generated avatar, never a name.
  const nameHTML = comment.anonymous
    ? ""
    : `${escapeHTML(author.display_name)}${verifiedBadgeHTML(author)}`;
  return `
    <div class="comment-row${className}"${delay ? ` style="animation-delay: ${delay}ms"` : ""}>
      <img class="avatar" src="${avatarSrc(author)}" alt="" loading="lazy" decoding="async" />
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

export function openComments(postId, onCountChange, { anonymous = false } = {}) {
  const { body, footer } = openSheet({
    title: "Respuestas",
    bodyHTML: `
      <p class="sheet-note">${anonymous ? "Las respuestas en hashtags son anónimas." : "Solo ves las respuestas de tus amigos."}</p>
      <div class="comments-list">${loaderHTML()}</div>`,
    footerHTML: `
      <input type="text" placeholder="Escribe una respuesta" maxlength="500" autocomplete="off" />
      <button class="send-btn" aria-label="Enviar" disabled>${icon("paper-plane-right", "fill")}</button>`,
  });

  const listEl = body.querySelector(".comments-list");
  const inputEl = footer.querySelector("input");
  const sendBtn = footer.querySelector(".send-btn");
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

  // quiet: syncing after your own reply, so nothing animates again.
  async function loadComments({ quiet = false } = {}) {
    try {
      const { comments } = await getComments(postId);
      const firstLoad = !loadedOnce;
      loadedOnce = true;
      listEl.innerHTML = comments.length
        ? comments.map((comment, i) => commentRowHTML(comment, animationFor(comment, i, { firstLoad, quiet }))).join("")
        : emptyLabelHTML("Aún no hay respuestas visibles");
    } catch (err) {
      removeLoader(listEl);
      showToast(err.message, "error");
    }
  }

  function addLocalRow(text) {
    listEl.querySelector(".empty-label, .loader")?.remove();
    listEl.insertAdjacentHTML(
      "beforeend",
      commentRowHTML(
        { profiles: me, text_content: text, created_at: new Date().toISOString() },
        { className: " fresh" },
      ),
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
      onCountChange(1);
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
