import { haptic, closeSheet, enableSheetDrag, escapeHTML, sortByDisplayName } from "./utils.js";
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
      <img class="avatar" src="${avatarSrc(friend)}" alt="" loading="lazy" />
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

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="sheet-overlay" id="audience-overlay">
      <div class="sheet-header">
        <span class="sheet-title">Audiencia</span>
        <button class="icon-btn" id="audience-close" aria-label="Cerrar">${icon("x", "bold")}</button>
      </div>
      <div class="sheet-body">
        <div class="segmented" id="audience-modes">
          <button class="segment" data-mode="hide">${icon("eye-slash", "regular")}Ocultar a</button>
          <button class="segment" data-mode="only"${onlyLocked ? " disabled" : ""}>${icon(onlyLocked ? "lock" : "eye", "regular")}Mostrar solo a</button>
        </div>
        <p class="sheet-note" id="audience-note"></p>
        <input type="text" class="pick-search" id="audience-search" placeholder="Buscar amigo" autocomplete="off" />
        <div class="pick-list" id="audience-list">
          ${sortByDisplayName(friends).map((f) => friendRowHTML(f, selected.has(f.id))).join("")}
        </div>
      </div>
      <div class="sheet-footer audience-footer">
        ${current ? `<button class="outline-btn large" id="audience-clear">Quitar</button>` : ""}
        <button class="solid-btn large" id="audience-done" disabled>Listo</button>
      </div>
    </div>`,
  );

  const overlay = document.getElementById("audience-overlay");
  const noteEl = document.getElementById("audience-note");
  const doneBtn = document.getElementById("audience-done");
  const close = () => closeSheet(overlay);

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

  document.getElementById("audience-search").addEventListener("input", (e) => {
    const query = e.target.value.trim().toLowerCase();
    overlay.querySelectorAll(".pick-row").forEach((row) => {
      row.hidden = query !== "" && !row.dataset.name.includes(query);
    });
  });

  document.getElementById("audience-clear")?.addEventListener("click", () => {
    haptic();
    onDone(null);
    close();
  });

  doneBtn.addEventListener("click", () => {
    haptic();
    onDone({ mode, ids: [...selected] });
    close();
  });

  document.getElementById("audience-close").addEventListener("click", close);
  enableSheetDrag(overlay, close);
  refresh();
}
