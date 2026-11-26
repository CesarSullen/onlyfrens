import { editPost } from "./api.js";
import { haptic, openSheet, showToast } from "./utils.js";
import { linkifyHashtags, extractHashtags } from "./hashtags.js";
import { cacheGet } from "./cache.js";
import { EDIT_WINDOW_MS, TEXT_LIMIT_BY_TIER } from "./tiers.js";

const MAX_ANONYMOUS_TAGS = 5;

function minutesLeft(createdAt) {
  return Math.max(1, Math.ceil((new Date(createdAt).getTime() + EDIT_WINDOW_MS - Date.now()) / 60_000));
}

// Shows the new text on the card without reloading the list.
function applyEdit(card, text) {
  const html = text ? `<p class="post-text">${linkifyHashtags(text)}</p>` : "";
  const current = card.querySelector(".post-text");

  if (current) current.outerHTML = html;
  else if (html) card.querySelector(".post-header").insertAdjacentHTML("afterend", html);

  const time = card.querySelector(".post-time");
  if (time && !time.textContent.includes("editado")) time.textContent += " · editado";
}

// Only the text can change; the photos stay as they were published.
export function openPostEditor(card) {
  const tier = cacheGet("profile")?.profile?.verified_tier ?? 0;
  const limit = TEXT_LIMIT_BY_TIER[tier] ?? TEXT_LIMIT_BY_TIER[0];
  const original = card.querySelector(".post-text")?.textContent.trim() ?? "";
  const hasImages = card.querySelector(".post-image") !== null;
  const anonymous = card.dataset.anonymous === "true";

  const { body, footer, close } = openSheet({
    title: "Editar texto",
    bodyHTML: `
      <textarea class="edit-textarea post-text" id="edit-text" maxlength="${limit}" placeholder="Escribe algo"></textarea>
      <p class="sheet-note"><span id="edit-counter"></span> · Te quedan unos ${minutesLeft(card.dataset.created)} min para editar. Las fotos no se pueden cambiar.</p>`,
    footerHTML: `<button class="solid-btn large" data-role="save">Guardar</button>`,
    footerClass: "audience-footer",
  });

  const textEl = body.querySelector("#edit-text");
  const counterEl = body.querySelector("#edit-counter");
  const saveBtn = footer.querySelector('[data-role="save"]');

  textEl.value = original;
  const refresh = () => {
    counterEl.textContent = `${textEl.value.length}/${limit}`;
    saveBtn.disabled = textEl.value.trim() === original || (!textEl.value.trim() && !hasImages);
  };
  textEl.addEventListener("input", refresh);
  refresh();
  textEl.focus({ preventScroll: true });

  saveBtn.addEventListener("click", async () => {
    haptic();
    const text = textEl.value.trim();
    const tags = extractHashtags(text).length;

    if (anonymous && (tags < 1 || tags > MAX_ANONYMOUS_TAGS)) {
      showToast(`Una publicación anónima lleva entre 1 y ${MAX_ANONYMOUS_TAGS} hashtags`, "error");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando...";

    try {
      await editPost(card.dataset.postId, text);
      applyEdit(card, text);
      haptic("success");
      showToast("Texto actualizado");
      close();
    } catch (err) {
      showToast(err.message, "error");
      saveBtn.textContent = "Guardar";
      refresh();
    }
  });
}
