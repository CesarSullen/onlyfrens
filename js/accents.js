// Colors live in the CSS ([data-accent]); here only names and the community size that unlocks each one.
export const ACCENTS = [
  { id: "oceano", name: "Océano", users: 0 },
  { id: "musgo", name: "Musgo", users: 50 },
  { id: "cerezo", name: "Cerezo", users: 100 },
  { id: "coral", name: "Coral", users: 150 },
  { id: "aurora", name: "Aurora", users: 200 },
  { id: "brasa", name: "Brasa", users: 250 },
  { id: "cosmos", name: "Cosmos", users: 400 },
  { id: "eclipse", name: "Eclipse", users: 500 },
];

const DEFAULT_ACCENT = "oceano";
const ACCENT_KEY = "onlyfrens_accent";

export function getAccent() {
  const id = localStorage.getItem(ACCENT_KEY);
  return ACCENTS.some((accent) => accent.id === id) ? id : DEFAULT_ACCENT;
}

function applyAccent(id) {
  if (id === DEFAULT_ACCENT) {
    delete document.documentElement.dataset.accent;
  } else {
    document.documentElement.dataset.accent = id;
  }
}

export function setAccent(id) {
  localStorage.setItem(ACCENT_KEY, id);
  applyAccent(id);
}

// Applied on import so the saved color is in place before the first screen paints.
applyAccent(getAccent());
