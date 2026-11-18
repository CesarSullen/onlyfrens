import { icon } from "./icons.js";

const TIER_LABELS = { 1: "Verificado", 2: "Verificado dorado", 3: "Verificado morado" };

// The tier colors the badge: 1 blue, 2 gold (25 friends), 3 purple (50 friends).
export function verifiedBadgeHTML(profile) {
  const tier = profile?.verified_tier || (profile?.verified ? 1 : 0);
  return tier
    ? `<span class="verified-badge tier-${tier}" role="img" aria-label="${TIER_LABELS[tier]}">${icon("verified", "fill")}</span>`
    : "";
}
