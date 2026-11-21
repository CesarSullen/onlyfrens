import { icon } from "./icons.js";

const CLOSE_DISTANCE = 100;

// Full-screen photo: tap or drag down to close.
export function openImageViewer(src) {
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
