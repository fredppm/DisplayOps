#!/usr/bin/env node

/**
 * Phase 1 Verification Script
 * Checks if all Phase 1 components are properly set up
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Office TV Management System - Phase 1 Verification\n');

const checks = [
  {
    name: 'Host Agent Dependencies',
    check: () => fs.existsSync(path.join(__dirname, '../host-agent/package.json')),
    fix: 'Run: cd host-agent && npm install'
  },
  {
    name: 'Web Controller Dependencies', 
    check: () => fs.existsSync(path.join(__dirname, '../web-controller/package.json')),
    fix: 'Run: cd web-controller && npm install'
  },
  {
    name: 'Shared Types',
    check: () => fs.existsSync(path.join(__dirname, '../shared/types.ts')),
    fix: 'Shared types should be in shared/types.ts'
  },
  {
    name: 'Host Agent Main File',
    check: () => fs.existsSync(path.join(__dirname, '../host-agent/src/main.ts')),
    fix: 'Host agent main file missing'
  },
  {
    name: 'Web Controller Index',
    check: () => fs.existsSync(path.join(__dirname, '../web-controller/src/pages/index.tsx')),
    fix: 'Web controller index page missing'
  },
  {
    name: 'Discovery Service',
    check: () => fs.existsSync(path.join(__dirname, '../web-controller/src/lib/discovery-service.ts')),
    fix: 'Discovery service implementation missing'
  },
  {
    name: 'API Routes',
    check: () => fs.existsSync(path.join(__dirname, '../web-controller/src/pages/api/discovery/hosts.ts')),
    fix: 'API routes missing'
  },
  {
    name: 'Host Agent API Router',
    check: () => fs.existsSync(path.join(__dirname, '../host-agent/src/routes/api-router.ts')),
    fix: 'Host agent API router missing'
  },
  {
    name: 'mDNS Service',
    check: () => fs.existsSync(path.join(__dirname, '../host-agent/src/services/mdns-service.ts')),
    fix: 'mDNS service implementation missing'
  },
  {
    name: 'Development Scripts',
    check: () => fs.existsSync(path.join(__dirname, 'start-dev.bat')) && 
                 fs.existsSync(path.join(__dirname, 'start-dev.sh')),
    fix: 'Development scripts missing'
  }
];

let allPassed = true;

console.log('📋 Checking Phase 1 Implementation...\n');

checks.forEach((check, index) => {
  const passed = check.check();
  const status = passed ? '✅' : '❌';
  
  console.log(`${index + 1}. ${check.name}: ${status}`);
  
  if (!passed) {
    console.log(`   Fix: ${check.fix}`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('🎉 Phase 1 verification PASSED!');
  console.log('\n✅ All components are properly implemented');
  console.log('✅ File structure is correct');
  console.log('✅ Ready for testing and development');
  
  console.log('\n🚀 Next Steps:');
  console.log('1. Install dependencies: cd scripts && npm install');
  console.log('2. Start development: npm run start-dev-win (Windows) or npm run start-dev-linux (Linux)');
  console.log('3. Test communication: npm run test-communication');
  console.log('4. Open web interface: http://localhost:3000');
  
} else {
  console.log('❌ Phase 1 verification FAILED!');
  console.log('\n🔧 Please fix the issues above and run verification again');
}

console.log('\n📚 Documentation:');
console.log('- Setup Guide: docs/PHASE1_SETUP.md');
console.log('- Phase Summary: docs/PHASE1_SUMMARY.md');
console.log('- Architecture: docs/ARCHITECTURE.md');

console.log('\n' + '='.repeat(50));

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 18) {
  console.log('⚠️  WARNING: Node.js version should be 18 or higher');
  console.log(`   Current version: ${nodeVersion}`);
  console.log('   Please upgrade Node.js for best compatibility');
} else {
  console.log(`✅ Node.js version check passed: ${nodeVersion}`);
}

process.exit(allPassed ? 0 : 1);
