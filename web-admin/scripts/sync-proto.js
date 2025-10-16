const fs = require('fs');
const path = require('path');

// Source: shared proto directory (one level up from web-admin)
const sourceProto = path.join(__dirname, '..', '..', 'shared', 'proto', 'host-agent.proto');

// Destination: web-admin proto directory
const destDir = path.join(__dirname, '..', 'proto');
const destProto = path.join(destDir, 'host-agent.proto');

try {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    console.log('✓ Created proto directory');
  }

  // Copy proto file
  fs.copyFileSync(sourceProto, destProto);
  console.log('✓ Copied host-agent.proto to web-admin/proto/');

} catch (error) {
  console.error('✗ Failed to copy proto file:', error.message);
  process.exit(1);
}
