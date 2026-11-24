// Colors live in the CSS ([data-accent]); here only names and the community size that unlocks each one.
export const ACCENTS = [
  { id: "oceano", name: "Océano", users: 0 },
  { id: "bosque", name: "Bosque", users: 50 },
  { id: "cerezo", name: "Cerezo", users: 50 },
  { id: "coral", name: "Coral", users: 100 },
  { id: "volcan", name: "Volcán", users: 100 },
  { id: "desierto", name: "Desierto", users: 250 },
  { id: "pantano", name: "Pantano", users: 250 },
  { id: "cueva", name: "Cueva", users: 500 },
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
