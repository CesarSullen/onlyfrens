import { escapeHTML } from "./utils.js";
import { icon } from "./icons.js";
import { avatarSrc } from "./avatar.js";
import { openPost } from "./navigation.js";
import { playMusic, toggleMusic } from "./music-player.js";
import { haptic } from "./utils.js";

export const THOUGHT_LIMIT = 60;

// A single bubble hints at the photo the cloud belongs to.
function dotsHTML() {
  return `<i class="thought-dot"></i>`;
}

// "tail" says where the little bubbles go: "down" toward a profile photo below, "up" toward a photo above.
export function cloudHTML(text, { postId = "", tail = "up", mini = false, tag = "button", music = null } = {}) {
  const attr = (postId ? ` data-thought-post="${escapeHTML(postId)}"` : "") +
    (music ? ` data-preview="${escapeHTML(music.preview)}" data-art="${escapeHTML(music.artwork)}"` : "");
  const song = music && !mini ? musicRowHTML(music) : "";
  const type = tag === "button" ? ' type="button"' : "";
  return `<${tag} class="thought-cloud ${tail}${mini ? " mini" : ""}"${type}${attr}>${song}<span class="thought-text">${escapeHTML(text)}</span>${dotsHTML(tail)}</${tag}>`;
}

export function addCloudHTML({ mini = false, tag = "button", id = "thought-add" } = {}) {
  const type = tag === "button" ? ' type="button"' : "";
  return `<${tag} class="thought-cloud down add${mini ? " mini" : ""}" id="${id}"${type} aria-label="Añadir un pensamiento"><span class="thought-text">${icon("plus", "bold")}</span>${dotsHTML("down")}</${tag}>`;
}

// A vinyl with the cover in its label, and the song and artist next to it.
function musicRowHTML(music) {
  return `<span class="thought-music"><span class="vinyl" role="button" aria-label="Reproducir o pausar" style="--art: url('${escapeHTML(music.artwork)}')"></span><span class="thought-song"><b>${escapeHTML(music.name)}</b>${escapeHTML(music.artist)}</span></span>`;
}

// Apple asks for a link to the song and credit for the preview wherever it plays.
export function musicCreditHTML(music) {
  if (!music) return "";
  return `<a class="thought-credit" href="${escapeHTML(music.url)}" target="_blank" rel="noopener noreferrer">${icon("vinyl-record", "regular")}Escuchar en Apple Music · Vista previa cortesía de iTunes</a>`;
}

const artColors = new Map();

// Average color of the cover, weighted toward vivid pixels; null when the image can't be read.
function artColor(url) {
  if (!artColors.has(url)) {
    artColors.set(
      url,
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 8;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, 8, 8);
            const data = ctx.getImageData(0, 0, 8, 8).data;
            let r = 0, g = 0, b = 0, weight = 0;
            for (let i = 0; i < data.length; i += 4) {
              const vivid = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) + 10;
              r += data[i] * vivid;
              g += data[i + 1] * vivid;
              b += data[i + 2] * vivid;
              weight += vivid;
            }
            resolve(`rgb(${Math.round(r / weight)} ${Math.round(g / weight)} ${Math.round(b / weight)})`);
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      }),
    );
  }
  return artColors.get(url);
}

// Clouds with a song take the main color of its cover.
export function tintClouds(root = document) {
  root.querySelectorAll(".thought-cloud[data-art]").forEach(async (el) => {
    const color = await artColor(el.dataset.art);
    if (color) el.style.setProperty("--cloud-tint", color);
  });
}

// The row above the profile photo: the thought, or the add button on the own profile.
export function profileCloudHTML(profile, own) {
  if (profile.thought) {
    const { text, post_id, music } = profile.thought;
    return `<div class="profile-cloud">${cloudHTML(text, { postId: post_id, tail: "down", music })}</div>`;
  }
  return own ? `<div class="profile-cloud">${addCloudHTML()}</div>` : "";
}

// One small cloud per person above their photo, for the row at the top of the feed.
export function thoughtRowHTML(thoughts, own) {
  const mine = thoughts.find((thought) => thought.is_mine);
  const items = thoughts.map((thought) => thoughtItemHTML(thought));
  if (!mine) {
    items.unshift(`
      <div class="thought-item" data-add="true">
        ${addCloudHTML({ mini: true, tag: "div", id: "row-thought-add" })}
        <img class="avatar" src="${escapeHTML(avatarSrc(own))}" alt="" />
        <span class="thought-item-name">Tú</span>
      </div>`);
  }
  return items.join("");
}

function thoughtItemHTML({ post_id, text, is_mine, author, music }) {
  return `
    <button class="thought-item" type="button" data-post="${escapeHTML(post_id)}">
      ${cloudHTML(text, { tail: "down", mini: true, tag: "div", music })}
      <img class="avatar" src="${escapeHTML(avatarSrc(author))}" alt="" loading="lazy" decoding="async" />
      <span class="thought-item-name">${is_mine ? "Tú" : escapeHTML(author?.display_name ?? "")}</span>
    </button>`;
}

// Tapping the cloud opens its post; tapping the vinyl plays or pauses the song. Also colors the cloud.
export function bindProfileCloud(cardEl) {
  tintClouds(cardEl);
  const song = cardEl.querySelector(".thought-cloud[data-preview]");
  if (song) playMusic(song, { auto: true });
  cardEl.querySelector("[data-thought-post]")?.addEventListener("click", (e) => {
    haptic();
    if (e.target.closest(".vinyl")) toggleMusic(e.currentTarget);
    else openPost(e.currentTarget.dataset.thoughtPost);
  });
}
