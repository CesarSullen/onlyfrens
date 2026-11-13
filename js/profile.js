import { getProfile, updateProfile, getOwnPosts, uploadImage } from "./api.js";
import { showToast, showForm, showConfirm, haptic, profileFieldsError } from "./utils.js";
import { postCardHTML, attachPostCardListeners } from "./post-card.js";
import { signOut } from "./auth.js";
import { icon } from "./icons.js";
import { compressImage } from "./compress.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { loadWithCache, livePosts } from "./cache.js";
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
    validate: ({ name, username, birthday, instagram, x }) =>
      profileFieldsError(cleanUsername(username), name.trim() || profile.display_name) ||
      (birthday.trim() && !parseBirthday(birthday)
        ? "Usa el formato día/mes, por ejemplo 15/5"
        : null) ||
      socialsError({ instagram: cleanHandle(instagram), x_username: cleanHandle(x) }),
    onConfirm: async ({ name, username, bio, birthday, instagram, x }) => {
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

function showProfile(cardEl, profile) {
  cardEl.innerHTML = profileCardHTML(profile, {
    avatarEditable: true,
    actionsHTML: `
      <button class="outline-btn large" id="edit-profile-btn">Editar</button>
      <button class="outline-btn large" id="share-profile-btn">Compartir</button>`,
  });

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
    <button class="outline-btn danger large profile-logout" id="logout-btn">Cerrar sesión</button>
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
        if (listEl.isConnected) showOwnPosts(listEl, cached ? livePosts(posts) : posts);
      },
      30_000,
    ).catch((err) => {
      removeLoader(listEl);
      showToast(err.message, "error");
    }),
  ]);
}
