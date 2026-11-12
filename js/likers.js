import { getLikers } from "./api.js";
import { showList, escapeHTML } from "./utils.js";
import { loaderHTML } from "./loader.js";

const PLACEHOLDER_AVATAR = "./assets/icons/avatar-placeholder.svg";

function likerRowHTML({ profiles }, index) {
  return `
    <div class="friend-row liker-row" style="animation-delay: ${Math.min(index, 8) * 40}ms">
      <img class="avatar" src="${profiles?.avatar_url || PLACEHOLDER_AVATAR}" alt="" loading="lazy" />
      <div class="friend-info">
        <p class="friend-name">${escapeHTML(profiles?.display_name ?? "Desconocido")}</p>
        <span class="friend-sub">@${escapeHTML(profiles?.username ?? "")}</span>
      </div>
    </div>
  `;
}

function messageHTML(text) {
  return `<p class="empty-label liker-empty">${escapeHTML(text)}</p>`;
}

export async function openLikers(postId) {
  const listEl = showList("Les gustó tu publicación", loaderHTML());

  try {
    const likers = await getLikers(postId);
    listEl.innerHTML = likers.length
      ? likers.map(likerRowHTML).join("")
      : messageHTML("Aún no le ha gustado a nadie");
  } catch (err) {
    listEl.innerHTML = messageHTML(err.message);
  }
}
