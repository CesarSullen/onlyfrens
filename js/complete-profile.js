import { createProfile } from "./api.js";
import { signOut } from "./auth.js";
import { showToast, profileFieldsError, escapeHTML } from "./utils.js";

export function renderCompleteProfileScreen(appEl, { displayName = "" }, onDone) {
  appEl.innerHTML = `
    <div class="auth-screen fade-in">
      <h1 class="auth-title">OnlyFrens</h1>
      <p class="auth-subtitle">Un último paso: elige cómo te verán tus amigos</p>

      <form id="complete-form" class="auth-form">
        <input type="text" id="complete-username" placeholder="Username (sin @)" required autocomplete="off" autocapitalize="none" />
        <input type="text" id="complete-display-name" placeholder="Nombre a mostrar" required maxlength="50" value="${escapeHTML(displayName)}" />
        <button type="submit" class="primary-btn" id="complete-submit">Continuar</button>
      </form>

      <button class="text-btn auth-toggle" id="complete-other-account">Usar otra cuenta</button>
    </div>
  `;

  document.getElementById("complete-other-account").addEventListener("click", () => {
    signOut();
    location.reload();
  });

  document.getElementById("complete-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("complete-username").value.trim().replace(/^@/, "").toLowerCase();
    const name = document.getElementById("complete-display-name").value.trim();
    const submitBtn = document.getElementById("complete-submit");

    const error = profileFieldsError(username, name);
    if (error) {
      showToast(error, "error");
      return;
    }

    submitBtn.disabled = true;

    try {
      await createProfile({ username, display_name: name });
      onDone();
    } catch (err) {
      showToast(err.message, "error");
      submitBtn.disabled = false;
    }
  });
}
