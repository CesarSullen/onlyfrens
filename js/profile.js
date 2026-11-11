import { getProfile, updateProfile, getOwnPosts, uploadImage } from "./api.js";
import { showToast, showForm, showConfirm, haptic } from "./utils.js";
import { postCardHTML, attachPostCardListeners } from "./post-card.js";
import { signOut } from "./auth.js";
import { icon } from "./icons.js";
import { compressImage } from "./compress.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { loadWithCache, livePosts } from "./cache.js";

const PLACEHOLDER_AVATAR = "./assets/icons/avatar-placeholder.svg";
const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
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
  const currentBirthday =
    profile.birthday_day && profile.birthday_month
      ? `${profile.birthday_day}/${profile.birthday_month}`
      : "";

  showForm({
    title: "Editar perfil",
    fields: [
      {
        name: "name",
        label: "Nombre a mostrar",
        placeholder: "Tu nombre",
        value: profile.display_name,
      },
      {
        name: "bio",
        label: "Bio",
        placeholder: "Cuéntales algo sobre ti",
        value: profile.bio ?? "",
        maxLength: 160,
      },
      {
        name: "birthday",
        label: "Cumpleaños (día/mes)",
        placeholder: "15/5",
        value: currentBirthday,
      },
    ],
    validate: ({ birthday }) =>
      birthday.trim() && !parseBirthday(birthday)
        ? "Usa el formato día/mes, por ejemplo 15/5"
        : null,
    onConfirm: async ({ name, bio, birthday }) => {
      const updates = { bio: bio.trim() };

      if (name.trim()) updates.display_name = name.trim();

      if (birthday.trim()) {
        const { day, month } = parseBirthday(birthday);
        updates.birthday_day = day;
        updates.birthday_month = month;
      }

      try {
        await updateProfile(updates);
        showToast("Perfil actualizado");
        renderProfile(document.getElementById("app"));
      } catch (err) {
        showToast(err.message, "error");
      }
    },
  });
}

async function handleShareProfile(profile) {
  const url = `${location.origin}${location.pathname}#add=${profile.username}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: "OnlyFrens",
        text: "Agrégame en OnlyFrens",
        url,
      });
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
    await updateProfile({
      avatar_url: `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`,
    });
    showToast("Foto actualizada");
    renderProfile(document.getElementById("app"));
  } catch (err) {
    showToast(err.message, "error");
  }
}

function profileCardHTML(profile) {
  return `
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
  `;
}

function showProfile(cardEl, profile) {
  cardEl.innerHTML = profileCardHTML(profile);

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
}

function showOwnPosts(listEl, posts) {
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
}

export async function renderProfile(appEl) {
  appEl.innerHTML = `
    <div class="profile-screen fade-in" id="profile-card">${loaderHTML()}</div>
    <div id="own-posts">${loaderHTML()}</div>
    <button class="text-btn profile-logout" id="logout-btn">Cerrar sesión</button>
  `;

  const cardEl = document.getElementById("profile-card");
  const listEl = document.getElementById("own-posts");

  document.getElementById("logout-btn").addEventListener("click", () => {
    haptic();
    showConfirm(
      "¿Cerrar sesión?",
      () => {
        signOut();
        window.location.reload();
      },
      true,
    );
  });

  await Promise.all([
    loadWithCache("profile", getProfile, ({ profile }) => {
      if (cardEl.isConnected) showProfile(cardEl, profile);
    }).catch((err) => {
      removeLoader(cardEl);
      showToast(err.message, "error");
    }),
    loadWithCache(
      "ownPosts",
      getOwnPosts,
      ({ posts }, { cached }) => {
        if (listEl.isConnected)
          showOwnPosts(listEl, cached ? livePosts(posts) : posts);
      },
      30_000,
    ).catch((err) => {
      removeLoader(listEl);
      showToast(err.message, "error");
    }),
  ]);
}
