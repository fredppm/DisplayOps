const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateRealIcons() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  const sourceLogoPath = path.join(assetsDir, 'source-logo.png');
  
  // Verificar se o logo fonte existe
  if (!fs.existsSync(sourceLogoPath)) {
    console.error('❌ Source logo not found at:', sourceLogoPath);
    console.log('Please ensure logo-ready.png was copied to assets/source-logo.png');
    return;
  }

  console.log('🎨 Generating icons from real logo...');

  try {
    // Ler o logo fonte
    const sourceImage = sharp(sourceLogoPath);
    const { width, height } = await sourceImage.metadata();
    console.log(`📏 Source logo: ${width}x${height}`);

    // Gerar ícone PNG principal (512x512) para system tray
    await sourceImage
      .resize(512, 512, { 
        fit: 'contain', 
        background: { r: 0, g: 0, b: 0, alpha: 0 } 
      })
      .png()
      .toFile(path.join(assetsDir, 'icon.png'));
    console.log('✓ Generated icon.png (512x512)');

    // Gerar ícone 256x256
    await sourceImage
      .resize(256, 256, { 
        fit: 'contain', 
        background: { r: 0, g: 0, b: 0, alpha: 0 } 
      })
      .png()
      .toFile(path.join(assetsDir, 'icon-256.png'));
    console.log('✓ Generated icon-256.png');

    // Gerar ícone 128x128  
    await sourceImage
      .resize(128, 128, { 
        fit: 'contain', 
        background: { r: 0, g: 0, b: 0, alpha: 0 } 
      })
      .png()
      .toFile(path.join(assetsDir, 'icon-128.png'));
    console.log('✓ Generated icon-128.png');

    // Gerar ícone 64x64
    await sourceImage
      .resize(64, 64, { 
        fit: 'contain', 
        background: { r: 0, g: 0, b: 0, alpha: 0 } 
      })
      .png()
      .toFile(path.join(assetsDir, 'icon-64.png'));
    console.log('✓ Generated icon-64.png');

    // Gerar ícone 32x32 para system tray (tamanho padrão)
    await sourceImage
      .resize(32, 32, { 
        fit: 'contain', 
        background: { r: 0, g: 0, b: 0, alpha: 0 } 
      })
      .png()
      .toFile(path.join(assetsDir, 'icon-32.png'));
    console.log('✓ Generated icon-32.png (system tray)');

    // Gerar ícone 16x16
    await sourceImage
      .resize(16, 16, { 
        fit: 'contain', 
        background: { r: 0, g: 0, b: 0, alpha: 0 } 
      })
      .png()
      .toFile(path.join(assetsDir, 'icon-16.png'));
    console.log('✓ Generated icon-16.png');

    // Criar fallbacks para ICO e ICNS (usando PNG por enquanto)
    fs.copyFileSync(
      path.join(assetsDir, 'icon-32.png'), 
      path.join(assetsDir, 'icon.ico')
    );
    console.log('✓ Created icon.ico (PNG format for now)');

    fs.copyFileSync(
      path.join(assetsDir, 'icon.png'), 
      path.join(assetsDir, 'icon.icns')
    );
    console.log('✓ Created icon.icns (PNG format for now)');

    console.log('');
    console.log('🎉 All icons generated successfully!');
    console.log('');
    console.log('📁 Generated files:');
    console.log('  - icon.png (512x512) - Main icon');
    console.log('  - icon-32.png (32x32) - System tray');  
    console.log('  - icon.ico - Windows installer');
    console.log('  - icon.icns - macOS app');
    console.log('');
    console.log('🔧 For production, convert PNG files to proper ICO/ICNS formats');

  } catch (error) {
    console.error('❌ Error generating icons:', error);
  }
}

generateRealIcons();