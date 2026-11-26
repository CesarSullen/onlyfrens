import { haptic, openSheet, showToast } from "./utils.js";
import { icon } from "./icons.js";
import { POST_LIFETIMES, maxLifetimeFor } from "./tiers.js";

const UNLOCK_HINTS = {
  48: "Con el nivel topacio (25 amigos) tus publicaciones pueden durar 48 h",
  72: "Con el nivel amatista (50 amigos) tus publicaciones pueden durar 72 h",
};

export function lifetimeLabel(hours) {
  return `${hours} h`;
}

// Tells a locked chip what unlocks the next duration.
export function showLifetimeHint(tier) {
  showToast(UNLOCK_HINTS[maxLifetimeFor(tier) === 24 ? 48 : 72]);
}

// current: hours chosen so far. onDone receives the new number of hours.
export function openDurationPicker({ tier, current, onDone }) {
  let hours = current;
  const allowed = maxLifetimeFor(tier);

  const { overlay, body, footer, close } = openSheet({
    title: "Duración",
    bodyHTML: `
      <div class="segmented">
        ${POST_LIFETIMES.map((value) => {
          const locked = value > allowed;
          return `<button class="segment" data-hours="${value}">${icon(locked ? "lock" : "clock", "regular")}${lifetimeLabel(value)}</button>`;
        }).join("")}
      </div>
      <p class="sheet-note">Pasado ese tiempo la publicación se borra sola. Las compartidas duran siempre 24 h.</p>`,
    footerHTML: `<button class="solid-btn large" data-role="done">Listo</button>`,
    footerClass: "audience-footer",
  });

  const segments = [...body.querySelectorAll(".segment")];

  function refresh() {
    segments.forEach((btn) => {
      const value = Number(btn.dataset.hours);
      btn.classList.toggle("active", value === hours);
      btn.classList.toggle("locked", value > allowed);
    });
  }

  segments.forEach((btn) => {
    btn.addEventListener("click", () => {
      haptic();
      const value = Number(btn.dataset.hours);
      if (value > allowed) {
        showToast(UNLOCK_HINTS[value]);
        return;
      }
      hours = value;
      refresh();
    });
  });

  footer.querySelector('[data-role="done"]').addEventListener("click", () => {
    haptic();
    onDone(hours);
    close();
  });

  refresh();
  return overlay;
}
