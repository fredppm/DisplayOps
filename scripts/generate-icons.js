/*
  Generator for Chrome extension icons.
  Produces monitor-style PNGs with a white screen, transparent canvas background,
  VTEX Rebel Pink logo centered on the screen, and status indicated via bezel stroke.
*/

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const ICONS_DIR = path.join(ROOT, 'browser-extension', 'icons');
const TRAY_ASSETS_DIR = path.join(ROOT, 'host-agent', 'assets');
const WEB_PUBLIC_DIR = path.join(ROOT, 'web-admin', 'public');
const LOCAL_VTEX_SVG = path.join(__dirname, 'vtex-icon.svg');
// Prefer official VTEX brand assets (Rebel Pink). Fallback to existing ones.
const VTEX_TRAY_ICON_PNG = path.join(ROOT, 'host-agent', 'assets', 'vtex-tray-icon.png');
const VTEX_LOGO_REBEL_PNG = path.join(ROOT, 'host-agent', 'assets', 'vtex-logo-rebel.png');
const VTEX_SVG_FALLBACK = path.join(ROOT, 'host-agent', 'assets', 'vtex-icon.svg');

const SIZES = [16, 32, 48, 128];
const STATUS_TO_COLOR = {
  idle: '#9CA3AF',   // gray
  ready: '#F59E0B',  // amber
  synced: '#10B981', // green
  error: '#EF4444',  // red
};

function toFixed(value) {
  return Number(value.toFixed(2));
}

function buildIconSvg(sizePx, statusColor, vtexDataUri) {
  const size = sizePx;

  // Monitor geometry
  const monitorWidth = toFixed(size * 0.84);
  const monitorHeight = toFixed(size * 0.58);
  const bezelRadius = toFixed(size * 0.06);
  const bezel = toFixed(size * 0.02);
  const monitorX = toFixed((size - monitorWidth) / 2);
  const monitorY = toFixed(size * 0.14);

  const screenX = toFixed(monitorX + bezel);
  const screenY = toFixed(monitorY + bezel);
  const screenWidth = toFixed(monitorWidth - bezel * 2);
  const screenHeight = toFixed(monitorHeight - bezel * 2);

  // Stand
  const standStemWidth = toFixed(monitorWidth * 0.08);
  const standStemHeight = toFixed(size * 0.10);
  const standStemX = toFixed(monitorX + (monitorWidth - standStemWidth) / 2);
  const standStemY = toFixed(monitorY + monitorHeight);

  const standBaseWidth = toFixed(monitorWidth * 0.35);
  const standBaseHeight = toFixed(size * 0.06);
  const standBaseX = toFixed(monitorX + (monitorWidth - standBaseWidth) / 2);
  const standBaseY = toFixed(standStemY + standStemHeight - standBaseHeight / 2);

  // VTEX logo placement (square)
  const logoMax = Math.min(screenWidth, screenHeight);
  const logoSize = toFixed(logoMax * 0.85);
  const logoX = toFixed(screenX + (screenWidth - logoSize) / 2);
  const logoY = toFixed(screenY + (screenHeight - logoSize) / 2);

  const vtexHref = vtexDataUri;

  // Colors
  const bezelColor = '#2F343D';
  const standColor = '#A0A7B2';
  const screenColor = '#FFFFFF';
  const screenStroke = '#E5E7EB';
  const bezelStrokeWidth = toFixed(Math.max(1, size * 0.06));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- Transparent canvas background by default -->

  <!-- Monitor bezel; stroke indicates status -->
  <rect x="${monitorX}" y="${monitorY}" width="${monitorWidth}" height="${monitorHeight}" rx="${bezelRadius}" ry="${bezelRadius}" fill="${bezelColor}" stroke="${statusColor}" stroke-width="${bezelStrokeWidth}"/>

  <!-- Screen area: white -->
  <rect x="${screenX}" y="${screenY}" width="${screenWidth}" height="${screenHeight}" rx="${Math.max(0, bezelRadius - bezel)}" ry="${Math.max(0, bezelRadius - bezel)}" fill="${screenColor}" stroke="${screenStroke}" stroke-width="${toFixed(size * 0.02)}"/>

  <!-- VTEX logo centered within the screen (Rebel Pink) -->
  <image href="${vtexHref}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}"/>

  <!-- Stand -->
  <rect x="${standStemX}" y="${standStemY}" width="${standStemWidth}" height="${standStemHeight}" rx="${toFixed(standStemWidth * 0.2)}" ry="${toFixed(standStemWidth * 0.2)}" fill="${standColor}"/>
  <rect x="${standBaseX}" y="${standBaseY}" width="${standBaseWidth}" height="${standBaseHeight}" rx="${toFixed(standBaseHeight * 0.3)}" ry="${toFixed(standBaseHeight * 0.3)}" fill="${standColor}"/>
</svg>`;
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function resolveVtexDataUri() {
  // Prefer local SVG next to generator, then project assets.
  const candidates = [ LOCAL_VTEX_SVG, VTEX_LOGO_REBEL_PNG, VTEX_SVG_FALLBACK];
  for (const fp of candidates) {
    try {
      await fs.promises.access(fp, fs.constants.R_OK);
      const buf = await fs.promises.readFile(fp);
      const ext = path.extname(fp).toLowerCase();
      const mime = ext === '.svg' ? 'image/svg+xml' : 'image/png';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch (_) {
      // continue
    }
  }
  throw new Error('VTEX brand asset not found.');
}

async function generateAll() {
  const vtexDataUri = await resolveVtexDataUri();

  await ensureDir(ICONS_DIR);
  await ensureDir(TRAY_ASSETS_DIR);
  await ensureDir(WEB_PUBLIC_DIR);

  for (const [status, color] of Object.entries(STATUS_TO_COLOR)) {
    for (const size of SIZES) {
      const svg = buildIconSvg(size, color, vtexDataUri);
      const png = await sharp(Buffer.from(svg))
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer();

      const outPath = path.join(ICONS_DIR, `icon-${status}-${size}.png`);
      await fs.promises.writeFile(outPath, png);
      // eslint-disable-next-line no-console
      console.log(`Generated: ${path.relative(ROOT, outPath)}`);
    }
  }

  // Generate tray icons (default idle alias + per-status variants at 32px)
  for (const [status, color] of Object.entries(STATUS_TO_COLOR)) {
    const traySvg = buildIconSvg(32, color, vtexDataUri);
    const trayPng = await sharp(Buffer.from(traySvg)).png({ compressionLevel: 9 }).toBuffer();
    const trayOut = path.join(TRAY_ASSETS_DIR, `vtex-tray-icon-${status}.png`);
    await fs.promises.writeFile(trayOut, trayPng);
    // eslint-disable-next-line no-console
    console.log(`Generated: ${path.relative(ROOT, trayOut)}`);
    if (status === 'idle') {
      const aliasOut = path.join(TRAY_ASSETS_DIR, 'vtex-tray-icon.png');
      await fs.promises.writeFile(aliasOut, trayPng);
      // eslint-disable-next-line no-console
      console.log(`Aliased idle tray: ${path.relative(ROOT, aliasOut)}`);
    }
  }

  // Generate favicon.ico for web-admin (idle state)
  {
    const { default: pngToIco } = await import('png-to-ico');
    const fav16Svg = buildIconSvg(16, STATUS_TO_COLOR.idle, vtexDataUri);
    const fav32Svg = buildIconSvg(32, STATUS_TO_COLOR.idle, vtexDataUri);
    const fav16Png = await sharp(Buffer.from(fav16Svg)).png().toBuffer();
    const fav32Png = await sharp(Buffer.from(fav32Svg)).png().toBuffer();
    const icoBuf = await pngToIco([fav16Png, fav32Png]);
    const icoOut = path.join(WEB_PUBLIC_DIR, 'favicon.ico');
    await fs.promises.writeFile(icoOut, icoBuf);
    // eslint-disable-next-line no-console
    console.log(`Generated: ${path.relative(ROOT, icoOut)}`);
  }
}

generateAll().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


