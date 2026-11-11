export function loaderHTML() {
  return `
    <div class="loader" role="status" aria-label="Cargando">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <clipPath id="loader-back"><rect x="0" y="0" width="100" height="50" /></clipPath>
          <clipPath id="loader-front"><rect x="0" y="50" width="100" height="50" /></clipPath>
        </defs>
        <g transform="rotate(-18 50 50)">
          <g clip-path="url(#loader-back)"><ellipse class="loader-ring" cx="50" cy="50" rx="46" ry="13" pathLength="100" /></g>
          <circle class="loader-planet" cx="50" cy="50" r="22" />
          <g clip-path="url(#loader-front)"><ellipse class="loader-ring" cx="50" cy="50" rx="46" ry="13" pathLength="100" /></g>
        </g>
      </svg>
    </div>`;
}

export function removeLoader(root) {
  root.querySelector(".loader")?.remove();
}
