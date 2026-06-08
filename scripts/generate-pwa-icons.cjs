const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const OUT_DIR = path.join(__dirname, "..", "public", "icons");
const SCALE = 4;

const ICONS = [
  ["icon-512.png", 512, "standard"],
  ["maskable-512.png", 512, "maskable"],
  ["icon-192.png", 192, "standard"],
  ["apple-touch-icon.png", 180, "apple"],
  ["favicon-32.png", 32, "favicon"],
];

const hex = (value) => {
  const clean = value.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    255,
  ];
};

const mix = (a, b, amount) => Math.round(a + (b - a) * amount);

const setPixel = (png, x, y, color) => {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const index = (png.width * y + x) << 2;
  png.data[index] = color[0];
  png.data[index + 1] = color[1];
  png.data[index + 2] = color[2];
  png.data[index + 3] = color[3];
};

const fillRect = (png, x, y, w, h, color) => {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) setPixel(png, xx, yy, color);
  }
};

const fillCircle = (png, cx, cy, radius, color) => {
  const radiusSq = radius * radius;
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radiusSq) setPixel(png, x, y, color);
    }
  }
};

const fillRoundedRect = (png, x, y, w, h, radius, getColor) => {
  const right = x + w - 1;
  const bottom = y + h - 1;
  for (let yy = y; yy <= bottom; yy += 1) {
    for (let xx = x; xx <= right; xx += 1) {
      const qx = xx < x + radius ? x + radius : xx > right - radius ? right - radius : xx;
      const qy = yy < y + radius ? y + radius : yy > bottom - radius ? bottom - radius : yy;
      const dx = xx - qx;
      const dy = yy - qy;
      if (dx * dx + dy * dy <= radius * radius) setPixel(png, xx, yy, getColor(xx, yy));
    }
  }
};

const drawLogo = (png, size, variant) => {
  const s = size * SCALE;
  const dark = hex("#101010");
  const white = hex("#fffaf3");
  const black = hex("#050505");
  const pink = hex("#ec4899");
  const coral = hex("#fb7185");
  const amber = hex("#ffb347");
  const orangeA = hex("#ff8a1c");
  const orangeB = hex("#f97316");
  const orangeC = hex("#ec4899");

  fillRect(png, 0, 0, s, s, dark);

  const decorativeScale = variant === "favicon" ? 0 : 1;
  if (decorativeScale) {
    fillCircle(png, Math.round(s * 0.226), Math.round(s * 0.223), Math.round(s * 0.035), pink);
    fillCircle(png, Math.round(s * 0.789), Math.round(s * 0.266), Math.round(s * 0.027), coral);
    fillCircle(png, Math.round(s * 0.778), Math.round(s * 0.773), Math.round(s * 0.023), hex("#fb923c"));
  }

  const safeInset = variant === "maskable" ? 0.218 : variant === "favicon" ? 0.14 : 0.16;
  const x = Math.round(s * safeInset);
  const y = Math.round(s * (variant === "maskable" ? 0.228 : 0.195));
  const w = s - x * 2;
  const h = Math.round(s * (variant === "favicon" ? 0.72 : 0.586));
  const r = Math.round(s * (variant === "favicon" ? 0.13 : 0.148));

  fillRoundedRect(png, x, y, w, h, r, (xx, yy) => {
    const t = (xx - x + yy - y) / (w + h);
    if (t < 0.5) {
      const local = t / 0.5;
      return [
        mix(orangeA[0], orangeB[0], local),
        mix(orangeA[1], orangeB[1], local),
        mix(orangeA[2], orangeB[2], local),
        255,
      ];
    }
    const local = (t - 0.5) / 0.5;
    return [
      mix(orangeB[0], orangeC[0], local),
      mix(orangeB[1], orangeC[1], local),
      mix(orangeB[2], orangeC[2], local),
      255,
    ];
  });

  const markX = x + Math.round(w * 0.17);
  const markY = y + Math.round(h * 0.205);
  const markH = Math.round(h * 0.62);
  const stroke = Math.round(w * 0.16);
  fillRoundedRect(png, markX, markY, stroke, markH, Math.round(stroke * 0.18), () => white);

  const tX = x + Math.round(w * 0.42);
  const tW = Math.round(w * 0.42);
  const barH = Math.round(h * 0.19);
  fillRoundedRect(png, tX, markY, tW, barH, Math.round(barH * 0.22), () => white);
  fillRoundedRect(
    png,
    tX + Math.round(tW * 0.34),
    markY,
    Math.round(tW * 0.31),
    markH,
    Math.round(barH * 0.18),
    () => white,
  );

  if (variant !== "favicon") {
    fillRoundedRect(
      png,
      x + Math.round(w * 0.24),
      y + Math.round(h * 0.79),
      Math.round(w * 0.52),
      Math.round(h * 0.19),
      Math.round(h * 0.095),
      () => black,
    );
    const dotR = Math.round(h * 0.029);
    const dotY = y + Math.round(h * 0.885);
    [0.365, 0.5, 0.635].forEach((offset) => {
      fillCircle(png, x + Math.round(w * offset), dotY, dotR, white);
    });
  }

  fillRoundedRect(
    png,
    x + Math.round(w * 0.105),
    y + Math.round(h * 0.075),
    Math.round(w * 0.42),
    Math.round(h * 0.115),
    Math.round(h * 0.058),
    () => amber,
  );
};

const downsample = (source, targetSize) => {
  const target = new PNG({ width: targetSize, height: targetSize });
  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      const totals = [0, 0, 0, 0];
      for (let yy = 0; yy < SCALE; yy += 1) {
        for (let xx = 0; xx < SCALE; xx += 1) {
          const index = (source.width * (y * SCALE + yy) + (x * SCALE + xx)) << 2;
          totals[0] += source.data[index];
          totals[1] += source.data[index + 1];
          totals[2] += source.data[index + 2];
          totals[3] += source.data[index + 3];
        }
      }
      setPixel(
        target,
        x,
        y,
        totals.map((value) => Math.round(value / (SCALE * SCALE))),
      );
    }
  }
  return target;
};

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [filename, size, variant] of ICONS) {
  const source = new PNG({ width: size * SCALE, height: size * SCALE });
  drawLogo(source, size, variant);
  const target = downsample(source, size);
  fs.writeFileSync(path.join(OUT_DIR, filename), PNG.sync.write(target, { colorType: 2 }));
  console.log(`Generated ${filename}`);
}
