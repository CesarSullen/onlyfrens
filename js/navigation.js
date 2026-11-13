import { closeModalUI } from "./utils.js";

export const OPEN_PROFILE_EVENT = "onlyfrens:open-profile";

// Without a username it opens the user's own profile tab.
export function openUserProfile(username) {
  closeModalUI();
  window.dispatchEvent(new CustomEvent(OPEN_PROFILE_EVENT, { detail: { username } }));
}
