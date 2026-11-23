// Gera os ícones PNG do app (sem dependências externas).
// Uso: node tools/make-icons.js
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'www', 'icons');

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).concat(h.length > 7 ? parseInt(h.slice(7, 9), 16) / 255 : 1);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function sdRoundRect(px, py, x, y, w, h, r) {
  const qx = Math.abs(px - (x + w / 2)) - w / 2 + r;
  const qy = Math.abs(py - (y + h / 2)) - h / 2 + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// fio (curva de Bézier) amostrado como polilinha
const P = [[224, 196], [280, 196], [232, 316], [288, 316]];
const wire = [];
for (let i = 0; i <= 160; i++) {
  const t = i / 160, u = 1 - t;
  wire.push([0, 1].map(k => u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]));
}
function wireDist(x, y) {
  let m = Infinity;
  for (let i = 1; i < wire.length; i++) {
    const [ax, ay] = wire[i - 1], [bx, by] = wire[i];
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l));
    m = Math.min(m, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return m;
}

function over(c, s) {
  const a = s[3], oa = a + c[3] * (1 - a);
  if (oa <= 0) return;
  for (let i = 0; i < 3; i++) c[i] = (s[i] * a + c[i] * c[3] * (1 - a)) / oa;
  c[3] = oa;
}

const C = {
  bg: hex('#D4D0C8'), grid: hex('#C2BEB6'), wire: hex('#1E1E1E'),
  plate: hex("#333333"), plateEdge: hex('#000000'), grip: hex('#F7F7F7'),
};
function node(c, x, y, nx, ny, top, bot, edge, plate) {
  const w = 140, h = 80;
  const d = sdRoundRect(x, y, nx, ny, w, h, 15);
  if (d <= 0) {
    if (d > -6) over(c, hex(edge));
    else {
      over(c, lerp(hex(top), hex(bot), (y - ny) / h));
      const pd = sdRoundRect(x, y, nx + 20, ny + 14, 100, 52, 8);
      if (pd <= 0) over(c, pd > -3 ? C.plateEdge : plate ? hex(plate) : C.plate);
    }
  }
  for (const gx of [nx, nx + w]) {
    const gd = Math.hypot(x - gx, y - (ny + h / 2));
    if (gd <= 13.5) over(c, gd <= 8.5 ? C.grip : hex(edge));
  }
}

function sample(x, y, rounded) {
  const c = [0, 0, 0, 0];
  if (rounded && sdRoundRect(x, y, 0, 0, 512, 512, 104) > 0) return c;
  over(c, C.bg);
  const gx = Math.abs(x - Math.round(x / 32) * 32), gy = Math.abs(y - Math.round(y / 32) * 32);
  if (gx <= 1.5 || gy <= 1.5) over(c, C.grid);
  if (x > 210 && x < 302 && y > 185 && y < 327 && wireDist(x, y) <= 6) over(c, C.wire);
  node(c, x, y, 84, 156, '#E2E2E2', '#A9A9A9', '#1A1A1A');
  node(c, x, y, 288, 276, '#B4E26A', '#6DAA24', '#1E4A00', '#2C5A0C');
  return c;
}

function renderIcon(size, rounded) {
  const ss = size <= 192 ? 4 : 3;
  const px = Buffer.alloc(size * size * 4);
  const k = 512 / size;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = sample((i + (sx + 0.5) / ss) * k, (j + (sy + 0.5) / ss) * k, rounded);
        r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
      }
      const o = (j * size + i) * 4;
      px[o] = a ? Math.round(r / a * 255) : 0;
      px[o + 1] = a ? Math.round(g / a * 255) : 0;
      px[o + 2] = a ? Math.round(b / a * 255) : 0;
      px[o + 3] = Math.round(a / (ss * ss) * 255);
    }
  }
  return encodePNG(size, size, px);
}

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xFFFFFFFF; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT, { recursive: true });
const jobs = [
  ['icon-192.png', 192, true],
  ['icon-512.png', 512, true],
  ['maskable-512.png', 512, false],
  ['apple-touch-icon.png', 180, false],
];
for (const [name, size, rounded] of jobs) {
  fs.writeFileSync(path.join(OUT, name), renderIcon(size, rounded));
  console.log('ok', name);
}
