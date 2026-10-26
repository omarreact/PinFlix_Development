'use strict';

// Creates a Windows .ico containing a 256px PNG without extra image packages.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const WIDTH = 256;
const HEIGHT = 256;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const header = Buffer.alloc(4); header.writeUInt32BE(data.length);
  const check = Buffer.alloc(4); check.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([header, name, data, check]);
}
function pixel(x, y) {
  const cx = x - 128; const cy = y - 128;
  const r = Math.hypot(cx, cy);
  if (r > 113) return [0, 0, 0, 0];
  const base = [19 + Math.floor(y / 30), 24 + Math.floor(x / 30), 50 + Math.floor(y / 20), 255];
  // Stylized play icon, triangle from left to right.
  if (x >= 97 && x <= 194 && y >= 65 && y <= 191) {
    const spread = (x - 97) * (58 / 97);
    if (Math.abs(y - 128) <= spread) return [146 + Math.floor(x / 14), 145 + Math.floor(y / 16), 255, 255];
  }
  if (r > 109) return [96, 104, 186, 255];
  return base;
}
const scanlines = [];
for (let y = 0; y < HEIGHT; y++) {
  const line = Buffer.alloc(1 + WIDTH * 4);
  for (let x = 0; x < WIDTH; x++) {
    const p = pixel(x, y);
    for (let c = 0; c < 4; c++) line[1 + x * 4 + c] = p[c];
  }
  scanlines.push(line);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0); ihdr.writeUInt32BE(HEIGHT, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from('89504e470d0a1a0a', 'hex'),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(Buffer.concat(scanlines))),
  chunk('IEND', Buffer.alloc(0))
]);
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 0; header[7] = 0; // width/height 256px in ICO format
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(header.length, 18);
const output = path.join(__dirname, '..', 'assets', 'icon.ico');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat([header, png]));
console.log('Created ' + output);
