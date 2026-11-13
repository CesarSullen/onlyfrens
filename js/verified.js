import { icon } from "./icons.js";

export function verifiedBadgeHTML(profile) {
  return profile?.verified
    ? `<span class="verified-badge" role="img" aria-label="Verificado">${icon("verified", "fill")}</span>`
    : "";
}
