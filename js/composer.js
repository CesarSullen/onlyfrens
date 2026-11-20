import { createPost, uploadImage, getProfile, getFriends } from "./api.js";
import { loadWithCache } from "./cache.js";
import { showToast, haptic, closeSheet, enableSheetDrag } from "./utils.js";
import { compressImage } from "./compress.js";
import { icon } from "./icons.js";
import { extractHashtags } from "./hashtags.js";
import { openAudiencePicker, HIDE_MIN_FRIENDS } from "./audience-picker.js";

const MAX_TEXT_LENGTH = 200;
const MAX_TEXT_LENGTH_VERIFIED = 500;
const MAX_IMAGES = 2;
const MAX_ANONYMOUS_TAGS = 5;

let selectedFiles = [];
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

        <textarea
          class="composer-textarea post-text"
          id="composer-text"
          placeholder="¿Qué está pasando?"
          maxlength="${MAX_TEXT_LENGTH}"
        ></textarea>

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
        <div class="composer-image-preview">
          <img src="${previewUrl(file)}" alt="" decoding="async" />
          <button class="remove-image-btn" data-index="${index}" aria-label="Quitar imagen">${icon("x", "bold")}</button>
        </div>
      `,
    )
    .join("");

  container.querySelectorAll(".remove-image-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedFiles.splice(Number(btn.dataset.index), 1);
      renderImagePreviews(container);
      updatePublishState();
    });
  });
}

function updatePublishState() {
  const textEl = document.getElementById("composer-text");
  const publishBtn = document.getElementById("composer-publish");
  const text = textEl.value.trim();
  // Anonymous posts need at least one hashtag in the text; images are optional.
  const hasContent = anonymous
    ? extractHashtags(text).length > 0
    : text.length > 0 || selectedFiles.length > 0;
  publishBtn.disabled = !hasContent;
}

function closeComposer() {
  closeSheet(document.getElementById("composer-overlay"));
  document.removeEventListener("keydown", onComposerKey);
  document.getElementById("composer-fab")?.classList.remove("open");
  selectedFiles = [];
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
  const publishBtn = document.getElementById("composer-publish");

  publishBtn.disabled = true;
  publishBtn.textContent = "Publicando...";

  try {
    // Anonymous posts upload to a folder that doesn't carry the user id.
    const uploadedUrls = await Promise.all(
      selectedFiles.map(async (file) => {
        const { url } = await uploadImage(await compressImage(file), { anonymous });
        return url;
      }),
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
      audience: audience && !anonymous ? { mode: audience.mode, user_ids: audience.ids } : undefined,
      anonymous: anonymous || undefined,
    });

    haptic("success");
    showToast("Publicado");
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

  document.body.insertAdjacentHTML("beforeend", composerHTML());
  document.getElementById("composer-fab")?.classList.add("open");
  enableSheetDrag(document.getElementById("composer-overlay"), closeComposer);
  document.addEventListener("keydown", onComposerKey);

  const textEl = document.getElementById("composer-text");
  const counterEl = document.getElementById("char-counter");
  const imagesContainer = document.getElementById("composer-images");
  const fileInput = document.getElementById("composer-file-input");

  const anonymousEl = document.getElementById("composer-anonymous");
  const repostableEl = document.getElementById("composer-repostable");

  let textLimit = MAX_TEXT_LENGTH;

  function updateCounter() {
    counterEl.textContent = `${textEl.value.length}/${textLimit}`;
  }

  textEl.addEventListener("input", () => {
    updateCounter();
    updatePublishState();
  });

  // Starts at the normal limit and rises to the verified one as soon as the profile says so.
  loadWithCache("profile", getProfile, ({ profile }) => {
    textLimit = profile.verified ? MAX_TEXT_LENGTH_VERIFIED : MAX_TEXT_LENGTH;
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
    renderImagePreviews(imagesContainer);
    updatePublishState();
    fileInput.value = "";
  });

  textEl.value = text.slice(0, textLimit);
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
