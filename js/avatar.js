import { compressImage } from "./compress.js";
import { uploadImage, updateProfile } from "./api.js";

const DICEBEAR_URL = "https://api.dicebear.com/10.x/lorelei-neutral/svg";

// Uses the uploaded photo, or a generated avatar that is always the same for that username.
export function avatarSrc({ avatar_url, username, display_name } = {}) {
  if (avatar_url) return avatar_url;
  const seed = username || display_name || "onlyfrens";
  return `${DICEBEAR_URL}?seed=${encodeURIComponent(seed)}`;
}

// The version in the query makes browsers skip the previous photo they have cached.
export async function uploadAvatar(file) {
  const compressed = await compressImage(file, 256);
  const { url } = await uploadImage(compressed);
  return updateProfile({
    avatar_url: `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`,
  });
}
