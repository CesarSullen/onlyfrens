import { escapeHTML } from "./utils.js";

// Same pattern as the backend, so what is highlighted is what gets indexed.
const HASHTAG_REGEX = /#([\p{L}\p{N}_]{1,30})/gu;

export function extractHashtags(text) {
  const tags = [...text.matchAll(HASHTAG_REGEX)].map((m) => m[1].normalize("NFC").toLowerCase());
  return [...new Set(tags)];
}

// Escapes the text and turns every #tag into a tappable button.
export function linkifyHashtags(text) {
  let html = "";
  let last = 0;

  for (const match of text.matchAll(HASHTAG_REGEX)) {
    html += escapeHTML(text.slice(last, match.index));
    const tag = match[1].normalize("NFC").toLowerCase();
    html += `<button type="button" class="hashtag" data-tag="${escapeHTML(tag)}">${escapeHTML(match[0])}</button>`;
    last = match.index + match[0].length;
  }

  return html + escapeHTML(text.slice(last));
}
