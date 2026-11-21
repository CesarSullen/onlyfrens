import { icon } from "./icons.js";
import { haptic, showToast } from "./utils.js";

const CLOSE_DISTANCE = 100;

async function downloadImage(src) {
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error("download failed");
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `onlyfrens-${Date.now()}.${blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg"}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast("Foto descargada");
  } catch {
    showToast("No se pudo descargar la foto", "error");
  }
}

// Full-screen photo: tap or drag down to close. The download button only shows when it is allowed.
export function openImageViewer(src, { download = false } = {}) {
  const opener = document.activeElement;
  const viewer = document.createElement("div");
  viewer.className = "image-viewer";
  viewer.setAttribute("role", "dialog");
  viewer.setAttribute("aria-modal", "true");
  viewer.setAttribute("aria-label", "Imagen");

  const image = document.createElement("img");
  image.src = src;
  image.alt = "";
  image.draggable = false;

  const closeBtn = document.createElement("button");
  closeBtn.className = "icon-btn image-viewer-close";
  closeBtn.setAttribute("aria-label", "Cerrar");
  closeBtn.innerHTML = icon("x", "bold");

  viewer.append(image, closeBtn);

  if (download) {
    const downloadBtn = document.createElement("button");
    downloadBtn.className = "icon-btn image-viewer-download";
    downloadBtn.setAttribute("aria-label", "Descargar foto");
    downloadBtn.innerHTML = icon("download-simple", "regular");
    downloadBtn.addEventListener("click", () => {
      haptic();
      downloadImage(src);
    });
    viewer.append(downloadBtn);
  }
  document.body.append(viewer);
  closeBtn.focus({ preventScroll: true });

  let startY = null;
  let offset = 0;
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    viewer.classList.add("closing");
    setTimeout(() => viewer.remove(), 220);
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  function setOffset(value) {
    offset = value;
    image.style.transform = `translateY(${offset}px)`;
    viewer.style.setProperty("--fade", String(Math.max(0, 1 - offset / 320)));
  }

  document.addEventListener("keydown", onKey);
  closeBtn.addEventListener("click", close);

  image.addEventListener("pointerdown", (e) => {
    startY = e.clientY;
    image.setPointerCapture(e.pointerId);
  });

  image.addEventListener("pointermove", (e) => {
    if (startY !== null) setOffset(Math.max(0, e.clientY - startY));
  });

  function release() {
    if (startY === null) return;
    startY = null;
    if (offset > CLOSE_DISTANCE) {
      close();
      return;
    }
    const wasTap = offset < 6;
    image.classList.add("settling");
    setOffset(0);
    setTimeout(() => image.classList.remove("settling"), 250);
    if (wasTap) close();
  }

  image.addEventListener("pointerup", release);
  image.addEventListener("pointercancel", release);
  viewer.addEventListener("click", (e) => {
    if (e.target === viewer) close();
  });
}
