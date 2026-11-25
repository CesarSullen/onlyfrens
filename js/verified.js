import { icon } from "./icons.js";

const TIER_LABELS = { 1: "Verificado zafiro", 2: "Verificado topacio", 3: "Verificado amatista" };

// The tier colors the badge: 1 sapphire (blue), 2 topaz (gold, 25 friends), 3 amethyst (purple, 50 friends).
export function verifiedBadgeHTML(profile) {
  const tier = profile?.verified_tier || (profile?.verified ? 1 : 0);
  return tier
    ? `<span class="verified-badge tier-${tier}" role="img" aria-label="${TIER_LABELS[tier]}">${icon("verified", "fill")}</span>`
    : "";
}
