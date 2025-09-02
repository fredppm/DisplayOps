#!/usr/bin/env node

/**
 * Quick Phase 1 Validation
 * Fast validation of core functionality without starting full services
 */

const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');

console.log('⚡ ScreenFleet Management System - Quick Phase 1 Validation\n');

const QUICK_TESTS = [
  {
    name: 'Dependencies Check',
    test: async () => {
      const hostAgentDeps = fs.existsSync('../host-agent/node_modules');
      const webControllerDeps = fs.existsSync('../web-controller/node_modules');
      return hostAgentDeps && webControllerDeps;
    },
    fix: 'Run: cd host-agent && npm install && cd ../web-controller && npm install'
  },
  {
    name: 'TypeScript Compilation',
    test: async () => {
      try {
        await execPromise('cd ../host-agent && npm run build');
        return fs.existsSync('../host-agent/dist/main.js');
      } catch (error) {
        console.log(`   Compilation error: ${error.message}`);
        return false;
      }
    },
    fix: 'Fix TypeScript errors in host-agent'
  },
  {
    name: 'Web Controller Type Check',
    test: async () => {
      try {
        await execPromise('cd ../web-controller && npm run type-check');
        return true;
      } catch (error) {
        console.log(`   Type check error: ${error.message}`);
        return false;
      }
    },
    fix: 'Fix TypeScript errors in web-controller'
  },
  {
    name: 'Required Files Structure',
    test: async () => {
      const requiredFiles = [
        '../shared/types.ts',
        '../host-agent/src/main.ts',
        '../host-agent/src/services/mdns-service.ts',
        '../host-agent/src/routes/api-router.ts',
        '../web-controller/src/pages/index.tsx',
        '../web-controller/src/lib/discovery-service.ts',
        '../web-controller/src/pages/api/discovery/hosts.ts'
      ];
      
      return requiredFiles.every(file => fs.existsSync(file));
    },
    fix: 'Some core files are missing - check implementation'
  }
];

async function runQuickValidation() {
  console.log('🔍 Running quick validation tests...\n');
  
  let allPassed = true;
  
  for (let i = 0; i < QUICK_TESTS.length; i++) {
    const test = QUICK_TESTS[i];
    process.stdout.write(`${i + 1}. ${test.name}... `);
    
    try {
      const result = await test.test();
      
      if (result) {
        console.log('✅ PASSED');
      } else {
        console.log('❌ FAILED');
        console.log(`   Fix: ${test.fix}`);
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      console.log(`   Fix: ${test.fix}`);
      allPassed = false;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('✅ Quick validation PASSED!');
    console.log('\n🚀 Ready for comprehensive testing:');
    console.log('   npm run test-phase1-complete');
    console.log('\n🔧 Or start development environment:');
    console.log('   npm run start-dev-win (Windows)');
    console.log('   npm run start-dev-linux (Linux)');
  } else {
    console.log('❌ Quick validation FAILED!');
    console.log('\n🔧 Please fix the issues above before proceeding.');
    console.log('💡 Tip: Run each fix command and then re-run this validation.');
  }
  
  return allPassed;
}

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

// Run the validation
if (require.main === module) {
  runQuickValidation().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Validation error:', error);
    process.exit(1);
  });
}
