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
      <div class="composer-sheet fade-in">
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

        <div class="composer-options">
          <button class="option-chip" id="composer-audience" type="button"></button>
          <label class="switch-row" id="composer-anon-row" hidden>
            <span>Publicar en hashtags</span>
            <input type="checkbox" id="composer-anonymous" />
          </label>
        </div>
        <p class="composer-note" id="composer-note" hidden>
          Siempre es anónimo: sin tu nombre ni tu foto. Escribe de 1 a 5 #hashtags.
        </p>

        <div class="composer-footer">
          <button class="icon-btn" id="composer-add-image" aria-label="Agregar imagen">
            ${icon("image", "regular")}
          </button>
          <label class="switch-row" id="composer-repost-row">
            <span>Permitir reposts</span>
            <input type="checkbox" id="composer-repostable" checked />
          </label>
        </div>

        <input type="file" id="composer-file-input" accept="image/*" multiple hidden />
      </div>
    </div>
  `;
}

function renderImagePreviews(container) {
  container.innerHTML = selectedFiles
    .map(
      (file, index) => `
        <div class="composer-image-preview">
          <img src="${URL.createObjectURL(file)}" alt="" />
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
  document.getElementById("composer-fab")?.classList.remove("open");
  selectedFiles = [];
  audience = null;
  anonymous = false;
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

  document.getElementById("composer-anon-row").hidden = !isVerified;
  document.getElementById("composer-note").hidden = !anonymous;
  document.getElementById("composer-repost-row").hidden = anonymous;
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
  const repostableEl = document.getElementById("composer-repostable");
  const publishBtn = document.getElementById("composer-publish");

  publishBtn.disabled = true;
  publishBtn.textContent = "Publicando...";

  try {
    const uploadedUrls = [];
    for (const file of selectedFiles) {
      const compressed = await compressImage(file);
      // Anonymous posts upload to a folder that doesn't carry the user id.
      const { url } = await uploadImage(compressed, { anonymous });
      uploadedUrls.push(url);
    }

    const text = textEl.value.trim();
    if (anonymous && extractHashtags(text).length > MAX_ANONYMOUS_TAGS) {
      throw new Error(`Usa como máximo ${MAX_ANONYMOUS_TAGS} hashtags`);
    }

    await createPost({
      text_content: text || undefined,
      image_url: uploadedUrls[0],
      image_url_2: uploadedUrls[1],
      is_repostable: anonymous ? false : repostableEl.checked,
      audience: audience && !anonymous ? { mode: audience.mode, user_ids: audience.ids } : undefined,
      anonymous: anonymous || undefined,
    });

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

  const textEl = document.getElementById("composer-text");
  const counterEl = document.getElementById("char-counter");
  const imagesContainer = document.getElementById("composer-images");
  const fileInput = document.getElementById("composer-file-input");

  const anonymousEl = document.getElementById("composer-anonymous");

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
      anonymousEl.checked = true;
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

  anonymousEl.addEventListener("change", () => {
    haptic();
    setAnonymous(anonymousEl.checked);
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
