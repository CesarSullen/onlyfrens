import { searchAccounts, addFriend, acceptFriendRequest } from "./api.js";
import { haptic, showToast, closeSheet, enableSheetDrag, escapeHTML } from "./utils.js";
import { icon } from "./icons.js";
import { verifiedBadgeHTML } from "./verified.js";
import { avatarSrc } from "./avatar.js";

const SEARCH_DELAY_MS = 250;
const MIN_QUERY_LENGTH = 3;

const HINT = `<p class="empty-label" style="padding: 18px 0;">Escribe al menos ${MIN_QUERY_LENGTH} letras del username de tu amigo</p>`;

function actionHTML(account) {
  if (account.relation === "outgoing") return `<button class="outline-btn account-action" disabled>Enviada</button>`;
  if (account.relation === "incoming") return `<button class="solid-btn account-action" data-action="accept">Aceptar</button>`;
  return `<button class="outline-btn account-action" data-action="add">Agregar</button>`;
}

// Profiles can't be opened from here: the only thing to do is send (or accept) a request.
function accountRowHTML(account, index) {
  return `
    <div class="account-row" data-username="${escapeHTML(account.username)}" data-friendship-id="${account.friendship_id ?? ""}" style="--i: ${index}">
      <img class="avatar" src="${avatarSrc(account)}" alt="" loading="lazy" />
      <div class="account-info">
        <p class="account-name">${escapeHTML(account.display_name)}${verifiedBadgeHTML(account)}</p>
        <p class="account-user">@${escapeHTML(account.username)}</p>
      </div>
      ${actionHTML(account)}
    </div>`;
}

// onChange runs after the sheet closes if any request was sent or accepted.
export function openFriendSearch(onChange) {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="sheet-overlay" id="friend-search-overlay">
      <div class="sheet-header">
        <span class="sheet-title">Agregar amigo</span>
        <button class="icon-btn" id="friend-search-close" aria-label="Cerrar">${icon("x", "bold")}</button>
      </div>
      <div class="sheet-body">
        <div class="tag-search">
          <span>@</span>
          <input type="text" id="friend-search-input" placeholder="username" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="20" />
        </div>
        <div id="friend-search-results">${HINT}</div>
      </div>
    </div>`,
  );

  const overlay = document.getElementById("friend-search-overlay");
  const inputEl = document.getElementById("friend-search-input");
  const resultsEl = document.getElementById("friend-search-results");
  let timer;
  let latest = 0;
  let changed = false;

  const close = () => {
    closeSheet(overlay);
    if (changed) onChange?.();
  };

  function show(accounts) {
    resultsEl.innerHTML = accounts.length
      ? accounts.map(accountRowHTML).join("")
      : `<p class="empty-label" style="padding: 18px 0;">No encontramos a nadie con ese username</p>`;

    resultsEl.querySelectorAll(".account-row").forEach((row) => {
      const btn = row.querySelector(".account-action");

      btn.addEventListener("click", async () => {
        haptic();
        btn.disabled = true;
        try {
          if (btn.dataset.action === "accept") {
            await acceptFriendRequest(row.dataset.friendshipId);
            showToast("Ahora son amigos");
            row.classList.add("done");
            btn.textContent = "Amigos";
          } else {
            await addFriend(row.dataset.username);
            showToast("Solicitud enviada");
            btn.textContent = "Enviada";
          }
          btn.className = "outline-btn account-action";
          changed = true;
        } catch (err) {
          btn.disabled = false;
          showToast(err.message, "error");
        }
      });
    });
  }

  async function load() {
    const query = inputEl.value.trim().replace(/^@/, "").toLowerCase();
    const request = ++latest;

    if (query.length < MIN_QUERY_LENGTH) {
      resultsEl.innerHTML = HINT;
      return;
    }

    try {
      const { accounts } = await searchAccounts(query);
      if (request === latest) show(accounts);
    } catch (err) {
      if (request === latest) showToast(err.message, "error");
    }
  }

  inputEl.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(load, SEARCH_DELAY_MS);
  });

  document.getElementById("friend-search-close").addEventListener("click", close);
  enableSheetDrag(overlay, close);
  inputEl.focus();
}
