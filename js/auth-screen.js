import { signUp, signIn } from "./auth.js";
import { createProfile } from "./api.js";
import { showToast, haptic } from "./utils.js";

let mode = "login";

function authScreenHTML() {
  const isLogin = mode === "login";

  return `
    <div class="auth-screen fade-in">
      <h1 class="auth-title">OnlyFrens</h1>
      <p class="auth-subtitle">${isLogin ? "Inicia sesión" : "Crea tu cuenta"}</p>

      <form id="auth-form" class="auth-form">
        <input type="email" id="auth-email" placeholder="Email" required autocomplete="email" />
        <input type="password" id="auth-password" placeholder="Contraseña" required autocomplete="${isLogin ? "current-password" : "new-password"}" minlength="6" />
        ${
          isLogin
            ? ""
            : `
          <input type="text" id="auth-username" placeholder="Username (sin @)" required />
          <input type="text" id="auth-display-name" placeholder="Nombre a mostrar" required />
        `
        }
        <button type="submit" class="primary-btn" id="auth-submit">
          ${isLogin ? "Entrar" : "Registrarme"}
        </button>
      </form>

      <button class="text-btn auth-toggle" id="auth-toggle-mode">
        ${isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
      </button>
    </div>
  `;
}

async function handleSubmit(e, appEl, onAuthenticated) {
  e.preventDefault();

  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const submitBtn = document.getElementById("auth-submit");

  submitBtn.disabled = true;

  try {
    if (mode === "login") {
      await signIn(email, password);
    } else {
      const username = document.getElementById("auth-username").value
        .trim()
        .replace(/^@/, "")
        .toLowerCase();
      const displayName = document.getElementById("auth-display-name").value.trim();

      // Validate before touching Supabase Auth at all — once a signup
      // succeeds there, the account exists even if profile creation
      // fails next, leaving the person stuck until it's deleted by hand.
      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        showToast("El username debe tener 3-20 caracteres: minúsculas, números o guion bajo", "error");
        submitBtn.disabled = false;
        return;
      }

      if (!displayName || displayName.length > 50) {
        showToast("El nombre a mostrar debe tener entre 1 y 50 caracteres", "error");
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

  document.getElementById("auth-form").addEventListener("submit", (e) =>
    handleSubmit(e, appEl, onAuthenticated)
  );

  document.getElementById("auth-toggle-mode").addEventListener("click", () => {
    haptic();
    mode = mode === "login" ? "register" : "login";
    renderAuthScreen(appEl, onAuthenticated);
  });
}
