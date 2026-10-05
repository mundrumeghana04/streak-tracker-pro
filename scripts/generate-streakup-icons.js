// scripts/generate-streakup-icons.js
// Generates official StreakUp PWA icons from the user's uploaded master icon image

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_IMAGE = 'C:/Users/mundr/.gemini/antigravity/brain/913a6c53-f8c4-4adb-9d43-288e83718618/.user_uploaded/media_1791213148111.jpg';
const ICONS_DIR = path.join(__dirname, '..', 'assets', 'icons');
const ROOT_DIR = path.join(__dirname, '..');

if (!fs.existsSync(SOURCE_IMAGE)) {
  console.error('Source image not found at:', SOURCE_IMAGE);
  process.exit(1);
}

async function prepareBaseImage() {
  console.log(`Loading attached master icon from: ${SOURCE_IMAGE}`);
  const { data, info } = await sharp(SOURCE_IMAGE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = 4;

  // BFS Flood-fill from the four corners to make outer white background transparent
  const visited = new Uint8Array(width * height);
  const queue = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1]
  ];

  queue.forEach(([x, y]) => {
    visited[y * width + x] = 1;
  });

  let head = 0;
  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const idx = (cy * width + cx) * channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    // If near white, mark transparent and traverse neighbors
    if (r > 235 && g > 235 && b > 235) {
      data[idx + 3] = 0; // Transparent

      const neighbors = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1]
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (!visited[nIdx]) {
            visited[nIdx] = 1;
            const nPixelIdx = nIdx * channels;
            const nr = data[nPixelIdx];
            const ng = data[nPixelIdx + 1];
            const nb = data[nPixelIdx + 2];
            if (nr > 230 && ng > 230 && nb > 230) {
              queue.push([nx, ny]);
            }
          }
        }
      }
    }
  }

  // Smooth edges of the squircle to remove antialiasing artifacts
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * channels;
      if (data[idx + 3] === 0) continue;

      const hasTransparentNeighbor =
        data[((y - 1) * width + x) * channels + 3] === 0 ||
        data[((y + 1) * width + x) * channels + 3] === 0 ||
        data[(y * width + (x - 1)) * channels + 3] === 0 ||
        data[(y * width + (x + 1)) * channels + 3] === 0;

      if (hasTransparentNeighbor) {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const brightness = (r + g + b) / 3;
        if (brightness > 200) {
          data[idx + 3] = Math.max(0, Math.round((255 - brightness) * 3));
        }
      }
    }
  }

  return sharp(data, {
    raw: {
      width,
      height,
      channels: 4
    }
  }).png();
}

async function generateAll() {
  console.log('Generating transparent base image from attached image...');
  const baseImg = await prepareBaseImage();
  const baseBuffer = await baseImg.toBuffer();

  // Ensure icons directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  // 1. icon-512.png
  console.log('Generating icon-512.png (512x512)...');
  await sharp(baseBuffer)
    .resize(512, 512, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ICONS_DIR, 'icon-512.png'));

  // 2. icon-192.png
  console.log('Generating icon-192.png (192x192)...');
  await sharp(baseBuffer)
    .resize(192, 192, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ICONS_DIR, 'icon-192.png'));

  // 3. apple-touch-icon.png (180x180)
  console.log('Generating apple-touch-icon.png (180x180)...');
  await sharp(baseBuffer)
    .resize(180, 180, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ICONS_DIR, 'apple-touch-icon.png'));

  // 4. Favicon sizes (32x32, 16x16, 48x48)
  console.log('Generating favicons (32x32, 16x16, 48x48)...');
  await sharp(baseBuffer)
    .resize(32, 32, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ICONS_DIR, 'favicon-32x32.png'));

  await sharp(baseBuffer)
    .resize(16, 16, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ICONS_DIR, 'favicon-16x16.png'));

  await sharp(baseBuffer)
    .resize(48, 48, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ROOT_DIR, 'favicon.png'));

  // 5. maskable-512.png
  // Android maskable requires solid background matching the dark blue squircle (#101440)
  console.log('Generating maskable-512.png with safe-zone margin and solid navy background...');
  const innerSize = Math.round(512 * 0.80); // ~410px safe zone
  const innerResized = await sharp(baseBuffer)
    .resize(innerSize, innerSize, { kernel: sharp.kernel.lanczos3 })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 16, g: 20, b: 64, alpha: 1 } // Deep navy matching the squircle edge
    }
  })
    .composite([
      {
        input: innerResized,
        gravity: 'center'
      }
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(ICONS_DIR, 'maskable-512.png'));

  // 6. badge-72.png (72x72)
  console.log('Generating badge-72.png (72x72)...');
  await sharp(baseBuffer)
    .resize(72, 72, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ICONS_DIR, 'badge-72.png'));

  // 7. Save master copy
  fs.copyFileSync(SOURCE_IMAGE, path.join(ICONS_DIR, 'streakup-logo.jpg'));
  await sharp(baseBuffer).png({ compressionLevel: 9 }).toFile(path.join(ICONS_DIR, 'streakup-logo.png'));

  console.log('✨ All official StreakUp icons successfully generated from attached image!');
}

generateAll().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
