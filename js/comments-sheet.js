import { getComments, createComment } from "./api.js";
import { showToast, formatRelativeTime, haptic, closeSheet, enableSheetDrag } from "./utils.js";
import { icon } from "./icons.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { verifiedBadgeHTML } from "./verified.js";
import { avatarSrc } from "./avatar.js";


function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function commentRowHTML(comment, { className = "", delay = 0 } = {}) {
  const author = comment.profiles ?? { display_name: "Desconocido" };
  // Anonymous comments show only the generated avatar, never a name.
  const nameHTML = comment.anonymous
    ? ""
    : `${escapeHTML(author.display_name)}${verifiedBadgeHTML(author)}`;
  return `
    <div class="comment-row${className}"${delay ? ` style="animation-delay: ${delay}ms"` : ""}>
      <img class="avatar" src="${avatarSrc(author)}" alt="" loading="lazy" />
      <div>
        <p class="comment-author">${nameHTML}<span class="comment-time${comment.anonymous ? " alone" : ""}">${formatRelativeTime(comment.created_at)}</span></p>
        <p class="comment-text">${escapeHTML(comment.text_content)}</p>
      </div>
    </div>
  `;
}

export function openComments(postId, onCountChange, { anonymous = false } = {}) {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="sheet-overlay" id="comments-overlay">
      <div class="sheet-header">
        <span class="sheet-title">Respuestas</span>
        <button class="icon-btn" id="comments-close" aria-label="Cerrar">${icon("x", "bold")}</button>
      </div>
      <div class="sheet-body" id="comments-body">
        <p class="sheet-note">${anonymous ? "Las respuestas en hashtags son anónimas." : "Solo ves las respuestas de tus amigos."}</p>
        <div id="comments-list">${loaderHTML()}</div>
      </div>
      <div class="sheet-footer">
        <input type="text" id="comment-input" placeholder="Escribe una respuesta" maxlength="500" autocomplete="off" />
        <button class="send-btn" id="comment-send" aria-label="Enviar" disabled>${icon("paper-plane-right", "fill")}</button>
      </div>
    </div>`
  );

  const overlay = document.getElementById("comments-overlay");
  const listEl = document.getElementById("comments-list");
  const inputEl = document.getElementById("comment-input");
  const sendBtn = document.getElementById("comment-send");
  const shown = new Set();
  let loadedOnce = false;

  // The first load fades the rows in one after another; later loads only animate the new ones.
  function animationFor(comment, index, firstLoad) {
    const key = comment.id ?? comment.created_at;
    const isNew = !shown.has(key);
    shown.add(key);
    if (firstLoad) return { className: " enter", delay: Math.min(index, 8) * 40 };
    return { className: isNew ? " fresh" : "" };
  }

  async function loadComments() {
    try {
      const { comments } = await getComments(postId);
      const firstLoad = !loadedOnce;
      loadedOnce = true;
      listEl.innerHTML = comments.length
        ? comments.map((comment, i) => commentRowHTML(comment, animationFor(comment, i, firstLoad))).join("")
        : `<p class="empty-label" style="padding: 18px 0;">Aún no hay respuestas visibles</p>`;
    } catch (err) {
      removeLoader(listEl);
      showToast(err.message, "error");
    }
  }

  async function handleSend() {
    const text = inputEl.value.trim();
    if (!text) return;

    sendBtn.disabled = true;
    try {
      await createComment(postId, text);
      inputEl.value = "";
      onCountChange(1);
      await loadComments();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

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

  const close = () => closeSheet(overlay);
  document.getElementById("comments-close").addEventListener("click", close);
  enableSheetDrag(overlay, close);

  loadComments();
}
