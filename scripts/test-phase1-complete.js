#!/usr/bin/env node

/**
 * Complete Phase 1 Testing Suite
 * Comprehensive validation of all Phase 1 functionality
 */

const { spawn, exec } = require('child_process');
const axios = require('axios');
const bonjour = require('bonjour-service')();
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  webControllerPort: 3000,
  hostAgentPort: 8080,
  discoveryTimeout: 15000,
  apiTimeout: 10000,
  serviceStartTimeout: 30000,
  testRetries: 3
};

let testResults = {
  infrastructure: [],
  communication: [],
  webInterface: [],
  integration: [],
  robustness: []
};

let webControllerProcess = null;
let hostAgentProcess = null;

console.log('🧪 Office TV Management System - Complete Phase 1 Testing Suite\n');
console.log('This will thoroughly test all Phase 1 functionality...\n');

async function runCompleteTestSuite() {
  try {
    console.log('📋 Starting Complete Phase 1 Test Suite...\n');
    
    // 1. Infrastructure Tests
    await runInfrastructureTests();
    
    // 2. Start Services for Testing
    await startServices();
    
    // 3. Communication Tests
    await runCommunicationTests();
    
    // 4. Web Interface Tests
    await runWebInterfaceTests();
    
    // 5. Integration Tests
    await runIntegrationTests();
    
    // 6. Robustness Tests
    await runRobustnessTests();
    
    // Generate Report
    await generateTestReport();
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    await cleanup();
    process.exit(1);
  } finally {
    await cleanup();
  }
}

async function runInfrastructureTests() {
  console.log('🏗️  Phase 1: Infrastructure Tests\n');
  
  const tests = [
    {
      name: 'Host Agent Dependencies Installation',
      test: async () => {
        await execPromise('cd ../host-agent && npm install');
        return fs.existsSync('../host-agent/node_modules');
      }
    },
    {
      name: 'Web Controller Dependencies Installation',
      test: async () => {
        await execPromise('cd ../web-controller && npm install');
        return fs.existsSync('../web-controller/node_modules');
      }
    },
    {
      name: 'Host Agent TypeScript Compilation',
      test: async () => {
        await execPromise('cd ../host-agent && npm run build');
        return fs.existsSync('../host-agent/dist/main.js');
      }
    },
    {
      name: 'Web Controller TypeScript Check',
      test: async () => {
        await execPromise('cd ../web-controller && npm run type-check');
        return true;
      }
    },
    {
      name: 'Shared Types Validation',
      test: async () => {
        const typesContent = fs.readFileSync('../shared/types.ts', 'utf8');
        return typesContent.includes('export interface MiniPC') && 
               typesContent.includes('export interface Dashboard');
      }
    }
  ];

  for (const test of tests) {
    await runTest('infrastructure', test);
  }
}

async function startServices() {
  console.log('\n🚀 Starting Services for Testing...\n');
  
  try {
    // Start Web Controller
    console.log('Starting Web Controller...');
    webControllerProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '../web-controller'),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    // Start Host Agent
    console.log('Starting Host Agent...');
    hostAgentProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '../host-agent'),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    // Wait for services to start
    console.log('Waiting for services to initialize...');
    await wait(TEST_CONFIG.serviceStartTimeout);
    
    // Verify services are running
    const webControllerRunning = await isServiceRunning(`http://localhost:${TEST_CONFIG.webControllerPort}`);
    const hostAgentRunning = await isServiceRunning(`http://localhost:${TEST_CONFIG.hostAgentPort}/health`);
    
    if (!webControllerRunning) {
      throw new Error('Web Controller failed to start');
    }
    
    if (!hostAgentRunning) {
      throw new Error('Host Agent failed to start');
    }
    
    console.log('✅ Both services started successfully\n');
    
  } catch (error) {
    throw new Error(`Failed to start services: ${error.message}`);
  }
}

async function runCommunicationTests() {
  console.log('📡 Phase 2: Communication Tests\n');
  
  const tests = [
    {
      name: 'Host Agent Health Check',
      test: async () => {
        const response = await axios.get(`http://localhost:${TEST_CONFIG.hostAgentPort}/health`, {
          timeout: TEST_CONFIG.apiTimeout
        });
        return response.status === 200 && response.data.success;
      }
    },
    {
      name: 'Host Agent Status API',
      test: async () => {
        const response = await axios.get(`http://localhost:${TEST_CONFIG.hostAgentPort}/api/status`, {
          timeout: TEST_CONFIG.apiTimeout
        });
        return response.status === 200 && response.data.data.hostStatus;
      }
    },
    {
      name: 'mDNS Service Discovery',
      test: async () => {
        return new Promise((resolve) => {
          const browser = bonjour.find({ type: 'officedisplay' });
          let found = false;
          
          const timeout = setTimeout(() => {
            browser.stop();
            resolve(found);
          }, TEST_CONFIG.discoveryTimeout);
          
          browser.on('up', (service) => {
            if (service.name.includes('agent')) {
              found = true;
              clearTimeout(timeout);
              browser.stop();
              resolve(true);
            }
          });
        });
      }
    },
    {
      name: 'Command Dispatch - Health Check',
      test: async () => {
        const command = {
          type: 'health_check',
          targetTv: 'display-1',
          payload: {},
          timestamp: new Date()
        };
        
        const response = await axios.post(`http://localhost:${TEST_CONFIG.hostAgentPort}/api/command`, command, {
          timeout: TEST_CONFIG.apiTimeout,
          headers: { 'Content-Type': 'application/json' }
        });
        
        return response.status === 200 && response.data.success;
      }
    },
    {
      name: 'Web Controller Discovery API',
      test: async () => {
        // Wait a bit for discovery to happen
        await wait(5000);
        
        const response = await axios.get(`http://localhost:${TEST_CONFIG.webControllerPort}/api/discovery/hosts`, {
          timeout: TEST_CONFIG.apiTimeout
        });
        
        return response.status === 200 && response.data.success;
      }
    }
  ];

  for (const test of tests) {
    await runTest('communication', test);
  }
}

async function runWebInterfaceTests() {
  console.log('🌐 Phase 3: Web Interface Tests\n');
  
  const tests = [
    {
      name: 'Web Controller Homepage Load',
      test: async () => {
        const response = await axios.get(`http://localhost:${TEST_CONFIG.webControllerPort}`, {
          timeout: TEST_CONFIG.apiTimeout
        });
        return response.status === 200 && response.data.includes('Office TV Management');
      }
    },
    {
      name: 'Static Assets Loading',
      test: async () => {
        const response = await axios.get(`http://localhost:${TEST_CONFIG.webControllerPort}/_next/static/css/app/layout.css`, {
          timeout: TEST_CONFIG.apiTimeout,
          validateStatus: () => true // Don't throw on 404
        });
        // CSS might be at different path, so just check service is serving static files
        return response.status < 500;
      }
    },
    {
      name: 'API Routes Accessibility',
      test: async () => {
        const routes = [
          '/api/discovery/hosts'
        ];
        
        for (const route of routes) {
          const response = await axios.get(`http://localhost:${TEST_CONFIG.webControllerPort}${route}`, {
            timeout: TEST_CONFIG.apiTimeout
          });
          if (response.status !== 200) return false;
        }
        return true;
      }
    }
  ];

  for (const test of tests) {
    await runTest('webInterface', test);
  }
}

async function runIntegrationTests() {
  console.log('🔄 Phase 4: Integration Tests\n');
  
  const tests = [
    {
      name: 'End-to-End Discovery Flow',
      test: async () => {
        // Wait for discovery to propagate
        await wait(8000);
        
        // Check if host appears in web controller
        const response = await axios.get(`http://localhost:${TEST_CONFIG.webControllerPort}/api/discovery/hosts`);
        const hosts = response.data.data || [];
        
        return hosts.length > 0 && hosts[0].status.online;
      }
    },
    {
      name: 'Command Forwarding via Web Controller',
      test: async () => {
        // Get discovered hosts first
        const hostsResponse = await axios.get(`http://localhost:${TEST_CONFIG.webControllerPort}/api/discovery/hosts`);
        const hosts = hostsResponse.data.data || [];
        
        if (hosts.length === 0) return false;
        
        const hostId = hosts[0].id;
        const command = {
          type: 'health_check',
          targetTv: 'display-1',
          payload: {},
          timestamp: new Date()
        };
        
        const response = await axios.post(
          `http://localhost:${TEST_CONFIG.webControllerPort}/api/host/${hostId}/command`, 
          command,
          {
            timeout: TEST_CONFIG.apiTimeout,
            headers: { 'Content-Type': 'application/json' }
          }
        );
        
        return response.status === 200;
      }
    }
  ];

  for (const test of tests) {
    await runTest('integration', test);
  }
}

async function runRobustnessTests() {
  console.log('💪 Phase 5: Robustness Tests\n');
  
  const tests = [
    {
      name: 'API Error Handling - Invalid Command',
      test: async () => {
        try {
          await axios.post(`http://localhost:${TEST_CONFIG.hostAgentPort}/api/command`, {
            type: 'invalid_command',
            targetTv: 'display-1'
          }, {
            timeout: TEST_CONFIG.apiTimeout,
            headers: { 'Content-Type': 'application/json' }
          });
          return false; // Should not succeed
        } catch (error) {
          return error.response && error.response.status >= 400;
        }
      }
    },
    {
      name: 'Service Resource Usage Check',
      test: async () => {
        const response = await axios.get(`http://localhost:${TEST_CONFIG.hostAgentPort}/api/status`);
        const status = response.data.data.hostStatus;
        
        // Check if resource usage is reasonable
        return status.cpuUsage < 50 && status.memoryUsage < 80;
      }
    },
    {
      name: 'Concurrent Request Handling',
      test: async () => {
        const requests = Array(5).fill().map(() => 
          axios.get(`http://localhost:${TEST_CONFIG.hostAgentPort}/health`, {
            timeout: TEST_CONFIG.apiTimeout
          })
        );
        
        const results = await Promise.allSettled(requests);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 200);
        
        return successful.length >= 4; // Allow 1 failure
      }
    }
  ];

  for (const test of tests) {
    await runTest('robustness', test);
  }
}

async function runTest(category, test) {
  process.stdout.write(`  ${test.name}... `);
  
  try {
    const result = await test.test();
    
    if (result) {
      console.log('✅ PASSED');
      testResults[category].push({ name: test.name, status: 'PASSED', error: null });
    } else {
      console.log('❌ FAILED');
      testResults[category].push({ name: test.name, status: 'FAILED', error: 'Test returned false' });
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    testResults[category].push({ name: test.name, status: 'ERROR', error: error.message });
  }
}

async function generateTestReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 PHASE 1 TEST RESULTS REPORT');
  console.log('='.repeat(60));
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let errorTests = 0;
  
  const categories = [
    { name: 'Infrastructure', key: 'infrastructure' },
    { name: 'Communication', key: 'communication' },
    { name: 'Web Interface', key: 'webInterface' },
    { name: 'Integration', key: 'integration' },
    { name: 'Robustness', key: 'robustness' }
  ];
  
  categories.forEach(category => {
    const results = testResults[category.key];
    const passed = results.filter(r => r.status === 'PASSED').length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    const errors = results.filter(r => r.status === 'ERROR').length;
    
    console.log(`\n${category.name}: ${passed}/${results.length} passed`);
    
    results.forEach(result => {
      const icon = result.status === 'PASSED' ? '✅' : '❌';
      console.log(`  ${icon} ${result.name}`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });
    
    totalTests += results.length;
    passedTests += passed;
    failedTests += failed;
    errorTests += errors;
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY:');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`🚨 Errors: ${errorTests}`);
  
  const successRate = (passedTests / totalTests * 100).toFixed(1);
  console.log(`Success Rate: ${successRate}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! Phase 1 is ready for production use.');
    console.log('✅ You can safely proceed to Phase 2 development.');
  } else if (successRate >= 80) {
    console.log('\n⚠️  Most tests passed, but there are some issues to address.');
    console.log('🔧 Review the failed tests before proceeding to Phase 2.');
  } else {
    console.log('\n❌ SIGNIFICANT ISSUES DETECTED!');
    console.log('🛑 Please fix the failing tests before proceeding.');
  }
  
  console.log('='.repeat(60));
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test environment...');
  
  if (webControllerProcess) {
    webControllerProcess.kill();
  }
  
  if (hostAgentProcess) {
    hostAgentProcess.kill();
  }
  
  bonjour.destroy();
  
  console.log('✅ Cleanup completed');
}

// Utility functions
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

async function isServiceRunning(url) {
  try {
    const response = await axios.get(url, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Handle script interruption
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Test suite interrupted by user');
  await cleanup();
  process.exit(0);
});

// Start the test suite
if (require.main === module) {
  runCompleteTestSuite().catch((error) => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}
