import { icon } from "./icons.js";
import { escapeHTML, showToast } from "./utils.js";
import { verifiedBadgeHTML } from "./verified.js";
import { avatarSrc } from "./avatar.js";

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const SOCIALS = [
  {
    field: "instagram",
    label: "Instagram",
    icon: "instagram-logo",
    pattern: /^[A-Za-z0-9._]{1,30}$/,
    url: (handle) => `https://www.instagram.com/${handle}/`,
  },
  {
    field: "x_username",
    label: "X",
    icon: "x-logo",
    pattern: /^[A-Za-z0-9_]{1,15}$/,
    url: (handle) => `https://x.com/${handle}`,
  },
];

export function formatBirthday(day, month) {
  if (!day || !month) return "Sin definir";
  return `${day} de ${MONTH_NAMES[month - 1]}`;
}

export function parseBirthday(value) {
  const match = value.trim().match(/^(\d{1,2})\s*[\/\-]\s*(\d{1,2})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  return { day, month };
}

export function cleanUsername(value) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

// Accepts "@name", "name" or a pasted profile link and keeps only the handle.
export function cleanHandle(value) {
  return value
    .trim()
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
}

export function socialsError(handles) {
  for (const social of SOCIALS) {
    const handle = handles[social.field];
    if (handle && !social.pattern.test(handle)) {
      return `El usuario de ${social.label} no es válido`;
    }
  }
  return null;
}

function socialLinksHTML(profile) {
  return SOCIALS.map((social) => {
    const handle = profile[social.field];
    if (!handle || !social.pattern.test(handle)) return "";
    return `
      <a class="profile-detail profile-link" href="${social.url(handle)}" target="_blank" rel="noopener noreferrer">
        ${icon(social.icon, "regular")}@${escapeHTML(handle)}
      </a>`;
  }).join("");
}

export function profileCardHTML(profile, { actionsHTML, avatarEditable = false, divider = true }) {
  const avatarUrl = avatarSrc(profile);

  const avatarHTML = avatarEditable
    ? `
      <button class="profile-avatar-btn" id="avatar-btn" aria-label="Cambiar foto de perfil">
        <img class="profile-avatar" src="${avatarUrl}" alt="" />
        <span class="avatar-edit-badge">${icon("camera", "fill")}</span>
      </button>
      <input type="file" id="avatar-input" accept="image/*" hidden />`
    : `
      <div class="profile-avatar-btn static">
        <img class="profile-avatar" src="${avatarUrl}" alt="" />
      </div>`;

  return `
    <div class="profile-top">
      ${avatarHTML}
      <div>
        <h1 class="profile-name">${escapeHTML(profile.display_name)}${verifiedBadgeHTML(profile)}</h1>
        <p class="profile-username">@${escapeHTML(profile.username)}</p>
      </div>
    </div>
    ${profile.bio ? `<p class="profile-bio post-text">${escapeHTML(profile.bio)}</p>` : ""}
    <div class="profile-details">
      <p class="profile-detail">${icon("cake", "fill")}${formatBirthday(profile.birthday_day, profile.birthday_month)}</p>
      ${socialLinksHTML(profile)}
    </div>
    <div class="profile-actions">${actionsHTML}</div>
    ${divider ? `<div class="profile-divider"></div>` : ""}
  `;
}

export async function shareProfile(profile) {
  const url = `${location.origin}${location.pathname}#add=${profile.username}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: "OnlyFrens", text: "Agrégame en OnlyFrens", url });
    } catch {
      return;
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    showToast("Enlace copiado");
  } catch {
    showToast("No se pudo copiar el enlace", "error");
  }
}
