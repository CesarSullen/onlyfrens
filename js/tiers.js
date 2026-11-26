// What each verified tier unlocks for posts; the index is the tier (0 none, 1 blue, 2 gold, 3 purple).
export const TEXT_LIMIT_BY_TIER = [200, 200, 500, 1000];
export const LIFETIME_BY_TIER = [24, 24, 48, 72];
export const POST_LIFETIMES = [24, 48, 72];

// Editing the text of a post is open from the gold tier, during the first minutes only.
export const EDIT_MIN_TIER = 2;
export const EDIT_WINDOW_MS = 10 * 60 * 1000;

export function maxLifetimeFor(tier) {
  return LIFETIME_BY_TIER[tier] ?? 24;
}
