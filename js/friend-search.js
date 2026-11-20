import { searchAccounts, addFriend, acceptFriendRequest } from "./api.js";
import { haptic, showToast, openSheet, escapeHTML, emptyLabelHTML } from "./utils.js";
import { verifiedBadgeHTML } from "./verified.js";
import { avatarSrc } from "./avatar.js";

const SEARCH_DELAY_MS = 250;
const MIN_QUERY_LENGTH = 3;

const HINT = emptyLabelHTML(`Escribe al menos ${MIN_QUERY_LENGTH} letras del username de tu amigo`);

function actionHTML(account) {
  if (account.relation === "outgoing") return `<button class="outline-btn account-action" disabled>Enviada</button>`;
  if (account.relation === "incoming") return `<button class="solid-btn account-action" data-action="accept">Aceptar</button>`;
  return `<button class="outline-btn account-action" data-action="add">Agregar</button>`;
}

// Profiles can't be opened from here: the only thing to do is send (or accept) a request.
function accountRowHTML(account, index) {
  return `
    <div class="account-row" data-username="${escapeHTML(account.username)}" data-friendship-id="${account.friendship_id ?? ""}" style="--i: ${index}">
      <img class="avatar" src="${avatarSrc(account)}" alt="" loading="lazy" decoding="async" />
      <div class="account-info">
        <p class="account-name">${escapeHTML(account.display_name)}${verifiedBadgeHTML(account)}</p>
        <p class="account-user">@${escapeHTML(account.username)}</p>
      </div>
      ${actionHTML(account)}
    </div>`;
}

// onChange runs after the sheet closes if any request was sent or accepted.
export function openFriendSearch(onChange) {
  let changed = false;
  const { overlay, body } = openSheet({
    title: "Agregar amigo",
    bodyHTML: `
      <div class="tag-search">
        <span>@</span>
        <input type="text" placeholder="username" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="20" />
      </div>
      <div class="search-results">${HINT}</div>`,
    onClose: () => {
      if (changed) onChange?.();
    },
  });

  const inputEl = body.querySelector("input");
  const resultsEl = body.querySelector(".search-results");
  let timer;
  let latest = 0;

  function show(accounts) {
    resultsEl.innerHTML = accounts.length
      ? accounts.map(accountRowHTML).join("")
      : emptyLabelHTML("No encontramos a nadie con ese username");
  }

  resultsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest(".account-action");
    if (!btn || btn.disabled) return;
    const row = btn.closest(".account-row");

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

  let focused = false;
  const focusInput = () => {
    if (focused) return;
    focused = true;
    inputEl.focus({ preventScroll: true });
  };
  overlay.addEventListener("animationend", (e) => {
    if (e.target === overlay) focusInput();
  });
  setTimeout(focusInput, 450);

  const viewport = window.visualViewport;
  if (viewport && window.matchMedia("(max-width: 767px)").matches) {
    const fit = () => {
      overlay.style.height = `${viewport.height}px`;
      overlay.style.top = `${viewport.offsetTop}px`;
      overlay.style.bottom = "auto";
    };
    viewport.addEventListener("resize", fit);
    viewport.addEventListener("scroll", fit);
    overlay.addEventListener("animationend", (e) => {
      if (e.target === overlay && overlay.classList.contains("closing")) {
        viewport.removeEventListener("resize", fit);
        viewport.removeEventListener("scroll", fit);
      }
    });
  }
}
