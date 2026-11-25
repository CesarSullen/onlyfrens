import { createProfile, updateProfile } from "./api.js";
import { signOut } from "./auth.js";
import { avatarSrc, uploadAvatar } from "./avatar.js";
import { normalizePhone, PHONE_HINT } from "./contact.js";
import { icon } from "./icons.js";
import { cleanUsername, parseBirthday } from "./profile-view.js";
import { showToast, haptic, usernameError, displayNameError, showFieldError, escapeHTML } from "./utils.js";

// The optional details come after the profile exists, so a failure is reported but never blocks the entry.
async function saveOptional(save) {
  try {
    await save();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Phone accounts already have their number as the profile phone, so they are not asked for it.
export function renderCompleteProfileScreen(appEl, { displayName = "", phoneAccount = false }, onDone) {
  appEl.innerHTML = `
    <div class="auth-screen fade-in">
      <h1 class="auth-title">OnlyFrens</h1>
      <p class="auth-subtitle">Un último paso: elige cómo te verán tus amigos</p>

      <form id="complete-form" class="auth-form">
        <button type="button" class="profile-avatar-btn complete-avatar" id="complete-avatar-btn" aria-label="Elegir foto de perfil">
          <img class="profile-avatar" id="complete-avatar" src="${escapeHTML(avatarSrc())}" alt="" />
          <span class="avatar-edit-badge">${icon("camera", "fill")}</span>
        </button>
        <input type="file" id="complete-avatar-input" accept="image/*" hidden />
        <input type="text" id="complete-username" placeholder="Username (sin @)" required maxlength="20" autocomplete="off" autocapitalize="none" spellcheck="false" />
        <input type="text" id="complete-display-name" placeholder="Nombre a mostrar" required maxlength="50" autocomplete="name" value="${escapeHTML(displayName)}" />
        <input type="text" id="complete-birthday" placeholder="Cumpleaños, día/mes (opcional)" maxlength="7" autocomplete="off" />
        ${
          phoneAccount
            ? ""
            : `
        <input type="tel" id="complete-phone" placeholder="Teléfono con código de país (opcional)" autocomplete="tel" />
        <p class="auth-hint auth-phone-note">Si lo añades, tus amigos podrán escribirte por WhatsApp.</p>`
        }
        <button type="submit" class="primary-btn" id="complete-submit">Continuar</button>
      </form>

      <button class="text-btn auth-toggle" id="complete-other-account">Usar otra cuenta</button>
    </div>
  `;

  const avatarImg = document.getElementById("complete-avatar");
  const avatarInput = document.getElementById("complete-avatar-input");
  const usernameInput = document.getElementById("complete-username");
  let photo = null;

  // Until a photo is picked, the generated avatar follows the username.
  usernameInput.addEventListener("change", () => {
    if (photo) return;
    const username = cleanUsername(usernameInput.value);
    avatarImg.src = avatarSrc({ username: usernameError(username) ? "" : username });
  });

  document.getElementById("complete-avatar-btn").addEventListener("click", () => {
    haptic();
    avatarInput.click();
  });

  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files[0];
    if (!file) return;
    if (photo) URL.revokeObjectURL(avatarImg.src);
    photo = file;
    avatarImg.src = URL.createObjectURL(file);
  });

  document.getElementById("complete-other-account").addEventListener("click", () => {
    signOut();
    location.reload();
  });

  document.getElementById("complete-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("complete-display-name");
    const birthdayInput = document.getElementById("complete-birthday");
    const phoneInput = document.getElementById("complete-phone");
    const submitBtn = document.getElementById("complete-submit");

    const username = cleanUsername(usernameInput.value);
    const name = nameInput.value.trim();
    const birthdayText = birthdayInput.value.trim();
    const phoneText = phoneInput?.value.trim() ?? "";
    const birthday = birthdayText ? parseBirthday(birthdayText) : null;
    const phone = phoneText ? normalizePhone(phoneText) : null;

    const fieldError = usernameError(username)
      ? [usernameInput, usernameError(username)]
      : displayNameError(name)
        ? [nameInput, displayNameError(name)]
        : birthdayText && !birthday
          ? [birthdayInput, "Usa el formato día/mes, por ejemplo 15/5"]
          : phoneText && !phone
            ? [phoneInput, PHONE_HINT]
            : null;
    if (fieldError) {
      showFieldError(...fieldError);
      return;
    }

    submitBtn.disabled = true;

    try {
      await createProfile({ username, display_name: name });
    } catch (err) {
      showToast(err.message, "error");
      submitBtn.disabled = false;
      return;
    }

    if (birthday) {
      await saveOptional(() => updateProfile({ birthday_day: birthday.day, birthday_month: birthday.month }));
    }
    if (phone) await saveOptional(() => updateProfile({ phone }));
    if (photo) await saveOptional(() => uploadAvatar(photo));

    onDone();
  });
}
