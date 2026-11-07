import { getProfile, updateProfile, getOwnPosts, uploadImage } from "./api.js";
import { showToast, showPrompt, showConfirm, haptic } from "./utils.js";
import { postCardHTML, attachPostCardListeners } from "./post-card.js";
import { signOut } from "./auth.js";
import { icon } from "./icons.js";
import { compressImage } from "./compress.js";

const PLACEHOLDER_AVATAR = "./assets/icons/avatar-placeholder.svg";
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatBirthday(day, month) {
  if (!day || !month) return "Sin definir";
  return `${day} de ${MONTH_NAMES[month - 1]}`;
}

function parseBirthday(value) {
  const match = value.trim().match(/^(\d{1,2})\s*[\/\-]\s*(\d{1,2})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  return { day, month };
}

function handleEditProfile(profile) {
  showPrompt("Nombre a mostrar", "Tu nombre", (nameValue) => {
    showPrompt("Bio (máx. 160 caracteres)", "Cuéntales algo sobre ti", (bioValue) => {
      const currentBirthday =
        profile.birthday_day && profile.birthday_month
          ? `${profile.birthday_day}/${profile.birthday_month}`
          : "";

      showPrompt("Cumpleaños (día/mes, ej. 15/5)", "15/5", async (birthdayValue) => {
        const updates = {};

        if (nameValue.trim()) updates.display_name = nameValue.trim();
        updates.bio = bioValue.trim();

        if (birthdayValue.trim()) {
          const birthday = parseBirthday(birthdayValue);
          if (!birthday) {
            showToast("Usa el formato día/mes, por ejemplo 15/5", "error");
            return;
          }
          updates.birthday_day = birthday.day;
          updates.birthday_month = birthday.month;
        }

        try {
          await updateProfile(updates);
          showToast("Perfil actualizado");
          renderProfile(document.getElementById("app"));
        } catch (err) {
          showToast(err.message, "error");
        }
      }, currentBirthday);
    }, profile.bio ?? "");
  }, profile.display_name);
}

async function handleShareProfile(profile) {
  const url = `${location.origin}${location.pathname}#add=${profile.username}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: "OnlyFrens", text: "Agrégame en OnlyFrens", url });
    } catch {
      return;
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    showToast("Enlace copiado");
  } catch {
    showToast("No se pudo copiar el enlace", "error");
  }
}

async function handleAvatarChange(file) {
  try {
    const compressed = await compressImage(file, 512);
    const { url } = await uploadImage(compressed);
    await updateProfile({ avatar_url: url });
    showToast("Foto actualizada");
    renderProfile(document.getElementById("app"));
  } catch (err) {
    showToast(err.message, "error");
  }
}


async function loadOwnPosts() {
  const listEl = document.getElementById("own-posts");

  try {
    const { posts } = await getOwnPosts();

    if (posts.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${icon("package", "regular")}</div>
          <p class="empty-state-title">Aún no tienes publicaciones activas</p>
          <p class="empty-state-text">Aquí aparecerán tus publicaciones de las últimas 24 horas.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = `<div class="feed-list">${posts.map(postCardHTML).join("")}</div>`;
    attachPostCardListeners(listEl);
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function renderProfile(appEl) {
  appEl.innerHTML = `<div class="profile-screen fade-in"></div>`;

  try {
    const { profile } = await getProfile();

    appEl.innerHTML = `
      <div class="profile-screen fade-in">
        <div class="profile-top">
          <button class="profile-avatar-btn" id="avatar-btn" aria-label="Cambiar foto de perfil">
            <img class="profile-avatar" src="${profile.avatar_url || PLACEHOLDER_AVATAR}" alt="" />
            <span class="avatar-edit-badge">${icon("camera", "fill")}</span>
          </button>
          <input type="file" id="avatar-input" accept="image/*" hidden />
          <div>
            <h1 class="profile-name">${escapeHTML(profile.display_name)}</h1>
            <p class="profile-username">@${escapeHTML(profile.username)}</p>
          </div>
        </div>
        ${profile.bio ? `<p class="profile-bio post-text">${escapeHTML(profile.bio)}</p>` : ""}
        <p class="profile-birthday">${icon("cake", "fill")}Cumpleaños: ${formatBirthday(profile.birthday_day, profile.birthday_month)}</p>
        <div class="profile-actions">
          <button class="outline-btn large" id="edit-profile-btn">Editar perfil</button>
          <button class="outline-btn large" id="share-profile-btn">Compartir perfil</button>
        </div>
        <div class="profile-divider"></div>
      </div>
      <div id="own-posts"></div>
      <button class="text-btn profile-logout" id="logout-btn">Cerrar sesión</button>
    `;

    const avatarInput = document.getElementById("avatar-input");
    document.getElementById("avatar-btn").addEventListener("click", () => {
      haptic();
      avatarInput.click();
    });
    avatarInput.addEventListener("change", () => {
      if (avatarInput.files[0]) handleAvatarChange(avatarInput.files[0]);
    });

    document.getElementById("edit-profile-btn").addEventListener("click", () => {
      haptic();
      handleEditProfile(profile);
    });

    document.getElementById("share-profile-btn").addEventListener("click", () => {
      haptic();
      handleShareProfile(profile);
    });

    document.getElementById("logout-btn").addEventListener("click", () => {
      haptic();
      showConfirm("¿Cerrar sesión?", () => {
        signOut();
        window.location.reload();
      }, true);
    });

    loadOwnPosts();
  } catch (err) {
    showToast(err.message, "error");
  }
}
