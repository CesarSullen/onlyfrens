import { haptic, openSheet, escapeHTML, sortByDisplayName } from "./utils.js";
import { icon } from "./icons.js";
import { avatarSrc } from "./avatar.js";

export const HIDE_MIN_FRIENDS = 20;
export const ONLY_MIN_FRIENDS = 30;

const MODE_NOTES = {
  hide: "Todos tus amigos la verán, menos los que elijas.",
  only: "Solo la verán los amigos que elijas.",
};

function friendRowHTML(friend, selected) {
  return `
    <label class="pick-row" data-name="${escapeHTML(friend.display_name.toLowerCase())}">
      <img class="avatar" src="${avatarSrc(friend)}" alt="" loading="lazy" decoding="async" />
      <span class="pick-name">${escapeHTML(friend.display_name)}</span>
      <input type="checkbox" class="pick-check" value="${friend.id}"${selected ? " checked" : ""} />
      <span class="pick-box">${icon("check", "regular")}</span>
    </label>`;
}

// current: { mode, ids } or null. onDone receives the new { mode, ids } or null to clear it.
export function openAudiencePicker({ friends, friendCount, current, onDone }) {
  let mode = current?.mode ?? "hide";
  const selected = new Set(current?.ids ?? []);
  const onlyLocked = friendCount < ONLY_MIN_FRIENDS;

  const { overlay, body, footer, close } = openSheet({
    title: "Audiencia",
    bodyHTML: `
      <div class="segmented">
        <button class="segment" data-mode="hide">${icon("eye-slash", "regular")}Ocultar a</button>
        <button class="segment" data-mode="only"${onlyLocked ? " disabled" : ""}>${icon(onlyLocked ? "lock" : "eye", "regular")}Mostrar solo a</button>
      </div>
      <p class="sheet-note"></p>
      <input type="text" class="pick-search" placeholder="Buscar amigo" autocomplete="off" />
      <div class="pick-list">
        ${sortByDisplayName(friends).map((f) => friendRowHTML(f, selected.has(f.id))).join("")}
      </div>`,
    footerHTML: `
      ${current ? `<button class="outline-btn large" data-role="clear">Quitar</button>` : ""}
      <button class="solid-btn large" data-role="done" disabled>Listo</button>`,
    footerClass: "audience-footer",
  });

  const noteEl = body.querySelector(".sheet-note");
  const doneBtn = footer.querySelector('[data-role="done"]');

  function refresh() {
    overlay.querySelectorAll(".segment").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    noteEl.textContent = MODE_NOTES[mode] + (onlyLocked ? " «Mostrar solo a» se desbloquea con 30 amigos." : "");
    doneBtn.disabled = selected.size === 0;
    doneBtn.textContent = selected.size ? `Listo (${selected.size})` : "Listo";
  }

  overlay.querySelectorAll(".segment").forEach((btn) => {
    btn.addEventListener("click", () => {
      haptic();
      mode = btn.dataset.mode;
      refresh();
    });
  });

  overlay.querySelectorAll(".pick-check").forEach((box) => {
    box.addEventListener("change", () => {
      haptic();
      if (box.checked) selected.add(box.value);
      else selected.delete(box.value);
      refresh();
    });
  });

  body.querySelector(".pick-search").addEventListener("input", (e) => {
    const query = e.target.value.trim().toLowerCase();
    overlay.querySelectorAll(".pick-row").forEach((row) => {
      row.hidden = query !== "" && !row.dataset.name.includes(query);
    });
  });

  footer.querySelector('[data-role="clear"]')?.addEventListener("click", () => {
    haptic();
    onDone(null);
    close();
  });

  doneBtn.addEventListener("click", () => {
    haptic();
    onDone({ mode, ids: [...selected] });
    close();
  });

  refresh();
}
