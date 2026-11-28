// What each verified tier unlocks for posts; the index is the tier (0 none, 1 blue, 2 gold, 3 purple).
export const TEXT_LIMIT_BY_TIER = [200, 200, 500, 1000];
export const POST_LIFETIMES = [24, 48, 72];

// Editing the text of a post is open from 30 friends, during the first minutes only.
export const EDIT_MIN_FRIENDS = 30;
export const LIFETIME_48_MIN_FRIENDS = 35;
export const EDIT_WINDOW_MS = 10 * 60 * 1000;

// 48 hours from 35 friends and 72 with the amethyst tier.
export function maxLifetimeFor(tier, friendCount) {
  if (tier >= 3) return 72;
  return friendCount >= LIFETIME_48_MIN_FRIENDS ? 48 : 24;
}

// Adding a song to a thought is a topaz tier reward.
export const MUSIC_MIN_TIER = 2;
