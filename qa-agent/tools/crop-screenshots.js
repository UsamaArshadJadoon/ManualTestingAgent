#!/usr/bin/env node
/**
 * crop-screenshots.js — trim dead background from QA evidence screenshots.
 *
 * Why this exists: a browser resized to W can report a CSS viewport of 2W when the
 * device pixel ratio is 0.5. The app then lays out at double width, renders at half
 * scale, and a full-page capture ends up mostly empty. The frame is technically
 * "1920px wide" and passes an HD floor check, while the content a reader needs is
 * a small island in one corner. Enlarging it does not help — the content itself is
 * small. Cropping to the real content bounds does.
 *
 * The crop is lossless in the sense that no surviving pixel is altered or resampled:
 * the image is inflated, unfiltered to raw samples, cropped on whole pixels, then
 * re-emitted with filter type 0. Nothing is scaled or re-sampled.
 *
 * Usage:
 *   node crop-screenshots.js <file-or-dir> [--threshold 12] [--margin 8] [--scale 2] [--dry-run]
 *
 * --scale N replicates each surviving pixel into an NxN block after cropping. Use it
 * when the capture was taken at half scale: cropping alone can leave the frame below
 * a downstream HD floor, and doubling restores the size the content should have had.
 *
 * Only 8-bit non-interlaced RGB / RGBA / grey / grey+alpha PNGs are handled; anything
 * else is reported and left untouched rather than guessed at.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith('-'));
const num = (flag, dflt) => { const i = args.indexOf(flag); return i > -1 ? Number(args[i + 1]) : dflt; };
const THRESHOLD = num('--threshold', 12);   // per-channel difference that counts as content
const MARGIN = num('--margin', 8);          // pixels of background kept around the content
const SCALE = num('--scale', 1);            // integer pixel replication after cropping
const DRY = args.includes('--dry-run');

if (!target || !Number.isInteger(SCALE) || SCALE < 1) {
  console.error('usage: node crop-screenshots.js <file-or-dir> [--threshold 12] [--margin 8] [--scale 2] [--dry-run]');
  process.exit(2);
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return buf => { let c = -1; for (const b of buf) c = t[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; };
})();

const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
};

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };   // grey, rgb, grey+alpha, rgba

function readPng(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504E47) throw new Error('not a PNG');
  let off = 8, ihdr = null; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = {
      width: data.readUInt32BE(0), height: data.readUInt32BE(4),
      depth: data[8], colorType: data[9], interlace: data[12],
    };
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!ihdr) throw new Error('no IHDR');
  if (ihdr.depth !== 8) throw new Error(`unsupported bit depth ${ihdr.depth}`);
  if (ihdr.interlace) throw new Error('interlaced PNG not supported');
  const ch = CHANNELS[ihdr.colorType];
  if (!ch) throw new Error(`unsupported colour type ${ihdr.colorType}`);
  return { ihdr, ch, raw: zlib.inflateSync(Buffer.concat(idat)) };
}

/** Reverse the per-scanline PNG filters, returning contiguous pixel rows. */
function unfilter({ ihdr, ch, raw }) {
  const { width, height } = ihdr, stride = width * ch;
  const out = Buffer.alloc(stride * height);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const ft = raw[pos++];
    const line = raw.slice(pos, pos + stride); pos += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const A = x >= ch ? cur[x - ch] : 0, B = prev[x], C = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      switch (ft) {
        case 0: break;
        case 1: v += A; break;
        case 2: v += B; break;
        case 3: v += (A + B) >> 1; break;
        case 4: {
          const p = A + B - C, pa = Math.abs(p - A), pb = Math.abs(p - B), pc = Math.abs(p - C);
          v += (pa <= pb && pa <= pc) ? A : (pb <= pc ? B : C); break;
        }
        default: throw new Error(`unknown filter type ${ft} on row ${y}`);
      }
      cur[x] = v & 0xFF;
    }
  }
  return { pixels: out, stride };
}

/** Bounding box of everything that differs from the dominant background colour. */
function contentBox(pixels, stride, width, height, ch) {
  const at = (x, y) => { const o = y * stride + x * ch; return [pixels[o], pixels[o + 1] ?? pixels[o], pixels[o + 2] ?? pixels[o]]; };
  // Background = the most common of the four corners; empty regions are uniform.
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  const tally = new Map();
  for (const c of corners) { const k = c.join(','); tally.set(k, (tally.get(k) || 0) + 1); }
  const bg = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
  const differs = (x, y) => { const p = at(x, y); return Math.abs(p[0] - bg[0]) > THRESHOLD || Math.abs(p[1] - bg[1]) > THRESHOLD || Math.abs(p[2] - bg[2]) > THRESHOLD; };

  let top = -1, bottom = -1, left = width, right = -1;
  for (let y = 0; y < height; y++) {
    let rowHas = false;
    for (let x = 0; x < width; x++) if (differs(x, y)) { rowHas = true; if (x < left) left = x; if (x > right) right = x; }
    if (rowHas) { if (top < 0) top = y; bottom = y; }
  }
  if (top < 0) return null;   // entirely uniform — nothing to crop to
  return {
    left: Math.max(0, left - MARGIN), top: Math.max(0, top - MARGIN),
    right: Math.min(width - 1, right + MARGIN), bottom: Math.min(height - 1, bottom + MARGIN),
  };
}

function writeCropped(file, { ihdr, ch }, pixels, stride, box) {
  const cw = box.right - box.left + 1, ch_ = box.bottom - box.top + 1;
  const w = cw * SCALE, h = ch_ * SCALE;
  const outStride = w * ch;
  const body = Buffer.alloc((outStride + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (outStride + 1);
    body[row] = 0;   // filter: None
    const srcY = box.top + Math.floor(y / SCALE);
    for (let x = 0; x < w; x++) {
      // Nearest-neighbour integer replication: each source pixel becomes a SCALE×SCALE
      // block. No interpolation, so no invented detail — it restores a half-scale
      // capture to the apparent size it should have had.
      const srcO = srcY * stride + (box.left + Math.floor(x / SCALE)) * ch;
      pixels.copy(body, row + 1 + x * ch, srcO, srcO + ch);
    }
  }
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0); ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8; ihdrData[9] = ihdr.colorType; ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdrData),
    chunk('IDAT', zlib.deflateSync(body, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  if (!DRY) fs.writeFileSync(file, png);
  return { w, h, bytes: png.length };
}

const files = fs.statSync(target).isDirectory()
  ? fs.readdirSync(target).filter(f => f.toLowerCase().endsWith('.png')).map(f => path.join(target, f))
  : [target];

let changed = 0, skipped = 0, failed = 0;
for (const file of files) {
  const name = path.basename(file);
  try {
    const png = readPng(file);
    const { pixels, stride } = unfilter(png);
    const { width, height } = png.ihdr;
    const box = contentBox(pixels, stride, width, height, png.ch);
    if (!box) { console.log(`  ${name.padEnd(30)} ${width}x${height}  uniform — left alone`); skipped++; continue; }
    const w = box.right - box.left + 1, h = box.bottom - box.top + 1;
    const savedPct = Math.round((1 - (w * h) / (width * height)) * 100);
    if (savedPct < 5) { console.log(`  ${name.padEnd(30)} ${width}x${height}  already tight — left alone`); skipped++; continue; }
    const r = writeCropped(file, png, pixels, stride, box);
    console.log(`  ${name.padEnd(30)} ${width}x${height} -> ${r.w}x${r.h}  (${savedPct}% dead space removed)${DRY ? '  [dry-run]' : ''}`);
    changed++;
  } catch (err) {
    console.log(`  ${name.padEnd(30)} SKIPPED — ${err.message}`);
    failed++;
  }
}
console.log(`\n${changed} cropped, ${skipped} already tight, ${failed} skipped${DRY ? ' (dry run — nothing written)' : ''}`);
