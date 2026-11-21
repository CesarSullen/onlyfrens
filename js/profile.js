import { getProfile, updateProfile, getOwnPosts, uploadImage, setAccountEmail } from "./api.js";
import { showToast, showForm, showConfirm, haptic, profileFieldsError, emptyStateHTML, loadModule } from "./utils.js";
import { renderPosts } from "./post-card.js";
import { signOut, requestEmailChange } from "./auth.js";
import { isEmail, normalizePhone, PHONE_HINT } from "./contact.js";
import { disablePush } from "./push.js";
import { icon } from "./icons.js";
import { compressImage } from "./compress.js";
import { loaderHTML, removeLoader } from "./loader.js";
import { loadWithCache, livePosts } from "./cache.js";
import { bindRewardStrip } from "./rewards.js";
import {
  profileCardHTML,
  shareProfile,
  parseBirthday,
  cleanUsername,
  cleanHandle,
  socialsError,
} from "./profile-view.js";

// The email can be changed but not removed; the phone is optional. Both must look valid.
function contactError({ email, phone }, profile) {
  if (profile.email && !email.trim()) return "No puedes quitar tu correo, solo cambiarlo";
  if (email.trim() && !isEmail(email)) return "El correo no es válido";
  if (phone.trim() && !normalizePhone(phone)) return PHONE_HINT;
  return null;
}

function handleEditProfile(profile) {
  const currentBirthday =
    profile.birthday_day && profile.birthday_month
      ? `${profile.birthday_day}/${profile.birthday_month}`
      : "";
  // Phone accounts start with no real email, which the password recovery needs.
  const needsRecoveryEmail = !profile.email;

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
        name: "email",
        label: "Correo",
        placeholder: needsRecoveryEmail ? "Añade un correo para recuperar tu contraseña" : "tu@correo.com",
        value: profile.email ?? "",
        type: "email",
        autocomplete: "email",
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
    validate: ({ name, username, birthday, email, phone, instagram, x }) =>
      profileFieldsError(cleanUsername(username), name.trim() || profile.display_name) ||
      (birthday.trim() && !parseBirthday(birthday)
        ? "Usa el formato día/mes, por ejemplo 15/5"
        : null) ||
      contactError({ email, phone }, profile) ||
      socialsError({ instagram: cleanHandle(instagram), x_username: cleanHandle(x) }),
    onConfirm: async ({ name, username, bio, birthday, email, phone, instagram, x }) => {
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

      const newEmail = email.trim().toLowerCase();
      const emailChanged = newEmail && newEmail !== (profile.email ?? "").toLowerCase();

      try {
        await updateProfile(updates);
        if (emailChanged && needsRecoveryEmail) {
          await setAccountEmail(newEmail);
          showToast("Correo añadido. Ya puedes recuperar tu contraseña", "success", 5000);
        } else if (emailChanged) {
          await requestEmailChange(newEmail);
          showToast("Te enviamos un enlace para confirmar el nuevo correo", "success", 5000);
        } else if (updates.phone === "" && profile.phone) {
          showToast("Perfil actualizado. Ya no podrás entrar con ese teléfono", "success", 5000);
        } else {
          showToast("Perfil actualizado");
        }
        renderProfile(document.getElementById("app"));
      } catch (err) {
        showToast(err.message, "error");
      }
    },
  });
}

async function handleAvatarChange(file) {
  try {
    const compressed = await compressImage(file, 256);
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
}

const EMPTY_OWN_POSTS_HTML = emptyStateHTML(
  "package",
  "Aún no tienes publicaciones activas",
  "Aquí aparecerán tus publicaciones de las últimas 24 horas.",
  "",
  `<button class="text-btn primary" id="own-publish">Publicar algo</button>`,
);

function showOwnPosts(listEl, posts) {
  renderPosts(listEl, posts, EMPTY_OWN_POSTS_HTML);
}

export async function renderProfile(appEl) {
  appEl.innerHTML = `
    <div class="profile-screen fade-in" id="profile-card">${loaderHTML()}</div>
    <div class="feed-list" id="own-posts">${loaderHTML()}</div>
    <button class="outline-btn danger large profile-logout" id="logout-btn">Cerrar sesión</button>
  `;

  const cardEl = document.getElementById("profile-card");
  const listEl = document.getElementById("own-posts");

  listEl.addEventListener("click", (event) => {
    if (!event.target.closest("#own-publish")) return;
    haptic();
    loadModule(
      () => import("./composer.js"),
      ({ openComposer }) => openComposer(() => renderProfile(appEl)),
    );
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    haptic();
    showConfirm(
      "¿Cerrar sesión?",
      async () => {
        await disablePush();
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
