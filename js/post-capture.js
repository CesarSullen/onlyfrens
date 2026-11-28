import { haptic, showToast } from "./utils.js";

const WIDTH = 390;
const OUTER = 20;
const PADDING = 16;
const SCALE = 2;
const CARD_RADIUS = 14;
const AVATAR = 38;
const LOGO_HEIGHT = 22;
const IMAGE_GAP = 8;
const MAX_IMAGE_HEIGHT = 460;
const GAP = 12;
const FOOTER = 16;
const INK = "#1b1b22";
const INK_SOFT = "rgba(27, 27, 34, 0.6)";
const FALLBACK_COLORS = [
  [11, 138, 254],
  [160, 130, 240],
];
const LOGO_URL = "./assets/opengraph/logo-blue.svg";
const LOGO_BASE_COLOR = "#0b8afe";

const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Browsers can't turn an SVG blob into a bitmap (the generated avatars are SVG), so those go through an image element.
async function loadBitmap(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("image failed");
  const blob = await response.blob();
  if (blob.type !== "image/svg+xml") return createImageBitmap(blob);

  const image = await loadImage(URL.createObjectURL(blob));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  canvas.getContext("2d").drawImage(image, 0, 0, 256, 256);
  return canvas;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

// The logo file is blue, so its color is swapped before it is drawn on the light card.
async function loadLogo() {
  const response = await fetch(LOGO_URL);
  if (!response.ok) throw new Error("logo failed");
  const markup = (await response.text()).replaceAll(LOGO_BASE_COLOR, INK);
  return loadImage(URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" })));
}

// Inline SVG icons keep their colors in CSS, so they are resolved before the markup is drawn as an image.
function svgToImage(svgEl, size) {
  const clone = svgEl.cloneNode(true);
  const color = getComputedStyle(svgEl).color;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("fill", color);
  clone.setAttribute("width", size * SCALE);
  clone.setAttribute("height", size * SCALE);
  const markup = clone.outerHTML.replace(/currentColor/g, color).replace(/var\((--[\w-]+)\)/g, (_, name) => token(name));

  return loadImage(URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" })));
}

const mix = (a, b, amount) => a.map((value, i) => value + (b[i] - value) * amount);
const toCss = (rgb) => `rgb(${rgb.map(Math.round).join(",")})`;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Picks the two most prominent colors of the image, favoring saturated ones over greys.
function pickColors(bitmap) {
  if (!bitmap) return FALLBACK_COLORS;
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const key = ((data[i] >> 5) << 6) | ((data[i + 1] >> 5) << 3) | (data[i + 2] >> 5);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
    bucket.r += data[i];
    bucket.g += data[i + 1];
    bucket.b += data[i + 2];
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const ranked = [...buckets.values()]
    .map(({ r, g, b, count }) => {
      const rgb = [r / count, g / count, b / count];
      const max = Math.max(...rgb);
      const saturation = max ? (max - Math.min(...rgb)) / max : 0;
      const usable = max / 255 > 0.15 && !(max / 255 > 0.95 && saturation < 0.1);
      return { rgb, weight: usable ? count * (0.2 + saturation) : 0 };
    })
    .filter((color) => color.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  if (!ranked.length) return FALLBACK_COLORS;
  const first = ranked[0].rgb;
  const second = ranked.find((color) => distance(color.rgb, first) > 90)?.rgb ?? mix(first, FALLBACK_COLORS[1], 0.5);
  return [first, second];
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text.length;
  while (cut > 1 && ctx.measureText(`${text.slice(0, cut)}…`).width > maxWidth) cut -= 1;
  return `${text.slice(0, cut)}…`;
}

function wrapLines(ctx, text, maxWidth, fonts) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = [];
    let width = 0;
    for (const word of paragraph.split(/(\s+)/).filter(Boolean)) {
      ctx.font = word.startsWith("#") ? fonts.bold : fonts.regular;
      const wordWidth = ctx.measureText(word).width;
      if (width + wordWidth > maxWidth && line.length && word.trim()) {
        lines.push(line);
        line = [];
        width = 0;
      }
      if (!line.length && !word.trim()) continue;
      line.push({ word, width: wordWidth });
      width += wordWidth;
    }
    lines.push(line);
  }
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawContained(ctx, bitmap, x, y, w, h) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 10);
  ctx.clip();
  ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
  ctx.fillRect(x, y, w, h);
  const ratio = Math.min(w / bitmap.width, h / bitmap.height);
  const dw = bitmap.width * ratio;
  const dh = bitmap.height * ratio;
  ctx.drawImage(bitmap, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function readCard(card) {
  return {
    avatar: card.querySelector(".post-header .avatar")?.src,
    name: card.querySelector(".post-author")?.firstChild?.textContent.trim() ?? "",
    badge: card.querySelector(".post-author .verified-badge .icon"),
    time: card.querySelector(".post-time")?.textContent ?? "",
    created: card.dataset.created,
    text: card.querySelector(".post-text")?.textContent ?? "",
    images: [...card.querySelectorAll(".post-image")].map((img) => img.currentSrc || img.src),
  };
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

// Draws the post on a glass card over a gradient taken from its photo, with the planet and the app name as signature.
async function renderCard(card) {
  await Promise.all(["400", "600"].map((w) => document.fonts.load(`${w} 16px Jost`)));
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

  const data = readCard(card);
  const [avatar, logo, images, badge] = await Promise.all([
    data.avatar ? loadBitmap(data.avatar).catch(() => null) : null,
    loadLogo().catch(() => null),
    Promise.all(data.images.map(loadBitmap)),
    data.badge ? svgToImage(data.badge, 18) : null,
  ]);

  const [colorA, colorB] = pickColors(images[0] ?? avatar);
  const white = [255, 255, 255];
  const gradientA = toCss(mix(colorA, white, 0.5));
  const gradientB = toCss(mix(colorB, white, 0.5));

  const fonts = {
    regular: `400 ${rem * 1.05}px Jost, sans-serif`,
    bold: `600 ${rem * 1.05}px Jost, sans-serif`,
  };
  const cardWidth = WIDTH - OUTER * 2;
  const innerWidth = cardWidth - PADDING * 2;
  const measure = document.createElement("canvas").getContext("2d");
  const lines = data.text ? wrapLines(measure, data.text, innerWidth, fonts) : [];
  const lineHeight = rem * 1.05 * 1.45;

  const columns = images.length === 2 ? 2 : 1;
  const imageWidth = (innerWidth - IMAGE_GAP * (columns - 1)) / columns;
  const imageHeights = images.map((b) => Math.min(MAX_IMAGE_HEIGHT, (imageWidth * b.height) / b.width));
  const imagesHeight = images.length ? Math.max(...imageHeights) : 0;

  let cardHeight = PADDING + AVATAR;
  if (lines.length) cardHeight += GAP + lines.length * lineHeight;
  if (imagesHeight) cardHeight += GAP + imagesHeight;
  cardHeight += GAP + FOOTER + PADDING;
  const height = Math.ceil(cardHeight + OUTER * 2);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  const gradient = ctx.createLinearGradient(0, 0, WIDTH, height);
  gradient.addColorStop(0, gradientA);
  gradient.addColorStop(1, gradientB);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, height);

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  roundRect(ctx, OUTER, OUTER, cardWidth, cardHeight, CARD_RADIUS);
  ctx.fill();
  ctx.restore();

  ctx.textBaseline = "middle";
  const left = OUTER + PADDING;
  const right = OUTER + cardWidth - PADDING;
  let y = OUTER + PADDING;

  // Header
  ctx.save();
  ctx.beginPath();
  ctx.arc(left + AVATAR / 2, y + AVATAR / 2, AVATAR / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fillRect(left, y, AVATAR, AVATAR);
  if (avatar) {
    const size = Math.min(avatar.width, avatar.height);
    ctx.drawImage(avatar, (avatar.width - size) / 2, (avatar.height - size) / 2, size, size, left, y, AVATAR, AVATAR);
  }
  ctx.restore();

  const logoWidth = logo ? (logo.width / logo.height) * LOGO_HEIGHT : 0;
  if (logo) ctx.drawImage(logo, right - logoWidth, y + 1, logoWidth, LOGO_HEIGHT);

  const textX = left + AVATAR + 12;
  const badgeSpace = badge ? 23 : 0;
  const nameMax = right - logoWidth - 12 - textX - badgeSpace;
  ctx.font = `600 ${rem * 1.1}px Jost, sans-serif`;
  ctx.fillStyle = INK;
  const name = fitText(ctx, data.name, nameMax);
  ctx.fillText(name, textX, y + 11);
  if (badge) ctx.drawImage(badge, textX + ctx.measureText(name).width + 5, y + 11 - 9, 18, 18);
  ctx.font = `400 ${rem * 0.9}px Jost, sans-serif`;
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(data.time, textX, y + 30);
  y += AVATAR;

  // Text
  if (lines.length) {
    y += GAP;
    ctx.fillStyle = INK;
    lines.forEach((line, row) => {
      let x = left;
      for (const { word, width } of line) {
        ctx.font = word.startsWith("#") ? fonts.bold : fonts.regular;
        ctx.fillText(word, x, y + row * lineHeight + lineHeight / 2);
        x += width;
      }
    });
    y += lines.length * lineHeight;
  }

  // Photos
  if (imagesHeight) {
    y += GAP;
    images.forEach((bitmap, i) => {
      drawContained(ctx, bitmap, left + i * (imageWidth + IMAGE_GAP), y, imageWidth, imagesHeight);
    });
    y += imagesHeight;
  }

  // Footer
  y += GAP;
  ctx.font = `400 ${rem * 0.85}px Jost, sans-serif`;
  ctx.fillStyle = INK_SOFT;
  ctx.textAlign = "left";
  ctx.fillText(formatDate(data.created), left, y + FOOTER / 2);
  ctx.font = `600 ${rem}px Jost, sans-serif`;
  ctx.fillStyle = INK;
  ctx.textAlign = "right";
  ctx.fillText("onlyfrens", right, y + FOOTER / 2);

  return canvas;
}

// Shares the card as an image through the system sheet; browsers without file sharing get a download.
export async function sharePostCard(card) {
  haptic();
  try {
    const canvas = await renderCard(card);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("capture failed");
    const file = new File([blob], `onlyfrens-${Date.now()}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch (error) {
        if (error.name !== "AbortError") throw error;
      }
      return;
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `onlyfrens-${Date.now()}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast("Imagen guardada");
  } catch {
    showToast("No se pudo compartir la publicación", "error");
  }
}
