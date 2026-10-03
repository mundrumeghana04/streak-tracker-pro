const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for PNG chunks
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createPngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePng(width, height, isBadge = false, isMaskable = false) {
  // RGBA buffer: (width * 4 + 1 filter byte) per row
  const rowStride = width * 4 + 1;
  const rawData = Buffer.alloc(rowStride * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * (isMaskable ? 0.48 : 0.44);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowStride;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (isBadge) {
        // Monochrome white flame badge for notification bar
        const normalizedY = (y - (cy - radius * 0.7)) / (radius * 1.4);
        const normalizedX = Math.abs(x - cx) / (radius * 0.7);
        if (normalizedY >= 0 && normalizedY <= 1 && normalizedX <= Math.sin(normalizedY * Math.PI) * (1 - normalizedY * 0.4)) {
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 255;
          rawData[pxOffset + 2] = 255;
          rawData[pxOffset + 3] = 255;
        } else {
          rawData[pxOffset] = 0;
          rawData[pxOffset + 1] = 0;
          rawData[pxOffset + 2] = 0;
          rawData[pxOffset + 3] = 0;
        }
        continue;
      }

      // App Icon with modern rounded gradient background
      let inShape = false;
      if (isMaskable) {
        inShape = true; // Maskable fills entire canvas
      } else {
        // Rounded squircle
        const cornerRadius = width * 0.22;
        const qx = Math.max(0, Math.abs(dx) - (cx - cornerRadius));
        const qy = Math.max(0, Math.abs(dy) - (cy - cornerRadius));
        inShape = (qx * qx + qy * qy) <= cornerRadius * cornerRadius;
      }

      if (inShape) {
        // Modern indigo/purple to coral gradient
        const t = (x + y) / (width + height);
        const rBg = Math.round(99 + t * (239 - 99));   // #6366f1 to #ef4444
        const gBg = Math.round(102 - t * 40);
        const bBg = Math.round(241 - t * (241 - 68));

        // Center flame highlight
        const flameY = (y - (cy - radius * 0.6)) / (radius * 1.3);
        const flameX = Math.abs(dx) / (radius * 0.55);
        const inFlame = (flameY >= 0 && flameY <= 1 && flameX <= Math.sin(flameY * Math.PI) * (1 - flameY * 0.35));

        if (inFlame) {
          // Bright gold / amber flame
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = Math.round(200 - flameY * 80);
          rawData[pxOffset + 2] = 40;
          rawData[pxOffset + 3] = 255;
        } else {
          rawData[pxOffset] = rBg;
          rawData[pxOffset + 1] = gBg;
          rawData[pxOffset + 2] = bBg;
          rawData[pxOffset + 3] = 255;
        }
      } else {
        // Transparent outside rounded corners
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // No interlace
  const ihdrChunk = createPngChunk('IHDR', ihdrData);

  // IDAT chunk (compressed pixel data)
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createPngChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, '..', 'assets', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('Generating PWA icons...');
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), generatePng(192, 192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), generatePng(512, 512));
fs.writeFileSync(path.join(iconsDir, 'maskable-512.png'), generatePng(512, 512, false, true));
fs.writeFileSync(path.join(iconsDir, 'badge-72.png'), generatePng(72, 72, true));

// Also generate SVG for crisp vector scaling
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
    <linearGradient id="flame" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#fbbf24"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="115" fill="url(#bg)"/>
  <path d="M256 100 C270 180 340 210 340 300 C340 365 295 410 256 410 C217 410 172 365 172 300 C172 230 230 180 256 100 Z" fill="url(#flame)"/>
  <path d="M256 240 C270 280 295 300 295 335 C295 365 275 385 256 385 C237 385 217 365 217 335 C217 305 240 280 256 240 Z" fill="#ffffff" opacity="0.9"/>
</svg>`;
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent, 'utf8');

console.log('Icons successfully created in assets/icons/');
