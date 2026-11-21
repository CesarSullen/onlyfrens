import { haptic, showToast } from "./utils.js";

const WIDTH = 390;
const PADDING = 18;
const SCALE = 2;
const ACTION_ICON = 26;
const IMAGE_GAP = 8;
const MAX_IMAGE_HEIGHT = 460;

// Colors and sizes mirror the post card so the capture looks like what is on screen.
function readTheme() {
  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();
  const rem = parseFloat(css.fontSize) || 16;
  return {
    bg: token("--bg"),
    text: token("--text"),
    soft: token("--text-soft"),
    muted: token("--muted"),
    primary: token("--primary"),
    line: token("--line"),
    token,
    rem,
  };
}

async function loadBitmap(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("image failed");
  return createImageBitmap(await response.blob());
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

// Inline SVG icons keep their colors in CSS, so they are resolved before the markup is drawn as an image.
function svgToImage(svgEl, theme, size) {
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("fill", getComputedStyle(svgEl).color);
  clone.setAttribute("width", size * SCALE);
  clone.setAttribute("height", size * SCALE);
  const color = getComputedStyle(svgEl).color;
  const markup = clone.outerHTML
    .replace(/currentColor/g, color)
    .replace(/var\((--[\w-]+)\)/g, (_, name) => theme.token(name));

  return loadImage(URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" })));
}

function wrapLines(ctx, text, maxWidth, fonts) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = [];
    let width = 0;
    for (const token of paragraph.split(/(\s+)/).filter(Boolean)) {
      ctx.font = token.startsWith("#") ? fonts.bold : fonts.regular;
      const tokenWidth = ctx.measureText(token).width;
      if (width + tokenWidth > maxWidth && line.length && token.trim()) {
        lines.push(line);
        line = [];
        width = 0;
      }
      if (!line.length && !token.trim()) continue;
      line.push({ token, width: tokenWidth });
      width += tokenWidth;
    }
    lines.push(line);
  }
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawContained(ctx, bitmap, x, y, w, h, theme) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 12);
  ctx.clip();
  ctx.fillStyle = theme.line;
  ctx.fillRect(x, y, w, h);
  const ratio = Math.min(w / bitmap.width, h / bitmap.height);
  const dw = bitmap.width * ratio;
  const dh = bitmap.height * ratio;
  ctx.drawImage(bitmap, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function readCard(card) {
  const buttons = [...card.querySelectorAll(".post-actions .action-btn:not(.download-btn)")].map((btn) => {
    const active = btn.classList.contains("active");
    return {
      svg: btn.querySelector(active ? ".icon-filled" : ".icon-outline"),
      count: btn.querySelector(".action-count")?.textContent ?? "0",
    };
  });

  return {
    avatar: card.querySelector(".post-header .avatar")?.src,
    name: card.querySelector(".post-author")?.firstChild?.textContent.trim() ?? "",
    badge: card.querySelector(".post-author .verified-badge .icon"),
    time: card.querySelector(".post-time")?.textContent ?? "",
    text: card.querySelector(".post-text")?.textContent ?? "",
    images: [...card.querySelectorAll(".post-image")].map((img) => img.currentSrc || img.src),
    buttons,
  };
}

// Draws the post as a card (author, text, photos, counters) with the OnlyFrens mark where the download button is.
async function renderCard(card) {
  const theme = readTheme();
  await Promise.all(["400", "500", "600"].map((w) => document.fonts.load(`${w} 16px Jost`)));

  const data = readCard(card);
  const [avatar, logo, images, icons, badge] = await Promise.all([
    data.avatar ? loadBitmap(data.avatar).catch(() => null) : null,
    loadImage("./assets/opengraph/logo-blue.svg").catch(() => null),
    Promise.all(data.images.map(loadBitmap)),
    Promise.all(data.buttons.map((b) => svgToImage(b.svg, theme, ACTION_ICON))),
    data.badge ? svgToImage(data.badge, theme, 20) : null,
  ]);

  const fonts = {
    regular: `400 ${theme.rem * 1.1}px Jost, sans-serif`,
    bold: `600 ${theme.rem * 1.1}px Jost, sans-serif`,
  };
  const innerWidth = WIDTH - PADDING * 2;
  const measure = document.createElement("canvas").getContext("2d");
  const lines = data.text ? wrapLines(measure, data.text, innerWidth, fonts) : [];
  const lineHeight = theme.rem * 1.1 * 1.45;

  const columns = images.length === 2 ? 2 : 1;
  const imageWidth = (innerWidth - IMAGE_GAP * (columns - 1)) / columns;
  const imageHeights = images.map((b) => Math.min(MAX_IMAGE_HEIGHT, (imageWidth * b.height) / b.width));
  const imagesHeight = images.length ? Math.max(...imageHeights) : 0;

  const headerHeight = 50;
  const gap = 14;
  let height = PADDING + headerHeight;
  if (lines.length) height += gap + lines.length * lineHeight;
  if (imagesHeight) height += gap + imagesHeight;
  height += gap + ACTION_ICON + PADDING;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = Math.ceil(height) * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.textBaseline = "middle";

  let y = PADDING;

  // Header
  ctx.save();
  ctx.beginPath();
  ctx.arc(PADDING + 25, y + 25, 25, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = theme.line;
  ctx.fillRect(PADDING, y, 50, 50);
  if (avatar) {
    const size = Math.min(avatar.width, avatar.height);
    ctx.drawImage(avatar, (avatar.width - size) / 2, (avatar.height - size) / 2, size, size, PADDING, y, 50, 50);
  }
  ctx.restore();

  const textX = PADDING + 50 + 13;
  ctx.font = `600 ${theme.rem * 1.2}px Jost, sans-serif`;
  ctx.fillStyle = theme.text;
  ctx.fillText(data.name, textX, y + 14);
  if (badge) ctx.drawImage(badge, textX + ctx.measureText(data.name).width + 5, y + 14 - 10, 20, 20);
  ctx.font = `400 ${theme.rem * 0.95}px Jost, sans-serif`;
  ctx.fillStyle = theme.muted;
  ctx.fillText(data.time, textX, y + 38);
  y += headerHeight;

  // Text
  if (lines.length) {
    y += gap;
    lines.forEach((line, row) => {
      let x = PADDING;
      for (const { token, width } of line) {
        const isTag = token.startsWith("#");
        ctx.font = isTag ? fonts.bold : fonts.regular;
        ctx.fillStyle = isTag ? theme.primary : theme.text;
        ctx.fillText(token, x, y + row * lineHeight + lineHeight / 2);
        x += width;
      }
    });
    y += lines.length * lineHeight;
  }

  // Photos
  if (imagesHeight) {
    y += gap;
    images.forEach((bitmap, i) => {
      drawContained(ctx, bitmap, PADDING + i * (imageWidth + IMAGE_GAP), y, imageWidth, imagesHeight, theme);
    });
    y += imagesHeight;
  }

  // Counters
  y += gap;
  let x = PADDING;
  ctx.font = `400 ${theme.rem}px Jost, sans-serif`;
  ctx.fillStyle = theme.soft;
  icons.forEach((image, i) => {
    ctx.drawImage(image, x, y, ACTION_ICON, ACTION_ICON);
    ctx.textBaseline = "alphabetic";
    const count = ctx.measureText(data.buttons[i].count);
    ctx.fillText(data.buttons[i].count, x + ACTION_ICON + 9, y + ACTION_ICON / 2 + (count.actualBoundingBoxAscent - count.actualBoundingBoxDescent) / 2);
    ctx.textBaseline = "middle";
    x += ACTION_ICON + 9 + Math.max(14, ctx.measureText(data.buttons[i].count).width) + 38;
  });

  // Watermark where the download button sits
  const markFont = `600 ${theme.rem}px Jost, sans-serif`;
  ctx.font = markFont;
  ctx.fillStyle = theme.primary;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  const centerY = y + ACTION_ICON / 2;
  const metrics = ctx.measureText("OnlyFrens");
  const markWidth = metrics.width;
  // The text is centered on the logo by its real glyph box instead of the font line box
  ctx.fillText("OnlyFrens", WIDTH - PADDING, centerY + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2);
  if (logo) {
    const logoHeight = ACTION_ICON;
    const logoWidth = (logo.width / logo.height) * logoHeight;
    ctx.drawImage(logo, WIDTH - PADDING - markWidth - 6 - logoWidth, y, logoWidth, logoHeight);
  }

  return canvas;
}

export async function downloadPostCard(card) {
  haptic();
  try {
    const canvas = await renderCard(card);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("capture failed");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `onlyfrens-${Date.now()}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast("Publicación descargada");
  } catch {
    showToast("No se pudo descargar la publicación", "error");
  }
}
