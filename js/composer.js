import { createPost, uploadImage, deleteUploadedImage, getProfile, getFriends } from "./api.js";
import { loadWithCache } from "./cache.js";
import { showToast, haptic, closeSheet, enableSheetDrag } from "./utils.js";
import { compressImage } from "./compress.js";
import { icon } from "./icons.js";
import { extractHashtags, highlightHashtags } from "./hashtags.js";
import { openAudiencePicker, HIDE_MIN_FRIENDS } from "./audience-picker.js";

const MAX_TEXT_LENGTH = 200;
// Longest text per verified tier: none and blue 200, gold 500, purple 1000.
const TEXT_LIMIT_BY_TIER = [200, 200, 500, 1000];
const MAX_IMAGES = 2;
const MAX_ANONYMOUS_TAGS = 5;

let selectedFiles = [];
// Files that are still being compressed; Publicar waits until it is empty.
let pending = new Set();
// Photos start uploading once compressed; publishing reuses the uploaded url.
let uploads = new Map();
let onPublishedCallback = null;

// Who may see the post ({ mode: "hide" | "only", ids }) and whether it is an anonymous hashtag post.
let audience = null;
let anonymous = false;
let friendCount = 0;
let isVerified = false;

function composerHTML() {
  return `
    <div class="sheet-overlay" id="composer-overlay">
      <div class="composer-sheet fade-in" role="dialog" aria-modal="true" aria-label="Nueva publicación">
        <div class="composer-header">
          <button class="text-btn" id="composer-cancel">Cancelar</button>
          <span class="char-counter" id="char-counter">0/${MAX_TEXT_LENGTH}</span>
          <button class="text-btn primary" id="composer-publish" disabled>Publicar</button>
        </div>

        <div class="composer-field">
          <div class="composer-textarea post-text composer-mirror" id="composer-mirror" aria-hidden="true"></div>
          <textarea
            class="composer-textarea post-text"
            id="composer-text"
            placeholder="¿Qué está pasando?"
            maxlength="${MAX_TEXT_LENGTH}"
          ></textarea>
        </div>

        <div class="composer-images" id="composer-images"></div>

        <p class="composer-note" id="composer-note" hidden>
          Siempre es anónimo: sin tu nombre ni tu foto. Escribe de 1 a 5 #hashtags.
        </p>

        <div class="composer-footer">
          <div class="composer-actions">
            <button class="icon-btn" id="composer-add-image" type="button" aria-label="Agregar imagen">
              ${icon("image", "regular")}
            </button>
            <button class="icon-btn toggle-btn" id="composer-repostable" type="button" aria-label="Permitir reposts" aria-pressed="true">
              ${icon("arrows-clockwise", "regular")}
            </button>
            <button class="icon-btn toggle-btn" id="composer-downloadable" type="button" aria-label="Permitir descargar fotos" aria-pressed="true" hidden>
              ${icon("download-simple", "regular")}
            </button>
            <button class="icon-btn toggle-btn" id="composer-anonymous" type="button" aria-label="Publicar en hashtags" aria-pressed="false" hidden>
              ${icon("hash", "regular")}
            </button>
          </div>
          <button class="option-chip" id="composer-audience" type="button"></button>
        </div>

        <input type="file" id="composer-file-input" accept="image/*" multiple hidden />
      </div>
    </div>
  `;
}

const previewUrls = new Map();

function previewUrl(file) {
  if (!previewUrls.has(file)) previewUrls.set(file, URL.createObjectURL(file));
  return previewUrls.get(file);
}

function releasePreviews(keep = []) {
  for (const [file, url] of previewUrls) {
    if (keep.includes(file)) continue;
    URL.revokeObjectURL(url);
    previewUrls.delete(file);
  }
}

function renderImagePreviews(container) {
  releasePreviews(selectedFiles);
  container.innerHTML = selectedFiles
    .map(
      (file, index) => `
        <div class="composer-image-preview${pending.has(file) ? " processing" : ""}">
          <img src="${previewUrl(file)}" alt="" decoding="async" />
          <button class="remove-image-btn" data-index="${index}" aria-label="Quitar imagen">${icon("x", "bold")}</button>
        </div>
      `,
    )
    .join("");

  container.querySelectorAll(".remove-image-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [removed] = selectedFiles.splice(Number(btn.dataset.index), 1);
      discardUpload(removed);
      renderImagePreviews(container);
      updatePublishState();
    });
  });

  document.getElementById("composer-downloadable")?.toggleAttribute("hidden", selectedFiles.length === 0);
}

function startUpload(file) {
  const upload = uploadImage(file).then(({ url }) => url);
  uploads.set(file, upload);
  upload.catch(() => uploads.delete(file));
}

// A photo that was uploaded but will not be published is deleted from Storage.
function discardUpload(file) {
  const upload = uploads.get(file);
  uploads.delete(file);
  upload?.then((url) => deleteUploadedImage(url)).catch(() => {});
}

// The preview shows the original right away and swaps in the compressed file when it is ready.
function compressInBackground(file, container) {
  const mine = pending;
  mine.add(file);

  compressImage(file)
    .then((compressed) => {
      const index = selectedFiles.indexOf(file);
      if (index === -1) return;
      selectedFiles[index] = compressed;
      startUpload(compressed);
    })
    .catch(() => {
      const index = selectedFiles.indexOf(file);
      if (index !== -1) selectedFiles.splice(index, 1);
      if (mine === pending) showToast("No se pudo procesar esa imagen", "error");
    })
    .finally(() => {
      mine.delete(file);
      if (mine !== pending) return;
      renderImagePreviews(container);
      updatePublishState();
    });
}

function updatePublishState() {
  const textEl = document.getElementById("composer-text");
  const publishBtn = document.getElementById("composer-publish");
  if (!textEl || !publishBtn) return;
  const text = textEl.value.trim();
  // Anonymous posts need at least one hashtag in the text; images are optional.
  const hasContent = anonymous
    ? extractHashtags(text).length > 0
    : text.length > 0 || selectedFiles.length > 0;
  publishBtn.disabled = !hasContent || pending.size > 0;
}

function closeComposer() {
  closeSheet(document.getElementById("composer-overlay"));
  document.removeEventListener("keydown", onComposerKey);
  document.getElementById("composer-fab")?.classList.remove("open");
  selectedFiles.forEach(discardUpload);
  selectedFiles = [];
  pending = new Set();
  uploads = new Map();
  releasePreviews();
  audience = null;
  anonymous = false;
}

function onComposerKey(e) {
  if (e.key === "Escape" && !document.querySelector(".sheet-overlay:not(#composer-overlay)")) closeComposer();
}

function audienceChipHTML() {
  if (friendCount < HIDE_MIN_FRIENDS) {
    return `${icon("lock", "regular")}${HIDE_MIN_FRIENDS} amigos`;
  }
  if (!audience) return `${icon("users", "regular")}Todos`;
  const n = audience.ids.length;
  return audience.mode === "hide"
    ? `${icon("eye-slash", "regular")}Oculto para ${n}`
    : `${icon("eye", "regular")}Solo para ${n}`;
}

// Shows only the options that apply right now: anonymous posts have no audience or reposts.
function updateOptions() {
  const chip = document.getElementById("composer-audience");
  chip.innerHTML = audienceChipHTML();
  chip.classList.toggle("locked", friendCount < HIDE_MIN_FRIENDS);
  chip.classList.toggle("active", !!audience);
  chip.hidden = anonymous;

  document.getElementById("composer-anonymous").hidden = !isVerified;
  document.getElementById("composer-note").hidden = !anonymous;
  document.getElementById("composer-repostable").hidden = anonymous;
  document.getElementById("composer-text").placeholder = anonymous
    ? "Escribe algo con #hashtags"
    : "¿Qué está pasando?";
  updatePublishState();
}

async function handleAudience() {
  if (friendCount < HIDE_MIN_FRIENDS) {
    showToast(`Desbloquea la audiencia con ${HIDE_MIN_FRIENDS} amigos`);
    return;
  }

  try {
    let data;
    await loadWithCache("friends", getFriends, (value) => {
      data ??= value;
    });
    openAudiencePicker({
      friends: data.friends,
      friendCount,
      current: audience,
      onDone: (value) => {
        audience = value;
        updateOptions();
      },
    });
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handlePublish() {
  const textEl = document.getElementById("composer-text");
  const repostable = document.getElementById("composer-repostable").getAttribute("aria-pressed") === "true";
  const downloadable = document.getElementById("composer-downloadable").getAttribute("aria-pressed") === "true";
  const publishBtn = document.getElementById("composer-publish");

  publishBtn.disabled = true;
  publishBtn.textContent = "Publicando...";

  try {
    const uploadedUrls = await Promise.all(
      selectedFiles.map((file) => uploads.get(file) ?? uploadImage(file).then(({ url }) => url)),
    );

    const text = textEl.value.trim();
    if (anonymous && extractHashtags(text).length > MAX_ANONYMOUS_TAGS) {
      throw new Error(`Usa como máximo ${MAX_ANONYMOUS_TAGS} hashtags`);
    }

    await createPost({
      text_content: text || undefined,
      image_url: uploadedUrls[0],
      image_url_2: uploadedUrls[1],
      is_repostable: anonymous ? false : repostable,
      allow_download: selectedFiles.length ? downloadable : undefined,
      audience: audience && !anonymous ? { mode: audience.mode, user_ids: audience.ids } : undefined,
      anonymous: anonymous || undefined,
    });

    haptic("success");
    showToast("Publicado");
    // The photos belong to the post now, so closing must not delete them.
    uploads.clear();
    closeComposer();
    if (onPublishedCallback) onPublishedCallback();
  } catch (err) {
    showToast(err.message, "error");
    publishBtn.disabled = false;
    publishBtn.textContent = "Publicar";
  }
}

export function openComposer(onPublished, { text = "", files = [], anonymous: startAnonymous = false } = {}) {
  onPublishedCallback = onPublished;
  audience = null;
  anonymous = false;
  friendCount = 0;
  isVerified = false;
  selectedFiles = files.slice(0, MAX_IMAGES);
  pending = new Set();
  uploads = new Map();

  document.body.insertAdjacentHTML("beforeend", composerHTML());
  document.getElementById("composer-fab")?.classList.add("open");
  enableSheetDrag(document.getElementById("composer-overlay"), closeComposer);
  document.addEventListener("keydown", onComposerKey);

  const textEl = document.getElementById("composer-text");
  const mirrorEl = document.getElementById("composer-mirror");
  const counterEl = document.getElementById("char-counter");
  const imagesContainer = document.getElementById("composer-images");
  const fileInput = document.getElementById("composer-file-input");

  const anonymousEl = document.getElementById("composer-anonymous");
  const repostableEl = document.getElementById("composer-repostable");
  const downloadableEl = document.getElementById("composer-downloadable");

  let textLimit = MAX_TEXT_LENGTH;

  function updateCounter() {
    counterEl.textContent = `${textEl.value.length}/${textLimit}`;
  }

  // The visible text lives in the mirror so hashtags can be styled while the textarea keeps the caret.
  function renderMirror() {
    mirrorEl.innerHTML = highlightHashtags(textEl.value);
    mirrorEl.scrollTop = textEl.scrollTop;
  }

  textEl.addEventListener("input", () => {
    renderMirror();
    updateCounter();
    updatePublishState();
  });

  textEl.addEventListener("scroll", () => {
    mirrorEl.scrollTop = textEl.scrollTop;
  });

  // Starts at the normal limit and rises to the one of the user's tier as soon as the profile says so.
  loadWithCache("profile", getProfile, ({ profile }) => {
    textLimit = TEXT_LIMIT_BY_TIER[profile.verified_tier ?? 0] ?? MAX_TEXT_LENGTH;
    textEl.maxLength = textLimit;
    friendCount = profile.friend_count ?? 0;
    isVerified = !!profile.verified;
    if (startAnonymous && isVerified && !anonymous) {
      anonymousEl.setAttribute("aria-pressed", "true");
      setAnonymous(true);
    }
    updateCounter();
    updateOptions();
  }).catch(() => {});

  function setAnonymous(value) {
    anonymous = value;
    if (value) audience = null;
    updateOptions();
  }

  // Flips a toggle button and returns its new state.
  function flip(button) {
    const on = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(on));
    return on;
  }

  anonymousEl.addEventListener("click", () => {
    haptic();
    const on = flip(anonymousEl);
    showToast(on ? "Solo en hashtags" : "En tu perfil");
    setAnonymous(on);
  });

  repostableEl.addEventListener("click", () => {
    haptic();
    showToast(flip(repostableEl) ? "Reposts permitidos" : "Reposts desactivados");
  });

  downloadableEl.addEventListener("click", () => {
    haptic();
    showToast(flip(downloadableEl) ? "Descarga de fotos permitida" : "Descarga de fotos desactivada");
  });

  document.getElementById("composer-audience").addEventListener("click", () => {
    haptic();
    handleAudience();
  });

  document.getElementById("composer-add-image").addEventListener("click", () => {
    if (selectedFiles.length >= MAX_IMAGES) {
      showToast(`Máximo ${MAX_IMAGES} imágenes`);
      return;
    }
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const remaining = MAX_IMAGES - selectedFiles.length;
    const newFiles = Array.from(fileInput.files).slice(0, remaining);
    selectedFiles.push(...newFiles);
    newFiles.forEach((file) => compressInBackground(file, imagesContainer));
    renderImagePreviews(imagesContainer);
    updatePublishState();
    fileInput.value = "";
  });

  textEl.value = text.slice(0, textLimit);
  renderMirror();
  selectedFiles.forEach((file) => compressInBackground(file, imagesContainer));
  renderImagePreviews(imagesContainer);
  updateCounter();
  updateOptions();

  document.getElementById("composer-cancel").addEventListener("click", () => {
    haptic();
    closeComposer();
  });

  document.getElementById("composer-publish").addEventListener("click", () => {
    haptic();
    handlePublish();
  });
}
