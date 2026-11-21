import { searchHashtags } from "./api.js";
import { escapeHTML } from "./utils.js";

const MAX_SUGGESTIONS = 3;
const DELAY_MS = 150;

// The word being typed right before the caret, when it starts with # at the beginning of a word.
function currentToken(textEl) {
  const caret = textEl.selectionStart ?? textEl.value.length;
  const match = /(^|\s)#([\p{L}\p{N}_]{0,30})$/u.exec(textEl.value.slice(0, caret));
  if (!match) return null;
  return { query: match[2].toLowerCase(), start: caret - match[2].length - 1, end: caret };
}

// Shows up to three existing hashtags under the composer text and completes the one being typed.
export function setupHashtagSuggest(textEl, listEl, onInsert) {
  const cache = new Map();
  let timer;
  let latest = 0;

  function render(tags) {
    listEl.innerHTML = tags
      .map((tag) => `<button class="tag-suggest-chip" type="button" data-tag="${escapeHTML(tag)}">#${escapeHTML(tag)}</button>`)
      .join("");
    listEl.hidden = tags.length === 0;
  }

  async function fetchTags(query) {
    if (!cache.has(query)) {
      const { hashtags } = await searchHashtags(query);
      cache.set(query, hashtags.map((h) => h.tag));
    }
    return cache.get(query);
  }

  async function update() {
    const token = currentToken(textEl);
    const request = ++latest;
    if (!token) {
      render([]);
      return;
    }
    try {
      const tags = (await fetchTags(token.query)).filter((tag) => tag !== token.query).slice(0, MAX_SUGGESTIONS);
      if (request === latest) render(tags);
    } catch {
      if (request === latest) render([]);
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(update, DELAY_MS);
  }

  textEl.addEventListener("input", schedule);
  textEl.addEventListener("click", schedule);
  textEl.addEventListener("keyup", (e) => {
    if (e.key.startsWith("Arrow")) schedule();
  });

  // Keeps the keyboard open while a suggestion is tapped.
  listEl.addEventListener("pointerdown", (e) => e.preventDefault());
  listEl.addEventListener("click", (e) => {
    const chip = e.target.closest(".tag-suggest-chip");
    const token = currentToken(textEl);
    if (!chip || !token) return;

    const after = textEl.value.slice(token.end);
    const inserted = `#${chip.dataset.tag} `;
    const value = textEl.value.slice(0, token.start) + inserted + after.replace(/^ /, "");
    if (value.length > textEl.maxLength) return;

    textEl.value = value;
    const caret = token.start + inserted.length;
    textEl.setSelectionRange(caret, caret);
    textEl.focus({ preventScroll: true });
    onInsert();
    render([]);
  });
}
