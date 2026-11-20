import { searchHashtags, getFollowedHashtags, followHashtag, unfollowHashtag } from "./api.js";
import { haptic, showToast, openSheet, escapeHTML, emptyLabelHTML } from "./utils.js";
import { icon } from "./icons.js";
import { openHashtag } from "./navigation.js";

const SEARCH_DELAY_MS = 250;

function countText(count) {
  if (!count) return "Sin publicaciones ahora";
  return count === 1 ? "1 publicación" : `${count} publicaciones`;
}

function rowHTML({ tag, count, following }, index) {
  return `
    <div class="tag-row" data-tag="${escapeHTML(tag)}" style="--i: ${Math.min(index, 8)}">
      <span class="tag-chip">${icon("hash", "regular")}</span>
      <div class="tag-info">
        <p class="tag-name">${escapeHTML(tag)}</p>
        <p class="tag-count">${countText(count)}</p>
      </div>
      <button class="outline-btn tag-follow${following ? " following" : ""}">${following ? "Siguiendo" : "Seguir"}</button>
    </div>`;
}

function sectionHTML(title, rows) {
  return rows.length
    ? `<h3 class="friends-section-title">${title}</h3>${rows.map(rowHTML).join("")}`
    : "";
}

export function openHashtagSearch() {
  const { body, close } = openSheet({
    title: "Hashtags",
    bodyHTML: `
      <div class="tag-search">
        <span>${icon("hash", "regular")}</span>
        <input type="text" placeholder="Buscar hashtag" autocomplete="off" autocapitalize="none" maxlength="30" />
      </div>
      <div class="search-results"></div>`,
  });

  const inputEl = body.querySelector("input");
  const resultsEl = body.querySelector(".search-results");
  let timer;
  let latest = 0;

  function show(html) {
    resultsEl.innerHTML = html || emptyLabelHTML("No hay hashtags con ese nombre");
  }

  resultsEl.addEventListener("click", async (e) => {
    const row = e.target.closest(".tag-row");
    if (!row) return;
    const tag = row.dataset.tag;
    const btn = e.target.closest(".tag-follow");

    haptic();
    if (!btn) {
      close();
      openHashtag(tag);
      return;
    }

    const next = !btn.classList.contains("following");
    btn.classList.toggle("following", next);
    btn.textContent = next ? "Siguiendo" : "Seguir";
    try {
      await (next ? followHashtag(tag) : unfollowHashtag(tag));
    } catch (err) {
      btn.classList.toggle("following", !next);
      btn.textContent = next ? "Seguir" : "Siguiendo";
      showToast(err.message, "error");
    }
  });

  async function load() {
    const query = inputEl.value.trim().replace(/^#/, "").toLowerCase();
    const request = ++latest;

    try {
      if (!query) {
        const [followed, popular] = await Promise.all([getFollowedHashtags(), searchHashtags("")]);
        if (request !== latest) return;
        const followedTags = new Set(followed.hashtags.map((h) => h.tag));
        show(
          sectionHTML("Siguiendo", followed.hashtags) +
            sectionHTML("Populares", popular.hashtags.filter((h) => !followedTags.has(h.tag))),
        );
        return;
      }

      const { hashtags } = await searchHashtags(query);
      if (request !== latest) return;

      // A tag with no posts yet can still be opened and followed.
      const exact = hashtags.some((h) => h.tag === query);
      const extra = !exact && /^[\p{L}\p{N}_]{1,30}$/u.test(query) ? [{ tag: query, count: 0, following: false }] : [];
      show([...extra, ...hashtags].map(rowHTML).join(""));
    } catch (err) {
      if (request === latest) showToast(err.message, "error");
    }
  }

  inputEl.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(load, SEARCH_DELAY_MS);
  });

  load();
}
