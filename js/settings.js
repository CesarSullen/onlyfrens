import { getRewards, getProfile, updateProfile, setAccountEmail } from "./api.js";
import { haptic, showToast, showForm, showConfirm, escapeHTML } from "./utils.js";
import { icon } from "./icons.js";
import { loaderHTML } from "./loader.js";
import { ACCENTS, getAccent, setAccent } from "./accents.js";
import { signOut, requestEmailChange, changePassword } from "./auth.js";
import { isEmail, normalizePhone, PHONE_HINT } from "./contact.js";
import { disablePush } from "./push.js";
import { cacheDelete } from "./cache.js";
import { API_BASE_URL } from "./config.js";

// The version is the one in the service worker cache name, so there is a single number to bump.
async function loadVersion(el) {
  try {
    const key = (await caches.keys()).find((name) => /^onlyfrens-v\d/.test(name));
    if (!key) return;
    el.textContent = `OnlyFrens ${key.replace("onlyfrens-", "")}`;
  } catch {
    // The line stays empty.
  }
}

const ABOUT_LINKS = [
  { label: "Acerca de la app", url: `${API_BASE_URL}/` },
  { label: "Política de privacidad", url: `${API_BASE_URL}/privacy` },
  { label: "Desarrollador", url: "https://cesarsullen.github.io/" },
  { label: "Más apps del desarrollador", url: "https://cesarsullen.github.io/links.html" },
];

function accentHTML(accent, index, selectedId, userCount) {
  const unlocked = userCount >= accent.users;
  const selected = accent.id === selectedId;
  const note = unlocked ? "" : `<span class="accent-note">${accent.users} usuarios</span>`;

  return `
    <li>
      <button class="accent-option tappable${selected ? " selected" : ""}${unlocked ? "" : " locked"}" data-id="${accent.id}" style="--i: ${index}" aria-pressed="${selected}">
        <span class="accent-swatch" data-accent="${accent.id}">${unlocked ? "" : icon("lock", "regular")}</span>
        <span class="accent-text">
          <span class="accent-name">${accent.name}</span>
          ${note}
        </span>
        ${selected ? `<span class="accent-check">${icon("check", "regular")}</span>` : ""}
      </button>
    </li>`;
}

function gridHTML(selectedId, userCount) {
  return ACCENTS.map((accent, i) => accentHTML(accent, i, selectedId, userCount)).join("");
}

// Moves the selection in place so the grid does not replay its entrance animation.
function markSelected(gridEl, id) {
  gridEl.querySelectorAll(".accent-option").forEach((option) => {
    const selected = option.dataset.id === id;
    option.classList.toggle("selected", selected);
    option.setAttribute("aria-pressed", selected);
    option.querySelector(".accent-check")?.remove();
    if (selected) option.insertAdjacentHTML("beforeend", `<span class="accent-check">${icon("check", "regular")}</span>`);
  });
}

function accountHTML(profile) {
  return `
    <button class="setting-row tappable" data-action="email">
      <span class="setting-label">Correo</span>
      <span class="setting-value">${escapeHTML(profile.email || "Añadir correo")}</span>
      ${icon("caret-right", "regular")}
    </button>
    <button class="setting-row tappable" data-action="phone">
      <span class="setting-label">Teléfono</span>
      <span class="setting-value">${escapeHTML(profile.phone || "Añadir teléfono")}</span>
      ${icon("caret-right", "regular")}
    </button>
    <button class="setting-row tappable" data-action="password">
      <span class="setting-label">Contraseña</span>
      <span class="setting-value">Cambiar contraseña</span>
      ${icon("caret-right", "regular")}
    </button>`;
}

function aboutHTML() {
  return ABOUT_LINKS.map(
    ({ label, url }) => `
    <a class="setting-row setting-link tappable" href="${url}" target="_blank" rel="noopener noreferrer">
      <span class="setting-label">${label}</span>
      ${icon("arrow-up-right", "regular")}
    </a>`,
  ).join("");
}

function changeEmail(profile, onDone) {
  // Phone accounts start with no real email, which the password recovery needs.
  const needsRecoveryEmail = !profile.email;

  showForm({
    title: needsRecoveryEmail ? "Añadir correo" : "Cambiar correo",
    fields: [
      {
        name: "email",
        label: "Correo",
        placeholder: needsRecoveryEmail ? "Añade un correo para recuperar tu contraseña" : "tu@correo.com",
        value: profile.email ?? "",
        type: "email",
        autocomplete: "email",
      },
    ],
    validate: ({ email }) => {
      if (!isEmail(email)) return "El correo no es válido";
      if (email.trim().toLowerCase() === (profile.email ?? "").toLowerCase()) return "Ese ya es tu correo";
      return null;
    },
    onConfirm: async ({ email }) => {
      const newEmail = email.trim().toLowerCase();

      try {
        if (needsRecoveryEmail) {
          await setAccountEmail(newEmail);
          showToast("Correo añadido. Ya puedes recuperar tu contraseña", "success", 5000);
        } else {
          await requestEmailChange(newEmail);
          showToast("Te enviamos un enlace para confirmar el nuevo correo", "success", 5000);
        }
        onDone();
      } catch (err) {
        showToast(err.message, "error");
      }
    },
  });
}

function changePhone(profile, onDone) {
  showForm({
    title: profile.phone ? "Cambiar teléfono" : "Añadir teléfono",
    fields: [
      {
        name: "phone",
        label: "Teléfono con código de país (vacío para quitarlo)",
        placeholder: "+34 600 000 000",
        value: profile.phone ?? "",
        type: "tel",
        autocomplete: "tel",
      },
    ],
    validate: ({ phone }) => (phone.trim() && !normalizePhone(phone) ? PHONE_HINT : null),
    onConfirm: async ({ phone }) => {
      const newPhone = phone.trim() ? normalizePhone(phone) : "";
      if (newPhone === (profile.phone ?? "")) return;

      try {
        await updateProfile({ phone: newPhone });
        showToast(newPhone ? "Teléfono actualizado" : "Teléfono quitado", "success", 5000);
        onDone();
      } catch (err) {
        showToast(err.message, "error");
      }
    },
  });
}

function changeOwnPassword() {
  showForm({
    title: "Cambiar contraseña",
    fields: [
      { name: "password", label: "Nueva contraseña", type: "password", autocomplete: "new-password" },
      { name: "confirm", label: "Repite la contraseña", type: "password", autocomplete: "new-password" },
    ],
    validate: ({ password, confirm }) => {
      if (password.length < 6) return "La contraseña debe tener al menos 6 caracteres";
      if (password !== confirm) return "Las contraseñas no coinciden";
      return null;
    },
    onConfirm: async ({ password }) => {
      try {
        await changePassword(password);
        showToast("Contraseña actualizada");
      } catch (err) {
        showToast(err.message, "error");
      }
    },
  });
}

function confirmSignOut() {
  showConfirm(
    "¿Cerrar sesión?",
    async () => {
      await disablePush();
      signOut();
      window.location.reload();
    },
    true,
  );
}

export async function renderSettings(appEl) {
  appEl.innerHTML = `
    <div class="user-profile-bar">
      <button class="back-btn" id="back-btn" aria-label="Volver">${icon("caret-left", "regular")}</button>
    </div>
    <div class="settings-page fade-in" id="settings-page">${loaderHTML()}</div>
  `;

  document.getElementById("back-btn").addEventListener("click", () => {
    haptic();
    history.back();
  });

  const pageEl = document.getElementById("settings-page");

  try {
    const [{ user_count }, { profile: loaded }] = await Promise.all([getRewards(), getProfile()]);
    if (!pageEl.isConnected) return;

    let profile = loaded;
    const userCount = user_count ?? 0;
    pageEl.innerHTML = `
      <h2 class="settings-title">Cuenta</h2>
      <div class="setting-list" id="account-list">${accountHTML(profile)}</div>
      <h2 class="settings-title settings-section">Color de la app</h2>
      <p class="settings-sub">Se guarda en este dispositivo. Los colores nuevos se desbloquean cuando crece la comunidad.</p>
      <ul class="accent-grid" id="accent-grid">${gridHTML(getAccent(), userCount)}</ul>
      <h2 class="settings-title settings-section">Acerca de</h2>
      <div class="setting-list">${aboutHTML()}</div>
      <button class="outline-btn danger large settings-logout" id="logout-btn">Cerrar sesión</button>
      <p class="settings-version" id="app-version"></p>
    `;

    loadVersion(document.getElementById("app-version"));

    const accountEl = document.getElementById("account-list");

    // Reloads the rows after a change; the profile card refetches the next time it opens.
    const refreshAccount = async () => {
      cacheDelete("profile");
      try {
        profile = (await getProfile()).profile;
        if (accountEl.isConnected) accountEl.innerHTML = accountHTML(profile);
      } catch {
        // The rows keep their last values.
      }
    };

    accountEl.addEventListener("click", (event) => {
      const row = event.target.closest(".setting-row");
      if (!row) return;
      haptic();

      if (row.dataset.action === "email") changeEmail(profile, refreshAccount);
      if (row.dataset.action === "phone") changePhone(profile, refreshAccount);
      if (row.dataset.action === "password") changeOwnPassword();
    });

    document.getElementById("logout-btn").addEventListener("click", () => {
      haptic();
      confirmSignOut();
    });

    const gridEl = document.getElementById("accent-grid");
    gridEl.addEventListener("click", (event) => {
      const option = event.target.closest(".accent-option");
      if (!option) return;

      const accent = ACCENTS.find((item) => item.id === option.dataset.id);
      haptic();

      if (userCount < accent.users) {
        showToast(`${accent.name} se desbloquea con ${accent.users} usuarios`);
        return;
      }

      setAccent(accent.id);
      markSelected(gridEl, accent.id);
    });
  } catch (err) {
    pageEl.innerHTML = `<p class="empty-label profile-error">${escapeHTML(err.message)}</p>`;
    showToast(err.message, "error");
  }
}
