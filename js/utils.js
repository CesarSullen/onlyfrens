import { icon } from "./icons.js";

const UNDO_MS = 5000;
const HAPTIC_PATTERNS = { light: [8], success: [8, 50, 14], error: [24, 40, 24] };
const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const phoneQuery = window.matchMedia("(max-width: 767px)");

function formatPostTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const time = date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayDiff = Math.round((startOfToday - startOfDate) / 86400000);

  if (dayDiff === 0) return `Hoy a las ${time}`;
  if (dayDiff === 1) return `Ayer a las ${time}`;
  return `${date.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} a las ${time}`;
}

function formatRelativeTime(isoString) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(isoString).getTime()) / 60000),
  );
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

function escapeHTML(text) {
  return String(text ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

// action: { label, onClick, onExpire } adds a button; onExpire runs only if the toast times out untouched.
function showToast(message, type = "success", duration = 3000, action = null) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const text = document.createElement("span");
  text.textContent = message;
  toast.append(text);

  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 250);
  };

  if (action) {
    toast.classList.add("has-action");
    const button = document.createElement("button");
    button.className = "toast-action";
    button.textContent = action.label;
    button.addEventListener(
      "click",
      () => {
        action.onClick();
        dismiss();
      },
      { once: true },
    );
    toast.append(button);
  }

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-visible"));
  if (type === "error" && navigator.userActivation?.isActive) haptic("error");

  timer = setTimeout(() => {
    dismiss();
    action?.onExpire?.();
  }, duration);
}

// Hides the item now and runs commit only after the undo window, or when the app goes to the background.
function undoable({ message, hide, restore, commit }) {
  hide();
  let settled = false;

  const flush = () => {
    if (settled) return;
    settled = true;
    document.removeEventListener("visibilitychange", onHidden);
    commit({ keepalive: document.visibilityState === "hidden" }).catch((err) => {
      restore();
      showToast(err.message, "error");
    });
  };

  function onHidden() {
    if (document.visibilityState === "hidden") flush();
  }

  document.addEventListener("visibilitychange", onHidden);
  showToast(message, "success", UNDO_MS, {
    label: "Deshacer",
    onClick: () => {
      settled = true;
      document.removeEventListener("visibilitychange", onHidden);
      restore();
    },
    onExpire: flush,
  });
}

const modalUI = document.getElementById("modal-ui");
const modalMessage = document.getElementById("modal-ui-message");
const modalActions = document.getElementById("modal-ui-actions");
let modalOpener = null;

function resetModal() {
  modalActions.className = "modal-ui-actions";
  modalActions.innerHTML = "";
  modalUI.querySelectorAll(".modal-ui-fields, .modal-ui-error").forEach((el) => el.remove());
}

function openModal({ sheet = false, focusEl = null } = {}) {
  modalOpener = document.activeElement;
  modalUI.classList.toggle("as-sheet", sheet);
  modalUI.classList.add("active");
  focusEl?.focus({ preventScroll: true });
}

// The content stays until the fade-out ends so the box doesn't collapse while it leaves.
function closeModalUI() {
  modalUI.classList.remove("active");
  setTimeout(() => {
    if (!modalUI.classList.contains("active")) resetModal();
  }, 300);
  if (modalOpener?.isConnected) modalOpener.focus({ preventScroll: true });
  modalOpener = null;
}

function modalButton(label, className, onClick) {
  const button = document.createElement("button");
  button.className = `modal-ui-btn ${className}`.trim();
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function showConfirm(message, onConfirm, destructive = false) {
  resetModal();
  modalMessage.textContent = message;

  const cancelButton = modalButton("Cancelar", "", closeModalUI);
  const confirmButton = modalButton("Confirmar", destructive ? "destructive" : "primary", () => {
    closeModalUI();
    onConfirm();
  });

  modalActions.append(cancelButton, confirmButton);
  openModal({ sheet: true, focusEl: destructive ? cancelButton : confirmButton });
}

// items: [{ label, onClick, destructive }]. Shown as a bottom sheet on phones.
function showActions(items) {
  resetModal();
  modalMessage.textContent = "";
  modalActions.classList.add("stacked");

  items.forEach(({ label, onClick, destructive }) => {
    modalActions.append(
      modalButton(label, destructive ? "destructive-text" : "", () => {
        closeModalUI();
        onClick();
      }),
    );
  });
  modalActions.append(modalButton("Cancelar", "cancel", closeModalUI));
  openModal({ sheet: true });
}

function showForm({ title, fields, validate, onConfirm }) {
  resetModal();
  modalMessage.textContent = title;

  const fieldsEl = document.createElement("div");
  fieldsEl.className = "modal-ui-fields";

  const inputs = fields.map((field) => {
    const label = document.createElement("label");
    label.className = "modal-ui-field";
    label.textContent = field.label;

    const input = document.createElement("input");
    input.type = field.type ?? "text";
    input.className = "modal-ui-input";
    input.placeholder = field.placeholder ?? "";
    input.value = field.value ?? "";
    input.autocomplete = field.autocomplete ?? "off";
    if (field.inputMode) input.inputMode = field.inputMode;
    if (field.maxLength) input.maxLength = field.maxLength;

    label.appendChild(input);
    fieldsEl.appendChild(label);
    return { name: field.name, input };
  });

  const errorEl = document.createElement("p");
  errorEl.className = "modal-ui-error";
  // The error sits outside the scrollable fields so it stays visible.
  modalActions.before(fieldsEl, errorEl);

  const confirmButton = modalButton("Guardar", "primary", () => {
    const values = Object.fromEntries(
      inputs.map(({ name, input }) => [name, input.value]),
    );
    const error = validate?.(values);
    if (error) {
      errorEl.textContent = error;
      return;
    }
    closeModalUI();
    onConfirm(values);
  });

  modalActions.append(modalButton("Cancelar", "", closeModalUI), confirmButton);
  openModal();
}

function showList(title, contentHTML) {
  resetModal();
  modalMessage.textContent = title;

  const listEl = document.createElement("div");
  listEl.className = "modal-ui-fields modal-ui-list";
  listEl.innerHTML = contentHTML;
  modalActions.before(listEl);

  modalActions.append(modalButton("Cerrar", "", closeModalUI));
  openModal();
  return listEl;
}

function shake(el) {
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
  el.addEventListener("animationend", () => el.classList.remove("shake"), { once: true });
}

function replay(el, className) {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  el.addEventListener("animationend", function done(e) {
    if (e.target !== el) return;
    el.classList.remove(className);
    el.removeEventListener("animationend", done);
  });
}

// Plays the exit animation first. Ids are dropped so a sheet opened meanwhile never matches the old one.
function closeSheet(overlay) {
  if (!overlay || overlay.classList.contains("closing")) return;
  overlay.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  overlay.removeAttribute("id");
  overlay.classList.add("closing");

  const remove = () => overlay.remove();
  overlay.addEventListener("animationend", (e) => {
    if (e.target === overlay) remove();
  });
  setTimeout(remove, 450);
}

// Shared shell of the full-screen sheets. Returns the pieces each sheet fills in.
function openSheet({ title, bodyHTML = "", footerHTML = "", footerClass = "", onClose }) {
  const opener = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", title);
  overlay.innerHTML = `
    <div class="sheet-header">
      <span class="sheet-title">${escapeHTML(title)}</span>
      <button class="icon-btn sheet-close" type="button" aria-label="Cerrar">${icon("x", "bold")}</button>
    </div>
    <div class="sheet-body">${bodyHTML}</div>
    ${footerHTML ? `<div class="sheet-footer ${footerClass}">${footerHTML}</div>` : ""}
  `;
  document.body.appendChild(overlay);

  let closed = false;
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    closeSheet(overlay);
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    onClose?.();
  }

  document.addEventListener("keydown", onKey);
  overlay.querySelector(".sheet-close").addEventListener("click", close);
  enableSheetDrag(overlay, close);

  return {
    overlay,
    body: overlay.querySelector(".sheet-body"),
    footer: overlay.querySelector(".sheet-footer"),
    close,
  };
}

// On phones the header can be dragged down to close the sheet; a quick flick closes it too.
function enableSheetDrag(overlay, onClose) {
  const header = overlay.querySelector(".sheet-header, .composer-header");
  if (!header) return;
  let startY = null;
  let offset = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;

  header.addEventListener("pointerdown", (e) => {
    if (!phoneQuery.matches || e.target.closest("button")) return;
    startY = lastY = e.clientY;
    lastTime = e.timeStamp;
    offset = 0;
    velocity = 0;
    header.setPointerCapture(e.pointerId);
  });

  header.addEventListener("pointermove", (e) => {
    if (startY === null) return;
    const elapsed = e.timeStamp - lastTime;
    if (elapsed > 0) velocity = (e.clientY - lastY) / elapsed;
    lastY = e.clientY;
    lastTime = e.timeStamp;
    offset = Math.max(0, e.clientY - startY);
    overlay.style.transform = `translateY(${offset}px)`;
  });

  function release() {
    if (startY === null) return;
    startY = null;

    if (offset > 120 || (velocity > 0.5 && offset > 24)) {
      onClose();
      return;
    }

    overlay.style.transition = "transform 0.3s cubic-bezier(0.3, 1.2, 0.5, 1)";
    overlay.style.transform = "";
    setTimeout(() => {
      overlay.style.transition = "";
    }, 300);
  }

  header.addEventListener("pointerup", release);
  header.addEventListener("pointercancel", release);
}

function profileFieldsError(username, displayName) {
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return "El username debe tener 3-20 caracteres: minúsculas, números o guion bajo";
  }
  if (!displayName || displayName.length > 50) {
    return "El nombre a mostrar debe tener entre 1 y 50 caracteres";
  }
  return null;
}

function iosTick() {
  const el = document.createElement("input");
  el.type = "checkbox";
  el.setAttribute("switch", "");
  el.className = "haptic-probe";
  document.body.appendChild(el);
  el.click();
  document.body.removeChild(el);
}

// kind: "light" for taps, "success" and "error" for the result of an action.
function haptic(kind = "light") {
  if (navigator.vibrate) {
    navigator.vibrate(HAPTIC_PATTERNS[kind]);
    return;
  }
  iosTick();
  if (kind !== "light") setTimeout(iosTick, 70);
}

// Alphabetical by the name people see, ignoring accents and case.
function sortByDisplayName(people) {
  return [...people].sort((a, b) =>
    a.display_name.localeCompare(b.display_name, "es", { sensitivity: "base" })
  );
}

function backBarHTML() {
  return `
    <div class="user-profile-bar">
      <button class="back-btn" id="back-btn" aria-label="Volver">${icon("caret-left", "regular")}</button>
    </div>`;
}

// title and text are trusted markup, never user input.
function emptyStateHTML(iconName, title, text, className = "") {
  return `
    <div class="empty-state ${className}">
      <div class="empty-state-icon">${icon(iconName, "regular")}</div>
      <p class="empty-state-title">${title}</p>
      <p class="empty-state-text">${text}</p>
    </div>`;
}

// variant: "padded" inside lists, "centered" under a list, "error" for failed loads.
function emptyLabelHTML(text, variant = "padded") {
  return `<p class="empty-label ${variant}">${text}</p>`;
}

export {
  sortByDisplayName,
  formatPostTime,
  formatRelativeTime,
  showToast,
  undoable,
  showConfirm,
  showActions,
  showForm,
  showList,
  escapeHTML,
  shake,
  replay,
  closeSheet,
  openSheet,
  enableSheetDrag,
  profileFieldsError,
  closeModalUI,
  haptic,
  backBarHTML,
  emptyStateHTML,
  emptyLabelHTML,
};
