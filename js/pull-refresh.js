import { loaderHTML } from "./loader.js";

const THRESHOLD = 64;
const MAX_PULL = 110;
const MIN_SPIN_MS = 700;

// Pulling down at the top of a screen reveals the loader planet and refreshes on release.
export function initPullToRefresh({ content, canPull, onRefresh }) {
  const indicator = document.createElement("div");
  indicator.className = "ptr";
  indicator.setAttribute("aria-hidden", "true");
  indicator.innerHTML = loaderHTML();
  document.body.append(indicator);

  const rings = indicator.querySelectorAll(".loader-ring");
  let startY = null;
  let pull = 0;
  let busy = false;

  function show(distance) {
    pull = distance;
    content.style.transform = `translateY(${distance}px)`;
    indicator.style.opacity = Math.min(1, distance / 40);
    indicator.style.transform = `translate(-50%, ${distance / 2 - 28}px)`;
    rings.forEach((ring) => {
      ring.style.strokeDashoffset = busy ? "" : -(distance / THRESHOLD) * 100;
    });
  }

  function setSettling(on) {
    content.style.transition = on ? "transform 0.25s ease" : "";
    indicator.classList.toggle("settling", on);
  }

  document.addEventListener(
    "touchstart",
    (e) => {
      if (busy || e.touches.length !== 1 || window.scrollY > 0 || !canPull()) return;
      startY = e.touches[0].clientY;
    },
    { passive: true },
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) {
        startY = null;
        show(0);
        return;
      }
      e.preventDefault();
      show(Math.min(MAX_PULL, dy * 0.5));
    },
    { passive: false },
  );

  async function release() {
    if (startY === null) return;
    startY = null;
    setSettling(true);

    if (pull >= THRESHOLD) {
      busy = true;
      show(THRESHOLD);
      indicator.classList.add("refreshing");
      await Promise.all([
        Promise.resolve(onRefresh()).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS)),
      ]);
      indicator.classList.remove("refreshing");
    }

    busy = false;
    show(0);
    setTimeout(() => {
      content.style.transform = "";
      setSettling(false);
    }, 250);
  }

  document.addEventListener("touchend", release);
  document.addEventListener("touchcancel", release);
}
