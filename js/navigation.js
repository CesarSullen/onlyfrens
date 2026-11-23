import { closeModalUI } from "./utils.js";

export const OPEN_PROFILE_EVENT = "onlyfrens:open-profile";
export const OPEN_PAGE_EVENT = "onlyfrens:open-page";

// Without a username it opens the user's own profile tab.
export function openUserProfile(username) {
  closeModalUI();
  window.dispatchEvent(new CustomEvent(OPEN_PROFILE_EVENT, { detail: { username } }));
}

// Secondary pages that sit on top of the current tab: { page: "rewards" }, { page: "hashtag", tag } or { page: "post", postId }.
function openPage(detail) {
  closeModalUI();
  window.dispatchEvent(new CustomEvent(OPEN_PAGE_EVENT, { detail }));
}

export const openRewards = () => openPage({ page: "rewards" });
export const openHashtag = (tag) => openPage({ page: "hashtag", tag });
export const openPost = (postId) => openPage({ page: "post", postId });
