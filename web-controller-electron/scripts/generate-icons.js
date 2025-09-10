const fs = require('fs');
const path = require('path');

// Create a simple SVG icon
const svgIcon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="128" cy="128" r="120" fill="url(#grad1)" stroke="#1E1B4B" stroke-width="4"/>
  
  <!-- Display screens -->
  <rect x="60" y="80" width="60" height="40" rx="4" fill="#FFFFFF" stroke="#1E1B4B" stroke-width="2"/>
  <rect x="136" y="80" width="60" height="40" rx="4" fill="#FFFFFF" stroke="#1E1B4B" stroke-width="2"/>
  <rect x="60" y="136" width="60" height="40" rx="4" fill="#FFFFFF" stroke="#1E1B4B" stroke-width="2"/>
  <rect x="136" y="136" width="60" height="40" rx="4" fill="#FFFFFF" stroke="#1E1B4B" stroke-width="2"/>
  
  <!-- Connection lines -->
  <line x1="90" y1="120" x2="90" y2="136" stroke="#1E1B4B" stroke-width="2"/>
  <line x1="166" y1="120" x2="166" y2="136" stroke="#1E1B4B" stroke-width="2"/>
  <line x1="120" y1="100" x2="136" y2="100" stroke="#1E1B4B" stroke-width="2"/>
  <line x1="120" y1="156" x2="136" y2="156" stroke="#1E1B4B" stroke-width="2"/>
  
  <!-- Center control unit -->
  <circle cx="128" cy="128" r="12" fill="#FBBF24" stroke="#1E1B4B" stroke-width="2"/>
  <circle cx="128" cy="128" r="6" fill="#1E1B4B"/>
  
  <!-- Title text -->
  <text x="128" y="220" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#FFFFFF">DisplayOps</text>
</svg>`;

// Ensure directories exist
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Write SVG file
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), svgIcon);

console.log('SVG icon generated successfully!');
console.log('To create platform-specific icons, you can use online converters:');
console.log('- For ICO (Windows): https://convertio.co/svg-ico/');
console.log('- For ICNS (macOS): https://cloudconvert.com/svg-to-icns');
console.log('- For PNG (Linux): https://convertio.co/svg-png/');
console.log('');
console.log('Or install imagemagick/sharp and add conversion to this script.');

// Create placeholder files for now
const placeholderContent = 'Placeholder - replace with actual icon';

fs.writeFileSync(path.join(assetsDir, 'icon.ico'), placeholderContent);
fs.writeFileSync(path.join(assetsDir, 'icon.icns'), placeholderContent);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), placeholderContent);

console.log('Placeholder icon files created. Please replace them with actual converted icons.');