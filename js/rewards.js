import { getRewards } from "./api.js";
import { haptic, showToast, escapeHTML } from "./utils.js";
import { icon } from "./icons.js";
import { loaderHTML } from "./loader.js";
import { openRewards } from "./navigation.js";

// Presentation of each reward. Thresholds come from the backend (GET /rewards),
// so this file only knows how a reward looks, not when it unlocks.
const REWARD_META = {
  verified_blue: { title: "Insignia azul de verificado", text: "Aparece junto a tu nombre en todas partes.", icon: "verified", weight: "fill" },
  long_posts: { title: "Publicaciones largas", text: "Escribe hasta 500 caracteres en vez de 200.", icon: "text-lines" },
  very_long_posts: { title: "Publicaciones muy largas", text: "Escribe hasta 1000 caracteres.", icon: "text-lines" },
  photo_downloads: { title: "Descargar fotos", text: "Guarda las fotos de las publicaciones que lo permitan.", icon: "download-simple" },
  suggestions: { title: "Sugerencias de amigos", text: "Tres personas al día que quizás conoces.", icon: "sparkle" },
  anonymous_hashtags: { title: "Publicar en hashtags", text: "Comparte de forma anónima en los hashtags.", icon: "hash" },
  hide_friends: { title: "Ocultar publicaciones", text: "Elige amigos que no verán una publicación.", icon: "eye-slash" },
  verified_gold: { title: "Insignia dorada de verificado", text: "Tu insignia cambia a dorado.", icon: "verified", weight: "fill" },
  only_friends: { title: "Mostrar solo a algunos", text: "Elige quiénes ven una publicación.", icon: "eye" },
  verified_purple: { title: "Insignia morada de verificado", text: "El nivel más alto: tu insignia pasa a morado.", icon: "verified", weight: "fill" },
};

const TIERS = [
  { tier: 1, name: "Nivel azul", badge: "verified_blue" },
  { tier: 2, name: "Nivel dorado", badge: "verified_gold" },
  { tier: 3, name: "Nivel morado", badge: "verified_purple" },
];

// Small icons shown on the profile; the verified badge already sits next to the name.
const STRIP_IDS = ["long_posts", "suggestions", "anonymous_hashtags", "photo_downloads", "hide_friends", "only_friends"];

// Badges strip on a profile. On your own profile it opens the rewards page.
export function rewardStripHTML(rewardIds = [], { own = false } = {}) {
  const chips = STRIP_IDS.filter((id) => rewardIds.includes(id)).map((id, i) => {
    const meta = REWARD_META[id];
    return `<span class="reward-chip tier-${rewardTier(id)}" style="--i: ${i}" title="${escapeHTML(meta.title)}">${icon(meta.icon, "regular")}</span>`;
  });

  if (own) {
    const content = chips.length ? chips.join("") : `<span class="reward-chip empty">${icon("medal", "regular")}</span>`;
    return `
      <button class="reward-strip tappable" id="rewards-btn" aria-label="Ver recompensas">
        ${content}
        <span class="reward-strip-label">Recompensas</span>
        <span class="reward-strip-caret">${icon("caret-left", "regular")}</span>
      </button>`;
  }

  return chips.length ? `<div class="reward-strip static">${chips.join("")}</div>` : "";
}

export function bindRewardStrip() {
  document.getElementById("rewards-btn")?.addEventListener("click", () => {
    haptic();
    openRewards();
  });
}

// The tier a reward belongs to is fixed by the catalog the backend sent last time;
// until the page loads, the thresholds below are only used to color the chips.
const REWARD_TIER = { verified_gold: 2, long_posts: 2, only_friends: 2, verified_purple: 3, very_long_posts: 3 };

function rewardTier(id) {
  return REWARD_TIER[id] ?? 1;
}

function rewardRowHTML(reward, friendCount, index) {
  const meta = REWARD_META[reward.id];
  const unlocked = friendCount >= reward.friends;
  const missing = reward.friends - friendCount;

  const status = unlocked
    ? `<span class="reward-status ok">${icon("check", "regular")}</span>`
    : `<span class="reward-status">${missing === 1 ? "Falta 1 amigo" : `Faltan ${missing}`}</span>`;

  return `
    <li class="reward-row ${unlocked ? "unlocked" : "locked"}" style="--i: ${index}">
      <span class="reward-icon">${icon(unlocked ? meta.icon : "lock", unlocked ? meta.weight ?? "regular" : "regular")}</span>
      <div class="reward-info">
        <p class="reward-title">${meta.title}</p>
        <p class="reward-text">${unlocked ? meta.text : `${meta.text} · ${reward.friends} amigos`}</p>
      </div>
      ${status}
    </li>`;
}

function tierHTML({ tier, name, badge }, rewards, friendCount, order) {
  const items = rewards.filter((r) => r.tier === tier);
  const threshold = rewards.find((r) => r.id === badge).friends;
  const unlocked = friendCount >= threshold;

  return `
    <section class="tier-card tier-${tier}" style="--i: ${order}">
      <header class="tier-head">
        <span class="tier-badge">${icon("verified", "fill")}</span>
        <div>
          <h2 class="tier-name">${name}</h2>
          <p class="tier-sub">Desde ${threshold} amigos</p>
        </div>
        <span class="tier-state${unlocked ? " ok" : ""}">${unlocked ? "Desbloqueado" : `${friendCount}/${threshold}`}</span>
      </header>
      <ul class="reward-list">${items.map((r, i) => rewardRowHTML(r, friendCount, order * 4 + i)).join("")}</ul>
    </section>`;
}

function heroHTML(rewards, friendCount) {
  const next = rewards.filter((r) => r.friends > friendCount).sort((a, b) => a.friends - b.friends)[0];
  const missing = next ? next.friends - friendCount : 0;
  const progress = next ? Math.min(1, friendCount / next.friends) : 1;
  const nextText = next
    ? `${missing === 1 ? "Te falta 1 amigo" : `Te faltan ${missing} amigos`} para <b>${REWARD_META[next.id].title.toLowerCase()}</b>`
    : "Lo has desbloqueado todo. ¡Eres leyenda!";

  return `
    <section class="rewards-hero">
      <p class="rewards-count"><span>${friendCount}</span> ${friendCount === 1 ? "amigo" : "amigos"}</p>
      <div class="rewards-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress * 100)}">
        <i style="--progress: ${progress}"></i>
      </div>
      <p class="rewards-next">${nextText}</p>
    </section>`;
}

export async function renderRewards(appEl) {
  appEl.innerHTML = `
    <div class="user-profile-bar">
      <button class="back-btn" id="back-btn" aria-label="Volver">${icon("caret-left", "regular")}</button>
    </div>
    <div class="rewards-page fade-in" id="rewards-page">${loaderHTML()}</div>
  `;

  document.getElementById("back-btn").addEventListener("click", () => {
    haptic();
    history.back();
  });

  const pageEl = document.getElementById("rewards-page");

  try {
    const { friend_count, rewards } = await getRewards();
    if (!pageEl.isConnected) return;

    pageEl.innerHTML = `
      ${heroHTML(rewards, friend_count)}
      ${TIERS.map((tier, i) => tierHTML(tier, rewards, friend_count, i)).join("")}
      <p class="rewards-footnote">Los niveles se calculan con tus amigos actuales: si pierdes amigos, pierdes lo que dependa de ellos.</p>
    `;
  } catch (err) {
    pageEl.innerHTML = `<p class="empty-label profile-error">${escapeHTML(err.message)}</p>`;
    showToast(err.message, "error");
  }
}
