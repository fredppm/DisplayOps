#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔄 Syncing proto files...');

const sourceProto = path.join(__dirname, 'shared', 'proto', 'host-agent.proto');
const hostAgentProto = path.join(__dirname, 'host-agent', 'dist', 'shared', 'proto', 'host-agent.proto');

// Check if source exists
if (!fs.existsSync(sourceProto)) {
  console.error('❌ Source proto file not found:', sourceProto);
  process.exit(1);
}

// Ensure target directory exists
const targetDir = path.dirname(hostAgentProto);
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

try {
  // Copy the file
  fs.copyFileSync(sourceProto, hostAgentProto);
  console.log('✅ Proto file synced successfully');
  
  // Show file stats
  const sourceStats = fs.statSync(sourceProto);
  const targetStats = fs.statSync(hostAgentProto);
  
  console.log(`📄 Source: ${sourceProto} (${sourceStats.size} bytes)`);
  console.log(`📄 Target: ${hostAgentProto} (${targetStats.size} bytes)`);
  
  if (sourceStats.size === targetStats.size) {
    console.log('✅ File sizes match - sync successful');
  } else {
    console.error('❌ File sizes don\'t match - sync failed');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Failed to sync proto files:', error.message);
  process.exit(1);
}

console.log('🎉 Proto sync complete!');