import { signUp, signIn } from "./auth.js";
import { createProfile } from "./api.js";
import { showToast, haptic, shake, profileFieldsError } from "./utils.js";
import { passwordFieldHTML, setupPasswordToggle } from "./password-field.js";
import { oauthButtonsHTML, setupOAuthButtons } from "./oauth.js";
import { renderForgotScreen } from "./password-reset.js";

let mode = "login";

function authScreenHTML() {
  const isLogin = mode === "login";

  return `
    <div class="auth-screen fade-in">
      <h1 class="auth-title">OnlyFrens</h1>
      <p class="auth-subtitle">${isLogin ? "Inicia sesión" : "Crea tu cuenta"}</p>

      <form id="auth-form" class="auth-form">
        <input type="email" id="auth-email" placeholder="Email" required autocomplete="email" />
        ${passwordFieldHTML({ id: "auth-password", placeholder: "Contraseña", autocomplete: isLogin ? "current-password" : "new-password", withToggle: true })}
        ${
          isLogin
            ? `<button type="button" class="text-btn forgot-link" id="auth-forgot">¿Olvidaste tu contraseña?</button>`
            : `
          ${passwordFieldHTML({ id: "auth-password-confirm", placeholder: "Repite la contraseña", autocomplete: "new-password", checkLength: false })}
          <input type="text" id="auth-username" placeholder="Username (sin @)" required />
          <input type="text" id="auth-display-name" placeholder="Nombre a mostrar" required />
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

  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const submitBtn = document.getElementById("auth-submit");

  submitBtn.disabled = true;

  try {
    if (mode === "login") {
      await signIn(email, password);
    } else {
      const confirmInput = document.getElementById("auth-password-confirm");
      if (password !== confirmInput.value) {
        showToast("Las contraseñas no coinciden", "error");
        shake(confirmInput);
        confirmInput.focus();
        submitBtn.disabled = false;
        return;
      }

      const username = document
        .getElementById("auth-username")
        .value.trim()
        .replace(/^@/, "")
        .toLowerCase();
      const displayName = document.getElementById("auth-display-name").value.trim();

      const fieldsError = profileFieldsError(username, displayName);
      if (fieldsError) {
        showToast(fieldsError, "error");
        submitBtn.disabled = false;
        return;
      }

      const result = await signUp(email, password);

      if (result.needsConfirmation) {
        showToast("Revisa tu email para confirmar la cuenta");
        submitBtn.disabled = false;
        return;
      }

      await createProfile({ username, display_name: displayName });
    }

    onAuthenticated();
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
