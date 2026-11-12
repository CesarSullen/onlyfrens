function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

function formatDateShort(isoString) {
  return new Date(isoString).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateWithTime(isoString) {
  return new Date(isoString).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeOnly(isoString) {
  return new Date(isoString).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

function showToast(message, type = "success", duration = 3000) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

const modalUI = document.getElementById("modal-ui");
const modalMessage = document.getElementById("modal-ui-message");
const modalInput = document.getElementById("modal-ui-input");
const modalActions = document.getElementById("modal-ui-actions");

function closeModalUI() {
  modalUI.classList.remove("active");
  modalInput.style.display = "none";
  modalActions.innerHTML = "";
  modalUI.querySelector(".modal-ui-fields")?.remove();
}

function showAlert(message, onClose) {
  modalMessage.textContent = message;
  modalActions.innerHTML = "";

  const okButton = document.createElement("button");
  okButton.className = "modal-ui-btn primary";
  okButton.textContent = "Entendido";
  okButton.addEventListener("click", () => {
    closeModalUI();
    if (onClose) onClose();
  });

  modalActions.appendChild(okButton);
  modalUI.classList.add("active");
}

function showConfirm(message, onConfirm, destructive = false) {
  modalMessage.textContent = message;
  modalActions.innerHTML = "";

  const cancelButton = document.createElement("button");
  cancelButton.className = "modal-ui-btn";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", closeModalUI);

  const confirmButton = document.createElement("button");
  confirmButton.className = `modal-ui-btn ${destructive ? "destructive" : "primary"}`;
  confirmButton.textContent = "Confirmar";
  confirmButton.addEventListener("click", () => {
    closeModalUI();
    onConfirm();
  });

  modalActions.appendChild(cancelButton);
  modalActions.appendChild(confirmButton);
  modalUI.classList.add("active");
}

function showPrompt(message, placeholder, onConfirm, defaultValue = "") {
  modalMessage.textContent = message;
  modalInput.style.display = "block";
  modalInput.placeholder = placeholder ?? "";
  modalInput.value = defaultValue;
  modalActions.innerHTML = "";

  const cancelButton = document.createElement("button");
  cancelButton.className = "modal-ui-btn";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", closeModalUI);

  const confirmButton = document.createElement("button");
  confirmButton.className = "modal-ui-btn primary";
  confirmButton.textContent = "Aceptar";
  confirmButton.addEventListener("click", () => {
    const value = modalInput.value;
    closeModalUI();
    onConfirm(value);
  });

  modalActions.appendChild(cancelButton);
  modalActions.appendChild(confirmButton);
  modalUI.classList.add("active");
}

function showForm({ title, fields, validate, onConfirm }) {
  modalMessage.textContent = title;
  modalActions.innerHTML = "";

  const fieldsEl = document.createElement("div");
  fieldsEl.className = "modal-ui-fields";

  const inputs = fields.map((field) => {
    const label = document.createElement("label");
    label.className = "modal-ui-field";
    label.textContent = field.label;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "modal-ui-input";
    input.placeholder = field.placeholder ?? "";
    input.value = field.value ?? "";
    input.autocomplete = "off";
    if (field.maxLength) input.maxLength = field.maxLength;

    label.appendChild(input);
    fieldsEl.appendChild(label);
    return { name: field.name, input };
  });

  const errorEl = document.createElement("p");
  errorEl.className = "modal-ui-error";
  fieldsEl.appendChild(errorEl);
  modalActions.before(fieldsEl);

  const cancelButton = document.createElement("button");
  cancelButton.className = "modal-ui-btn";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", closeModalUI);

  const confirmButton = document.createElement("button");
  confirmButton.className = "modal-ui-btn primary";
  confirmButton.textContent = "Guardar";
  confirmButton.addEventListener("click", () => {
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

  modalActions.appendChild(cancelButton);
  modalActions.appendChild(confirmButton);
  modalUI.classList.add("active");
}

function showList(title, contentHTML) {
  modalMessage.textContent = title;
  modalActions.innerHTML = "";

  const listEl = document.createElement("div");
  listEl.className = "modal-ui-fields modal-ui-list";
  listEl.innerHTML = contentHTML;
  modalActions.before(listEl);

  const closeButton = document.createElement("button");
  closeButton.className = "modal-ui-btn";
  closeButton.textContent = "Cerrar";
  closeButton.addEventListener("click", closeModalUI);
  modalActions.appendChild(closeButton);

  modalUI.classList.add("active");
  return listEl;
}

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function shake(el) {
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
  el.addEventListener("animationend", () => el.classList.remove("shake"), { once: true });
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

function haptic() {
  if (navigator.vibrate) {
    navigator.vibrate(8);
    return;
  }
  const el = document.createElement("input");
  el.type = "checkbox";
  el.setAttribute("switch", "");
  el.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
  document.body.appendChild(el);
  el.click();
  document.body.removeChild(el);
}

export {
  generateId,
  formatDateShort,
  formatDateWithTime,
  formatTimeOnly,
  formatPostTime,
  formatRelativeTime,
  showToast,
  showAlert,
  showConfirm,
  showPrompt,
  showForm,
  showList,
  escapeHTML,
  shake,
  profileFieldsError,
  closeModalUI,
  haptic,
};
