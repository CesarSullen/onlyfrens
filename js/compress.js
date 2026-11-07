const MAX_WIDTH = 1080;
const INITIAL_QUALITY = 0.75;
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.15;
const MAX_ATTEMPTS = 3;
const TARGET_MAX_BYTES = 300 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", quality);
  });
}

export async function compressImage(file, maxWidth = MAX_WIDTH) {
  const img = await loadImage(file);

  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);

  let quality = INITIAL_QUALITY;
  let blob = await canvasToBlob(canvas, quality);

  let attempts = 1;
  while (blob.size > TARGET_MAX_BYTES && quality > MIN_QUALITY && attempts < MAX_ATTEMPTS) {
    quality -= QUALITY_STEP;
    blob = await canvasToBlob(canvas, quality);
    attempts += 1;
  }

  return new File([blob], "post-image.webp", { type: "image/webp" });
}
