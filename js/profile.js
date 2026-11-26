import { getProfile, updateProfile, getOwnPosts } from "./api.js";
import { showToast, showForm, haptic, profileFieldsError, emptyStateHTML, loadModule } from "./utils.js";
import { renderPosts } from "./post-card.js";
import { normalizePhone, PHONE_HINT } from "./contact.js";
import { icon } from "./icons.js";
import { uploadAvatar } from "./avatar.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { loadWithCache, livePosts } from "./cache.js";
import { bindRewardStrip } from "./rewards.js";
import { openSettings } from "./navigation.js";
import {
  profileCardHTML,
  shareProfile,
  parseBirthday,
  cleanUsername,
  cleanHandle,
  socialsError,
} from "./profile-view.js";

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
        name: "username",
        label: "Username",
        placeholder: "tu_username",
        value: profile.username,
        maxLength: 20,
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
      {
        name: "phone",
        label: "Teléfono para que te escriban (con código de país)",
        placeholder: "+34 600 000 000",
        value: profile.phone ?? "",
        type: "tel",
        autocomplete: "tel",
      },
      {
        name: "instagram",
        label: "Instagram (usuario)",
        placeholder: "tu_usuario",
        value: profile.instagram ?? "",
      },
      {
        name: "x",
        label: "X (usuario)",
        placeholder: "tu_usuario",
        value: profile.x_username ?? "",
      },
    ],
    validate: ({ name, username, birthday, phone, instagram, x }) =>
      profileFieldsError(cleanUsername(username), name.trim() || profile.display_name) ||
      (birthday.trim() && !parseBirthday(birthday)
        ? "Usa el formato día/mes, por ejemplo 15/5"
        : null) ||
      (phone.trim() && !normalizePhone(phone) ? PHONE_HINT : null) ||
      socialsError({ instagram: cleanHandle(instagram), x_username: cleanHandle(x) }),
    onConfirm: async ({ name, username, bio, birthday, phone, instagram, x }) => {
      const updates = { bio: bio.trim() };

      if (name.trim()) updates.display_name = name.trim();

      const newUsername = cleanUsername(username);
      if (newUsername !== profile.username) updates.username = newUsername;

      if (birthday.trim()) {
        const { day, month } = parseBirthday(birthday);
        updates.birthday_day = day;
        updates.birthday_month = month;
      }

      const handles = { instagram: cleanHandle(instagram), x_username: cleanHandle(x) };
      Object.entries(handles).forEach(([field, handle]) => {
        if (handle !== (profile[field] ?? "")) updates[field] = handle;
      });

      // An empty value removes the phone.
      const newPhone = phone.trim() ? normalizePhone(phone) : "";
      if (newPhone !== (profile.phone ?? "")) updates.phone = newPhone;

      try {
        await updateProfile(updates);
        if (updates.phone === "" && profile.phone) {
          showToast("Perfil actualizado. Ya no podrás entrar con ese teléfono", "success", 5000);
        } else {
          showToast("Perfil actualizado");
        }
        reloadProfile();
      } catch (err) {
        showToast(err.message, "error");
      }
    },
  });
}

async function handleAvatarChange(file) {
  try {
    await uploadAvatar(file);
    showToast("Foto actualizada");
    reloadProfile();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function showProfile(cardEl, profile) {
  cardEl.innerHTML = profileCardHTML(profile, {
    avatarEditable: true,
    actionsHTML: `
      <button class="outline-btn large" id="edit-profile-btn">Editar</button>
      <button class="outline-btn large" id="share-profile-btn">Compartir</button>`,
    topActionHTML: `<button class="settings-btn" id="settings-btn" aria-label="Ajustes">${icon("gear-six", "regular")}</button>`,
  });

  bindRewardStrip();

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
    shareProfile(profile);
  });

  document.getElementById("settings-btn").addEventListener("click", () => {
    haptic();
    openSettings();
  });
}

const EMPTY_OWN_POSTS_HTML = emptyStateHTML(
  "package",
  "Aún no tienes publicaciones activas",
  "Aquí aparecerán tus publicaciones mientras estén activas.",
  "",
  `<button class="text-btn primary" id="own-publish">Publicar algo</button>`,
);

function showOwnPosts(listEl, posts) {
  renderPosts(listEl, posts, EMPTY_OWN_POSTS_HTML);
}

function loadCard(cardEl) {
  return loadWithCache("profile", getProfile, ({ profile }) => {
    if (cardEl.isConnected) showProfile(cardEl, profile);
  });
}

function loadOwnPosts(listEl) {
  return loadWithCache(
    "ownPosts",
    getOwnPosts,
    ({ posts }, { cached }) => {
      if (listEl.isConnected) showOwnPosts(listEl, cached ? livePosts(posts) : posts);
    },
    30_000,
  );
}

// Refreshes the card and the list in place, so the scroll and the rest of the screen stay as they are.
function reloadProfile() {
  const cardEl = document.getElementById("profile-card");
  const listEl = document.getElementById("own-posts");
  if (cardEl) loadCard(cardEl).catch((err) => showToast(err.message, "error"));
  if (listEl) loadOwnPosts(listEl).catch((err) => showToast(err.message, "error"));
}

function reloadOwnPosts() {
  const listEl = document.getElementById("own-posts");
  if (listEl) loadOwnPosts(listEl).catch((err) => showToast(err.message, "error"));
}

export async function renderProfile(appEl) {
  appEl.innerHTML = `
    <div class="profile-screen fade-in" id="profile-card">${loaderHTML()}</div>
    <div class="feed-list" id="own-posts">${loaderHTML()}</div>
  `;

  const cardEl = document.getElementById("profile-card");
  const listEl = document.getElementById("own-posts");

  listEl.addEventListener("click", (event) => {
    if (!event.target.closest("#own-publish")) return;
    haptic();
    loadModule(
      () => import("./composer.js"),
      ({ openComposer }) => openComposer(reloadOwnPosts),
    );
  });

  await Promise.all([
    loadCard(cardEl).catch((err) => {
      removeLoader(cardEl);
      showToast(err.message, "error");
    }),
    loadOwnPosts(listEl).catch((err) => {
      removeLoader(listEl);
      showToast(err.message, "error");
    }),
  ]);
}
