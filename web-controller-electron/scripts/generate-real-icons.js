const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  
  // Create a simple 512x512 PNG icon using Sharp
  const svg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <!-- Background circle -->
      <circle cx="256" cy="256" r="240" fill="url(#grad1)" stroke="#1E1B4B" stroke-width="8"/>
      
      <!-- Display screens -->
      <rect x="120" y="160" width="120" height="80" rx="8" fill="#FFFFFF" stroke="#1E1B4B" stroke-width="4"/>
      <rect x="272" y="160" width="120" height="80" rx="8" fill="#FFFFFF" stroke="#1E1B4B" stroke-width="4"/>
      <rect x="120" y="272" width="120" height="80" rx="8" fill="#FFFFFF" stroke="#1E1B4B" stroke-width="4"/>
      <rect x="272" y="272" width="120" height="80" rx="8" fill="#FFFFFF" stroke="#1E1B4B" stroke-width="4"/>
      
      <!-- Connection lines -->
      <line x1="180" y1="240" x2="180" y2="272" stroke="#1E1B4B" stroke-width="4"/>
      <line x1="332" y1="240" x2="332" y2="272" stroke="#1E1B4B" stroke-width="4"/>
      <line x1="240" y1="200" x2="272" y2="200" stroke="#1E1B4B" stroke-width="4"/>
      <line x1="240" y1="312" x2="272" y2="312" stroke="#1E1B4B" stroke-width="4"/>
      
      <!-- Center control unit -->
      <circle cx="256" cy="256" r="24" fill="#FBBF24" stroke="#1E1B4B" stroke-width="4"/>
      <circle cx="256" cy="256" r="12" fill="#1E1B4B"/>
      
      <!-- Title text -->
      <text x="256" y="440" font-family="Arial, sans-serif" font-size="32" font-weight="bold" text-anchor="middle" fill="#FFFFFF">DisplayOps</text>
    </svg>
  `;

  try {
    // Generate PNG files
    const pngBuffer = await sharp(Buffer.from(svg))
      .png()
      .resize(512, 512)
      .toBuffer();
    
    fs.writeFileSync(path.join(assetsDir, 'icon.png'), pngBuffer);
    console.log('✓ Generated icon.png (512x512)');

    // Generate 256x256 PNG for ICO conversion
    const png256Buffer = await sharp(Buffer.from(svg))
      .png()
      .resize(256, 256)
      .toBuffer();
    
    fs.writeFileSync(path.join(assetsDir, 'icon-256.png'), png256Buffer);
    console.log('✓ Generated icon-256.png (256x256)');

    // Generate 128x128 PNG 
    const png128Buffer = await sharp(Buffer.from(svg))
      .png()
      .resize(128, 128)
      .toBuffer();
    
    fs.writeFileSync(path.join(assetsDir, 'icon-128.png'), png128Buffer);
    console.log('✓ Generated icon-128.png (128x128)');

    // Generate 64x64 PNG
    const png64Buffer = await sharp(Buffer.from(svg))
      .png()
      .resize(64, 64)
      .toBuffer();
    
    fs.writeFileSync(path.join(assetsDir, 'icon-64.png'), png64Buffer);
    console.log('✓ Generated icon-64.png (64x64)');

    // Generate 32x32 PNG
    const png32Buffer = await sharp(Buffer.from(svg))
      .png()
      .resize(32, 32)
      .toBuffer();
    
    fs.writeFileSync(path.join(assetsDir, 'icon-32.png'), png32Buffer);
    console.log('✓ Generated icon-32.png (32x32)');

    // Generate 16x16 PNG
    const png16Buffer = await sharp(Buffer.from(svg))
      .png()
      .resize(16, 16)
      .toBuffer();
    
    fs.writeFileSync(path.join(assetsDir, 'icon-16.png'), png16Buffer);
    console.log('✓ Generated icon-16.png (16x16)');

    console.log('');
    console.log('Icons generated successfully!');
    console.log('');
    console.log('To create ICO and ICNS files:');
    console.log('1. For Windows ICO: Use online converter or imagemagick');
    console.log('2. For macOS ICNS: Use iconutil or online converter');
    console.log('');
    console.log('For now, we\'ll use PNG files for all platforms.');

    // Copy the main PNG as fallback for ICO and ICNS
    fs.copyFileSync(path.join(assetsDir, 'icon-256.png'), path.join(assetsDir, 'icon.ico'));
    fs.copyFileSync(path.join(assetsDir, 'icon.png'), path.join(assetsDir, 'icon.icns'));
    
    console.log('✓ Created fallback icon.ico and icon.icns (PNG format)');
    console.log('Note: These are PNG files renamed as ICO/ICNS. For production, convert to proper formats.');

  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();