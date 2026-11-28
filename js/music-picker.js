import { searchMusic } from "./api.js";
import { openSheet, escapeHTML, emptyLabelHTML, haptic } from "./utils.js";
import { icon } from "./icons.js";

const SEARCH_DELAY_MS = 600;

function rowHTML(song, index) {
  return `
    <button class="song-row" type="button" data-index="${index}" style="--i: ${Math.min(index, 8)}">
      <img class="song-art" src="${escapeHTML(song.artwork)}" alt="" loading="lazy" decoding="async" />
      <span class="song-info">
        <span class="song-name">${escapeHTML(song.name)}</span>
        <span class="song-artist">${escapeHTML(song.artist)}</span>
      </span>
    </button>`;
}

// onPick receives { id, name, artist, artwork, preview, url }.
export function openMusicPicker(onPick) {
  const { body, close } = openSheet({
    title: "Canción",
    bodyHTML: `
      <div class="tag-search">
        <span>${icon("vinyl-record", "regular")}</span>
        <input type="text" placeholder="Busca una canción o artista" autocomplete="off" maxlength="80" />
      </div>
      <div class="search-results"></div>
      <p class="sheet-note">Resultados de iTunes. Se reproduce una vista previa de 30 segundos.</p>`,
  });

  const inputEl = body.querySelector("input");
  const resultsEl = body.querySelector(".search-results");
  let songs = [];
  let timer;
  let latest = 0;

  inputEl.addEventListener("input", () => {
    clearTimeout(timer);
    const query = inputEl.value.trim();
    if (query.length < 2) {
      resultsEl.innerHTML = "";
      return;
    }
    timer = setTimeout(async () => {
      const request = ++latest;
      try {
        ({ results: songs } = await searchMusic(query));
        if (request !== latest) return;
        resultsEl.innerHTML = songs.length ? songs.map(rowHTML).join("") : emptyLabelHTML("No se encontró esa canción");
      } catch (err) {
        if (request === latest) resultsEl.innerHTML = emptyLabelHTML(escapeHTML(err.message));
      }
    }, SEARCH_DELAY_MS);
  });

  resultsEl.addEventListener("click", (e) => {
    const row = e.target.closest(".song-row");
    if (!row) return;
    haptic();
    // Dropping the focus first keeps iOS from leaving the keyboard's space behind.
    inputEl.blur();
    onPick(songs[Number(row.dataset.index)]);
    close();
  });

  inputEl.focus();
}
