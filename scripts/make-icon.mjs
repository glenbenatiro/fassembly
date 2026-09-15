// Generates assets/icon.ico, the Windows application icon.
//
// The icon is the same mark the app header draws (see `Mark` in
// src/renderer/components/Nav.tsx): three voices converging into one assembled
// record, in the paper & ink palette. Drawing it here from the same numbers,
// rather than exporting a one-off from a design tool, means the Start menu tile
// and the running window stay the same product when the mark changes.
//
// Regenerate with `npm run icon` and commit the result - the build reads the
// .ico, it does not run this script.
//
// No image library: every shape in the mark is a rounded rect, a capsule or a
// circle, so each one has an exact signed-distance function and antialiasing is
// just the coverage of that distance across a pixel.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'icon.ico');

// Palette, from tailwind.config.js. The tile is a shade of `paper`, lit slightly
// from the top so a flat square still reads as a sheet.
const PAPER_TOP = '#FBF6EC';
const PAPER_BOTTOM = '#F0E7D7';
const RIM = '#D9CBB3'; // deeper than `line`, so the tile keeps an edge on white
const PINE = '#2F5D50';

// The mark, in the 26-unit space of the Nav component's viewBox.
const ROWS = [
  { y: 6, x2: 17, dot: '#9B4722' }, // claret
  { y: 13, x2: 20, dot: '#3A4A7A' }, // ink-blue
  { y: 20, x2: 17, dot: '#6D3B5E' }, // plum
];
const X1 = 5;
const STROKE = 2;
const DOT_R = 2.4;
const HUB = { x: 21, y: 13, r: 3 };

// Bounds of the drawn mark - the caps and dots, not the viewBox, so the tile's
// padding is padding around ink rather than around empty space.
const BOX = { x0: X1 - DOT_R, y0: 6 - DOT_R, x1: HUB.x + HUB.r, y1: 20 + DOT_R };

// Every size Windows asks for, from the 16px list view up to the 256px jumbo.
const SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

/** Distance to a line segment grown by `r` - a stroke with round caps. */
function sdCapsule(px, py, ax, ay, bx, by, r) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp01(((px - ax) * dx + (py - ay) * dy) / len2);
  return Math.hypot(px - ax - t * dx, py - ay - t * dy) - r;
}

function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Straight-alpha source-over, in place. */
function over(buf, i, color, a) {
  const da = buf[i + 3];
  const out = a + da * (1 - a);
  if (out <= 0) return;
  const keep = (da * (1 - a)) / out;
  const add = a / out;
  buf[i] = color[0] * add + buf[i] * keep;
  buf[i + 1] = color[1] * add + buf[i + 1] * keep;
  buf[i + 2] = color[2] * add + buf[i + 2] * keep;
  buf[i + 3] = out;
}

function draw(size) {
  const px = new Float64Array(size * size * 4);
  const half = size / 2;

  // Paint one shape: coverage is how far the pixel centre sits inside the edge.
  const paint = (sdf, colorAt) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cx = x + 0.5;
        const cy = y + 0.5;
        const a = clamp01(0.5 - sdf(cx, cy));
        if (a > 0) over(px, (y * size + x) * 4, colorAt(cy), a);
      }
    }
  };

  // The tile. Below 32px a rim would eat the whole edge, so it is dropped.
  const radius = size * 0.185;
  const rim = size >= 32 ? Math.max(1, Math.round(size * 0.018)) : 0;
  const top = rgb(PAPER_TOP);
  const bottom = rgb(PAPER_BOTTOM);
  const paper = (y) => {
    const t = y / size;
    return [0, 1, 2].map((i) => top[i] + (bottom[i] - top[i]) * t);
  };
  if (rim > 0) {
    const rimColor = rgb(RIM);
    paint((x, y) => sdRoundRect(x, y, half, half, half, half, radius), () => rimColor);
  }
  paint(
    (x, y) => sdRoundRect(x, y, half, half, half - rim, half - rim, radius - rim),
    paper,
  );

  // Fit the mark into the tile. Small icons get less padding, buying back a
  // fraction of a pixel per row where every fraction shows.
  const tiny = size <= 32;
  const pad = size <= 20 ? 0.07 : size <= 32 ? 0.09 : 0.155;
  const boxW = size * (1 - 2 * pad);
  const scale = Math.min(boxW / (BOX.x1 - BOX.x0), boxW / (BOX.y1 - BOX.y0));
  const ox = half - ((BOX.x0 + BOX.x1) / 2) * scale;
  const oy = half - ((BOX.y0 + BOX.y1) / 2) * scale;
  const tx = (x) => ox + x * scale;
  const ty = (y) => oy + y * scale;

  // At 16 and 20px a faithful 2-unit stroke lands near one pixel and greys out
  // to nothing, so small frames get a floor under the stroke and a tighter
  // dot-to-stroke ratio - fatten the dots at the same 2.4x and they swallow the
  // gaps between the rows. Above 32px the mark keeps its own proportions.
  const sw = Math.max(STROKE * scale, tiny ? size * 0.095 : 0) / 2;
  const dotR = Math.max(DOT_R * scale, sw * (tiny ? 2 : 2.4));
  const hubR = Math.max(HUB.r * scale, sw * (tiny ? 2.5 : 3));

  const pine = rgb(PINE);
  for (const row of ROWS) {
    paint(
      (x, y) => sdCapsule(x, y, tx(X1), ty(row.y), tx(row.x2), ty(row.y), sw),
      () => pine,
    );
  }
  for (const row of ROWS) {
    const dot = rgb(row.dot);
    paint((x, y) => sdCircle(x, y, tx(X1), ty(row.y), dotR), () => dot);
  }
  paint((x, y) => sdCircle(x, y, tx(HUB.x), ty(HUB.y), hubR), () => pine);

  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < px.length; i++) out[i] = Math.round(px[i] * 255);
  return out; // RGBA, top-down
}

// --- PNG ---------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- BMP (the DIB an .ico wants: bottom-up BGRA, plus a 1bpp AND mask) --------

function encodeDib(size, rgba) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // colour rows + mask rows
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(size * size * 4, 20);

  const xor = Buffer.alloc(size * size * 4);
  const maskStride = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(maskStride * size);
  for (let y = 0; y < size; y++) {
    const src = y * size * 4;
    const dst = (size - 1 - y) * size * 4; // bottom-up
    const maskRow = (size - 1 - y) * maskStride;
    for (let x = 0; x < size; x++) {
      const s = src + x * 4;
      const d = dst + x * 4;
      xor[d] = rgba[s + 2];
      xor[d + 1] = rgba[s + 1];
      xor[d + 2] = rgba[s];
      xor[d + 3] = rgba[s + 3];
      // 1 marks a transparent pixel for the shells that still honour the mask.
      if (rgba[s + 3] === 0) mask[maskRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return Buffer.concat([header, xor, mask]);
}

// --- ICO ---------------------------------------------------------------------

function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // an icon, not a cursor
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  entries.forEach((entry, i) => {
    const at = i * 16;
    dir[at] = entry.size >= 256 ? 0 : entry.size; // 0 means 256
    dir[at + 1] = entry.size >= 256 ? 0 : entry.size;
    dir.writeUInt16LE(1, at + 4); // planes
    dir.writeUInt16LE(32, at + 6); // bits per pixel
    dir.writeUInt32LE(entry.data.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += entry.data.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.data)]);
}

function build() {
  const entries = SIZES.map((size) => {
    const rgba = draw(size);
    // Only the 256 frame is PNG, the convention every icon tool follows. The
    // shell reads a PNG frame at any size, but GDI+ does not decode one at all,
    // so anything smaller stays an uncompressed DIB and every Windows API can
    // read it. That costs a few hundred KB and buys back the older tooling.
    return { size, data: size >= 256 ? encodePng(size, rgba) : encodeDib(size, rgba) };
  });

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, encodeIco(entries));
  const kb = entries.reduce((n, e) => n + e.data.length, 0) / 1024;
  console.log(
    `wrote ${path.relative(ROOT, OUT)} - ${SIZES.length} sizes ` +
      `(${SIZES.join(', ')}), ${kb.toFixed(0)} KB`,
  );
}

// Guarded so a preview can import `draw` without rewriting the icon.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  build();
}

export { draw, encodePng, SIZES };
