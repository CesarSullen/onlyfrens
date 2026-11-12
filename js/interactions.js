import { getInteractions } from "./api.js";
import { showList, escapeHTML } from "./utils.js";
import { loaderHTML } from "./loader.js";

const PLACEHOLDER_AVATAR = "./assets/icons/avatar-placeholder.svg";

function personRowHTML(profile, index) {
  return `
    <div class="friend-row liker-row" style="animation-delay: ${Math.min(index, 8) * 40}ms">
      <img class="avatar" src="${profile?.avatar_url || PLACEHOLDER_AVATAR}" alt="" loading="lazy" />
      <div class="friend-info">
        <p class="friend-name">${escapeHTML(profile?.display_name ?? "Desconocido")}</p>
        <span class="friend-sub">@${escapeHTML(profile?.username ?? "")}</span>
      </div>
    </div>
  `;
}

function sectionHTML(title, profiles, startIndex) {
  if (profiles.length === 0) return "";
  return `
    <p class="friends-section-title liker-section-title">${title} (${profiles.length})</p>
    ${profiles.map((profile, i) => personRowHTML(profile, startIndex + i)).join("")}
  `;
}

function messageHTML(text) {
  return `<p class="empty-label liker-empty">${escapeHTML(text)}</p>`;
}

export async function openInteractions(postId) {
  const listEl = showList("Interacciones", loaderHTML());

  try {
    const { likers, reposters } = await getInteractions(postId);

    listEl.innerHTML =
      likers.length + reposters.length === 0
        ? messageHTML("Aún no hay interacciones")
        : sectionHTML("Les gustó", likers.map((l) => l.profiles), 0) +
          sectionHTML("Lo compartieron", reposters.map((r) => r.profiles), likers.length);
  } catch (err) {
    listEl.innerHTML = messageHTML(err.message);
  }
}
