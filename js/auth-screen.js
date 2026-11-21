import { signUp, signIn, signUpWithPhone, signInWithPhone } from "./auth.js";
import { normalizePhone, PHONE_HINT } from "./contact.js";
import { createProfile } from "./api.js";
import { showToast, haptic, usernameError, displayNameError, showFieldError } from "./utils.js";
import { passwordFieldHTML, setupPasswordToggle } from "./password-field.js";
import { oauthButtonsHTML, setupOAuthButtons } from "./oauth.js";
import { renderForgotScreen } from "./password-reset.js";

let mode = "login";

// Anything without an @ is taken as a phone number.
function isPhoneIdentifier(value) {
  return !value.includes("@");
}

function authScreenHTML() {
  const isLogin = mode === "login";

  return `
    <div class="auth-screen fade-in">
      <h1 class="auth-title">OnlyFrens</h1>
      <p class="auth-subtitle">${isLogin ? "Inicia sesión" : "Crea tu cuenta"}</p>

      <form id="auth-form" class="auth-form">
        <input type="text" id="auth-identifier" placeholder="Email o teléfono (+34 600 000 000)" required autocomplete="username" autocapitalize="none" spellcheck="false" />
        ${passwordFieldHTML({ id: "auth-password", placeholder: "Contraseña", autocomplete: isLogin ? "current-password" : "new-password", withToggle: true })}
        ${
          isLogin
            ? `<button type="button" class="text-btn forgot-link" id="auth-forgot">¿Olvidaste tu contraseña?</button>`
            : `
          ${passwordFieldHTML({ id: "auth-password-confirm", placeholder: "Repite la contraseña", autocomplete: "new-password", checkLength: false })}
          <input type="text" id="auth-username" placeholder="Username (sin @)" required maxlength="20" autocapitalize="none" autocomplete="nickname" spellcheck="false" />
          <input type="text" id="auth-display-name" placeholder="Nombre a mostrar" required maxlength="50" autocomplete="name" />
          <p class="auth-hint auth-phone-note" id="auth-phone-note" hidden>Tu número se mostrará en tu perfil a tus amigos para que puedan escribirte. Para recuperar la contraseña tendrás que añadir un correo en tu perfil.</p>
        `
        }
        <button type="submit" class="primary-btn" id="auth-submit">
          ${isLogin ? "Entrar" : "Registrarme"}
        </button>
      </form>

      ${oauthButtonsHTML()}

      <button class="text-btn auth-toggle" id="auth-toggle-mode">
        ${isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
      </button>
    </div>
  `;
}

async function handleSubmit(e, onAuthenticated) {
  e.preventDefault();

  const identifierInput = document.getElementById("auth-identifier");
  const isPhone = isPhoneIdentifier(identifierInput.value);
  const password = document.getElementById("auth-password").value;
  const submitBtn = document.getElementById("auth-submit");

  const identifier = isPhone ? normalizePhone(identifierInput.value) : identifierInput.value.trim().toLowerCase();
  if (isPhone && !identifier) {
    showFieldError(identifierInput, PHONE_HINT);
    return;
  }

  submitBtn.disabled = true;
  let askForEmail = false;

  try {
    if (mode === "login") {
      await (isPhone ? signInWithPhone(identifier, password) : signIn(identifier, password));
    } else {
      const confirmInput = document.getElementById("auth-password-confirm");
      if (password !== confirmInput.value) {
        showFieldError(confirmInput, "Las contraseñas no coinciden");
        submitBtn.disabled = false;
        return;
      }

      const usernameInput = document.getElementById("auth-username");
      const displayNameInput = document.getElementById("auth-display-name");
      const username = usernameInput.value.trim().replace(/^@/, "").toLowerCase();
      const displayName = displayNameInput.value.trim();

      const fieldError = usernameError(username)
        ? [usernameInput, usernameError(username)]
        : displayNameError(displayName)
          ? [displayNameInput, displayNameError(displayName)]
          : null;
      if (fieldError) {
        showFieldError(...fieldError);
        submitBtn.disabled = false;
        return;
      }

      if (isPhone) {
        await signUpWithPhone(identifier, password);
        askForEmail = true;
      } else {
        const result = await signUp(identifier, password);

        if (result.needsConfirmation) {
          showToast("Revisa tu email para confirmar la cuenta");
          submitBtn.disabled = false;
          return;
        }
      }

      await createProfile({ username, display_name: displayName });
    }

    onAuthenticated();

    if (askForEmail) {
      showToast("Añade un correo en tu perfil para poder recuperar tu contraseña", "success", 8000, {
        label: "Añadir",
        onClick: () => document.querySelector('.nav-item[data-screen="profile"]')?.click(),
      });
    }
  } catch (err) {
    showToast(err.message, "error");
    submitBtn.disabled = false;
  }
}

export function renderAuthScreen(appEl, onAuthenticated) {
  appEl.innerHTML = authScreenHTML();

  const form = document.getElementById("auth-form");
  form.addEventListener("submit", (e) => handleSubmit(e, onAuthenticated));

  setupPasswordToggle(form);
  setupOAuthButtons(appEl);

  // The phone notice only shows while the field holds something that is not an email.
  const identifierInput = document.getElementById("auth-identifier");
  const phoneNote = document.getElementById("auth-phone-note");
  identifierInput.addEventListener("input", () => {
    if (phoneNote) phoneNote.hidden = !identifierInput.value.trim() || !isPhoneIdentifier(identifierInput.value);
  });

  document.getElementById("auth-forgot")?.addEventListener("click", () => {
    haptic();
    renderForgotScreen(appEl, () => renderAuthScreen(appEl, onAuthenticated));
  });

  document.getElementById("auth-toggle-mode").addEventListener("click", () => {
    haptic();
    mode = mode === "login" ? "register" : "login";
    renderAuthScreen(appEl, onAuthenticated);
  });
}
