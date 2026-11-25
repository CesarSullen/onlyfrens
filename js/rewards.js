import { getRewards } from "./api.js";
import { haptic, showToast, escapeHTML } from "./utils.js";
import { icon } from "./icons.js";
import { loaderHTML } from "./loader.js";
import { openRewards } from "./navigation.js";
import { ACCENTS } from "./accents.js";

// Presentation of each reward. Thresholds come from the backend (GET /rewards),
// so this file only knows how a reward looks, not when it unlocks.
const REWARD_META = {
  verified_blue: { title: "Insignia zafiro de verificado", text: "Aparece junto a tu nombre en todas partes." },
  long_posts: { title: "Publicaciones largas", text: "Escribe hasta 500 caracteres en vez de 200." },
  very_long_posts: { title: "Publicaciones muy largas", text: "Escribe hasta 1000 caracteres." },
  photo_downloads: { title: "Descargar fotos", text: "Guarda como imagen las publicaciones con foto que lo permitan." },
  anonymous_hashtags: { title: "Publicar en hashtags", text: "Comparte de forma anónima en los hashtags." },
  hide_friends: { title: "Ocultar publicaciones", text: "Elige amigos que no verán una publicación." },
  verified_gold: { title: "Insignia topacio de verificado", text: "Tu insignia cambia a topacio." },
  only_friends: { title: "Mostrar solo a algunos", text: "Elige quiénes ven una publicación." },
  verified_purple: { title: "Insignia amatista de verificado", text: "El nivel más alto: tu insignia pasa a amatista." },
  stox_mac: { title: "2 meses de STOX Mac", text: "Plan Mac de STOX gratis durante 2 meses." },
};

// Accents that the community unlocks, in the order they unlock.
const COMMUNITY_ACCENTS = ACCENTS.filter((accent) => accent.users > 0);
const listFormat = new Intl.ListFormat("es", { style: "long", type: "conjunction" });

const TIERS = [
  { tier: 1, name: "Nivel zafiro", badge: "verified_blue" },
  { tier: 2, name: "Nivel topacio", badge: "verified_gold" },
  { tier: 3, name: "Nivel amatista", badge: "verified_purple" },
];

// Small icons shown on the profile; the verified badge already sits next to the name.
const STRIP_IDS = ["long_posts", "anonymous_hashtags", "photo_downloads", "hide_friends", "only_friends"];

function badgeHTML(id) {
  return `<img class="reward-badge" src="assets/rewards/${id}.svg" alt="" />`;
}

// Badges strip on a profile. On your own profile it opens the rewards page.
export function rewardStripHTML(rewardIds = [], { own = false } = {}) {
  const chips = STRIP_IDS.filter((id) => rewardIds.includes(id)).map((id, i) => {
    return `<span class="reward-chip" style="--i: ${i}" title="${escapeHTML(REWARD_META[id].title)}">${badgeHTML(id)}</span>`;
  });

  if (own) {
    const content = chips.length ? chips.join("") : `<span class="reward-chip locked">${badgeHTML("verified_blue")}</span>`;
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

function rewardRowHTML(reward, friendCount, index) {
  const meta = REWARD_META[reward.id];
  const unlocked = friendCount >= reward.friends;
  const missing = reward.friends - friendCount;

  const status = unlocked
    ? `<span class="reward-status ok">${icon("check", "regular")}</span>`
    : `<span class="reward-status">${missing === 1 ? "Falta 1 amigo" : `Faltan ${missing}`}</span>`;

  return `
    <li class="reward-row ${unlocked ? "unlocked" : "locked"}" style="--i: ${index}">
      <span class="reward-icon${unlocked ? "" : " locked"}">${badgeHTML(reward.id)}</span>
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

function heroHTML({ count, one, many, progress, nextText }) {
  return `
    <section class="rewards-hero">
      <p class="rewards-count"><span>${count}</span> ${count === 1 ? one : many}</p>
      <div class="rewards-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress * 100)}">
        <i style="--progress: ${progress}"></i>
      </div>
      <p class="rewards-next">${nextText}</p>
    </section>`;
}

function friendsHeroHTML(rewards, friendCount) {
  const next = rewards.filter((r) => r.friends > friendCount).sort((a, b) => a.friends - b.friends)[0];
  const missing = next ? next.friends - friendCount : 0;
  const nextText = next
    ? `${missing === 1 ? "Te falta 1 amigo" : `Te faltan ${missing} amigos`} para <b>${REWARD_META[next.id].title.toLowerCase()}</b>`
    : "Lo has desbloqueado todo. ¡Eres leyenda!";

  return heroHTML({
    count: friendCount,
    one: "amigo",
    many: "amigos",
    progress: next ? Math.min(1, friendCount / next.friends) : 1,
    nextText,
  });
}

function communityHeroHTML(userCount) {
  const next = COMMUNITY_ACCENTS.find((accent) => accent.users > userCount);
  let nextText = "La comunidad ya desbloqueó todos los acentos.";

  if (next) {
    const missing = next.users - userCount;
    const names = COMMUNITY_ACCENTS.filter((accent) => accent.users === next.users).map((accent) => `<b>${accent.name}</b>`);
    nextText = `${missing === 1 ? "Falta 1 usuario" : `Faltan ${missing} usuarios`} para ${names.length === 1 ? "el acento" : "los acentos"} ${listFormat.format(names)}`;
  }

  return heroHTML({
    count: userCount,
    one: "usuario",
    many: "usuarios",
    progress: next ? Math.min(1, userCount / next.users) : 1,
    nextText,
  });
}

function communityRowHTML(accent, userCount, index) {
  const unlocked = userCount >= accent.users;
  const missing = accent.users - userCount;
  const text = "Cambia el color de la app en Ajustes.";

  const status = unlocked
    ? `<span class="reward-status ok">${icon("check", "regular")}</span>`
    : `<span class="reward-status">${missing === 1 ? "Falta 1" : `Faltan ${missing}`}</span>`;

  return `
    <li class="reward-row ${unlocked ? "unlocked" : "locked"}" style="--i: ${index}">
      <span class="reward-icon${unlocked ? "" : " locked"}"><span class="reward-swatch" data-accent="${accent.id}"></span></span>
      <div class="reward-info">
        <p class="reward-title">Acento ${accent.name}</p>
        <p class="reward-text">${unlocked ? text : `${text} · ${accent.users} usuarios`}</p>
      </div>
      ${status}
    </li>`;
}

function communityHTML(userCount, order) {
  const unlockedCount = COMMUNITY_ACCENTS.filter((accent) => userCount >= accent.users).length;
  const allUnlocked = unlockedCount === COMMUNITY_ACCENTS.length;

  return `
    <section class="tier-card community" style="--i: ${order}">
      <header class="tier-head">
        <span class="tier-badge">${icon("users", "fill")}</span>
        <div>
          <h2 class="tier-name">Comunidad</h2>
          <p class="tier-sub">Se desbloquea para todos</p>
        </div>
        <span class="tier-state${allUnlocked ? " ok" : ""}">${unlockedCount}/${COMMUNITY_ACCENTS.length}</span>
      </header>
      <ul class="reward-list">${COMMUNITY_ACCENTS.map((accent, i) => communityRowHTML(accent, userCount, order * 4 + i)).join("")}</ul>
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
    const { friend_count, rewards, user_count } = await getRewards();
    if (!pageEl.isConnected) return;

    // Older backends do not send the user count yet, so the community parts stay hidden.
    const hasCommunity = Number.isFinite(user_count);

    pageEl.innerHTML = `
      <div class="rewards-heroes">
        ${friendsHeroHTML(rewards, friend_count)}
        ${hasCommunity ? communityHeroHTML(user_count) : ""}
      </div>
      ${TIERS.map((tier, i) => tierHTML(tier, rewards, friend_count, i)).join("")}
      ${hasCommunity ? communityHTML(user_count, TIERS.length) : ""}
      <p class="rewards-footnote">Los niveles se calculan con tus amigos actuales: si pierdes amigos, pierdes lo que dependa de ellos.${hasCommunity ? " Lo que desbloquea la comunidad no se pierde." : ""}</p>
    `;
  } catch (err) {
    pageEl.innerHTML = `<p class="empty-label profile-error">${escapeHTML(err.message)}</p>`;
    showToast(err.message, "error");
  }
}
