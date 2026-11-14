const DICEBEAR_URL = "https://api.dicebear.com/10.x/lorelei-neutral/svg";

// Uses the uploaded photo, or a generated avatar that is always the same for that username.
export function avatarSrc({ avatar_url, username, display_name } = {}) {
  if (avatar_url) return avatar_url;
  const seed = username || display_name || "onlyfrens";
  return `${DICEBEAR_URL}?seed=${encodeURIComponent(seed)}`;
}
