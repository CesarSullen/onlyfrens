import { icon } from "./icons.js";
import { haptic } from "./utils.js";

export function passwordFieldHTML({ id, placeholder, autocomplete, withToggle = false, checkLength = true }) {
  return `
    <div class="password-field">
      <input type="password" id="${id}" placeholder="${placeholder}" required autocomplete="${autocomplete}"${checkLength ? ' minlength="6"' : ""} />
      ${
        withToggle
          ? `<button type="button" class="password-toggle" aria-label="Mostrar contraseña" aria-pressed="false">
              ${icon("eye", "regular", "icon-show")}${icon("eye-slash", "regular", "icon-hide")}
            </button>`
          : ""
      }
    </div>
  `;
}

export function setupPasswordToggle(formEl) {
  const toggle = formEl.querySelector(".password-toggle");
  if (!toggle) return;

  // Keeps the keyboard open when tapping the eye.
  toggle.addEventListener("pointerdown", (e) => e.preventDefault());

  toggle.addEventListener("click", () => {
    haptic();
    const show = toggle.getAttribute("aria-pressed") !== "true";
    toggle.setAttribute("aria-pressed", String(show));
    toggle.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
    formEl.querySelectorAll(".password-field input").forEach((input) => {
      input.type = show ? "text" : "password";
    });
  });
}
