// One preview at a time, streamed from Apple and never stored.
let audio = null;
let anchor = null;

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

// Resolves false when the browser blocks autoplay; the vinyl can then be tapped to play.
export async function playMusic(el) {
  const url = el.dataset.preview;
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
    return false;
  }
  if (audio === current) mark(true);
  return true;
}

export function toggleMusic(el) {
  if (anchor === el && audio && !audio.paused) {
    stopMusic();
    return Promise.resolve(false);
  }
  return playMusic(el);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopMusic();
});

export function playingUrl() {
  return audio && !audio.paused ? audio.src : null;
}
