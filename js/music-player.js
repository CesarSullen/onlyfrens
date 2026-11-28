// One preview at a time, streamed from Apple and never stored.
let audio = null;
let anchor = null;
const PAUSE_MEMORY_MS = 4000;

// The song the user paused by hand, so a refresh of the profile doesn't start it again.
let pausedUrl = null;
let pausedAt = 0;

function mark(on) {
  document.querySelectorAll(".thought-cloud.playing").forEach((el) => el.classList.remove("playing"));
  if (on && anchor) anchor.classList.add("playing");
}

export function stopMusic() {
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
  }
  audio = null;
  anchor = null;
  mark(false);
}

// Autoplay is often blocked by the browser; the next tap anywhere then starts the song.
function playOnNextTap(el) {
  const start = () => {
    if (el.isConnected && !audio) playMusic(el);
  };
  document.addEventListener("pointerup", start, { once: true });
}

// Resolves false when the browser blocks autoplay; the vinyl can then be tapped to play.
export async function playMusic(el, { auto = false } = {}) {
  const url = el.dataset.preview;
  if (auto && url === pausedUrl && Date.now() - pausedAt < PAUSE_MEMORY_MS) return false;
  pausedUrl = null;
  if (audio && audio.src === url && !audio.paused) {
    anchor = el;
    mark(true);
    return true;
  }

  stopMusic();
  const current = new Audio(url);
  audio = current;
  anchor = el;
  current.addEventListener("ended", () => {
    if (audio === current) stopMusic();
  });
  // The preview stops by itself once the cloud that started it leaves the screen.
  current.addEventListener("timeupdate", () => {
    if (audio === current && !anchor.isConnected) stopMusic();
  });

  try {
    await current.play();
  } catch {
    if (audio === current) stopMusic();
    if (auto) playOnNextTap(el);
    return false;
  }
  if (audio === current) mark(true);
  return true;
}

export function toggleMusic(el) {
  if (anchor === el && audio && !audio.paused) {
    pausedUrl = el.dataset.preview;
    pausedAt = Date.now();
    stopMusic();
    return Promise.resolve(false);
  }
  return playMusic(el);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopMusic();
});

