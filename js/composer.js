import { createPost, uploadImage } from "./api.js";
import { showToast, haptic } from "./utils.js";
import { compressImage } from "./compress.js";
import { icon } from "./icons.js";

const MAX_TEXT_LENGTH = 500;
const MAX_IMAGES = 2;

let selectedFiles = [];
let onPublishedCallback = null;

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

        <div class="composer-footer">
          <button class="icon-btn" id="composer-add-image" aria-label="Agregar imagen">
            ${icon("image", "regular")}
          </button>
          <label class="switch-row">
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
  const hasContent = textEl.value.trim().length > 0 || selectedFiles.length > 0;
  publishBtn.disabled = !hasContent;
}

function closeComposer() {
  const overlay = document.getElementById("composer-overlay");
  if (overlay) overlay.remove();
  selectedFiles = [];
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
      const { url } = await uploadImage(compressed);
      uploadedUrls.push(url);
    }

    await createPost({
      text_content: textEl.value.trim() || undefined,
      image_url: uploadedUrls[0],
      image_url_2: uploadedUrls[1],
      is_repostable: repostableEl.checked,
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

export function openComposer(onPublished) {
  onPublishedCallback = onPublished;
  selectedFiles = [];

  document.body.insertAdjacentHTML("beforeend", composerHTML());

  const textEl = document.getElementById("composer-text");
  const counterEl = document.getElementById("char-counter");
  const imagesContainer = document.getElementById("composer-images");
  const fileInput = document.getElementById("composer-file-input");

  textEl.addEventListener("input", () => {
    counterEl.textContent = `${textEl.value.length}/${MAX_TEXT_LENGTH}`;
    updatePublishState();
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

  document.getElementById("composer-cancel").addEventListener("click", () => {
    haptic();
    closeComposer();
  });

  document.getElementById("composer-publish").addEventListener("click", () => {
    haptic();
    handlePublish();
  });
}
