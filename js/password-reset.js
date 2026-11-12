import { requestPasswordReset, updatePassword } from "./auth.js";
import { passwordFieldHTML, setupPasswordToggle } from "./password-field.js";
import { showToast, shake, escapeHTML } from "./utils.js";
import { icon } from "./icons.js";

export function renderForgotScreen(appEl, onBack) {
  appEl.innerHTML = `
    <div class="auth-screen fade-in">
      <h1 class="auth-title">OnlyFrens</h1>
      <p class="auth-subtitle">Recupera tu contraseña</p>

      <div id="forgot-body">
        <form id="forgot-form" class="auth-form">
          <p class="auth-hint">Escribe tu email y te enviaremos un enlace para crear una contraseña nueva.</p>
          <input type="email" id="forgot-email" placeholder="Email" required autocomplete="email" />
          <button type="submit" class="primary-btn" id="forgot-submit">Enviar enlace</button>
        </form>
      </div>

      <button class="text-btn auth-toggle" id="forgot-back">Volver a iniciar sesión</button>
    </div>
  `;

  document.getElementById("forgot-back").addEventListener("click", onBack);

  document.getElementById("forgot-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("forgot-email").value.trim();
    const submitBtn = document.getElementById("forgot-submit");
    submitBtn.disabled = true;

    try {
      await requestPasswordReset(email);
      document.getElementById("forgot-body").innerHTML = `
        <div class="auth-success">
          <div class="auth-success-icon">${icon("paper-plane-right", "fill")}</div>
          <p class="auth-success-title">Revisa tu correo</p>
          <p class="auth-hint">Si hay una cuenta con ${escapeHTML(email)}, te enviamos un enlace. Revisa también la carpeta de spam.</p>
        </div>
      `;
    } catch (err) {
      showToast(err.message, "error");
      submitBtn.disabled = false;
    }
  });
}

export function renderResetScreen(appEl, session, onDone) {
  appEl.innerHTML = `
    <div class="auth-screen fade-in">
      <h1 class="auth-title">OnlyFrens</h1>
      <p class="auth-subtitle">Crea tu nueva contraseña</p>

      <form id="reset-form" class="auth-form">
        ${passwordFieldHTML({ id: "reset-password", placeholder: "Nueva contraseña", autocomplete: "new-password", withToggle: true })}
        ${passwordFieldHTML({ id: "reset-password-confirm", placeholder: "Repite la contraseña", autocomplete: "new-password", checkLength: false })}
        <button type="submit" class="primary-btn" id="reset-submit">Guardar contraseña</button>
      </form>
    </div>
  `;

  const form = document.getElementById("reset-form");
  setupPasswordToggle(form);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("reset-password").value;
    const confirmInput = document.getElementById("reset-password-confirm");
    const submitBtn = document.getElementById("reset-submit");

    if (password !== confirmInput.value) {
      showToast("Las contraseñas no coinciden", "error");
      shake(confirmInput);
      confirmInput.focus();
      return;
    }

    submitBtn.disabled = true;

    try {
      await updatePassword(session.access_token, password);
      showToast("Contraseña actualizada");
      onDone(session);
    } catch (err) {
      showToast(err.message, "error");
      submitBtn.disabled = false;
    }
  });
}
