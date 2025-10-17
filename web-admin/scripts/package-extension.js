const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

async function packageExtension() {
  const extensionDir = path.resolve(__dirname, '..', '..', 'browser-extension');
  const outputDir = path.resolve(__dirname, '..', 'public', 'downloads');
  const outputFile = path.join(outputDir, 'displayops-extension.zip');

  // Check if extension directory exists
  if (!fs.existsSync(extensionDir)) {
    console.error('❌ Browser extension directory not found:', extensionDir);
    process.exit(1);
  }

  // Check if ZIP already exists and is up-to-date
  if (fs.existsSync(outputFile)) {
    const zipStats = fs.statSync(outputFile);
    const manifestPath = path.join(extensionDir, 'manifest.json');
    
    if (fs.existsSync(manifestPath)) {
      const manifestStats = fs.statSync(manifestPath);
      
      // If ZIP is newer than manifest, skip regeneration
      if (zipStats.mtime > manifestStats.mtime) {
        console.log('✅ Extension package is up-to-date, skipping...');
        return;
      }
    }
  }

  console.log('📦 Packaging browser extension...');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create write stream
  const output = fs.createWriteStream(outputFile);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`✅ Extension packaged: ${outputFile}`);
      console.log(`📊 Size: ${sizeMB} MB (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on('error', (err) => {
      console.error('❌ Error packaging extension:', err);
      reject(err);
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('⚠️  Warning:', err.message);
      } else {
        reject(err);
      }
    });

    // Pipe archive to file
    archive.pipe(output);

    // Add all files from browser-extension directory
    console.log('📁 Adding files from:', extensionDir);
    archive.directory(extensionDir, false);

    // Finalize the archive
    archive.finalize();
  });
}

// Run if called directly
if (require.main === module) {
  packageExtension()
    .then(() => {
      console.log('✨ Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Failed:', err);
      process.exit(1);
    });
}

module.exports = { packageExtension };

