#!/usr/bin/env node

/**
 * Test script for Phase 1 communication
 * Tests mDNS discovery and basic API communication
 */

const bonjour = require('bonjour-service')();
const axios = require('axios');

console.log('🧪 ScreenFleet Management System - Phase 1 Communication Test\n');

// Test Configuration
const TEST_CONFIG = {
  discoveryTimeout: 10000, // 10 seconds
  apiTimeout: 5000,        // 5 seconds
  expectedService: '_screenfleet._tcp.local'
};

let discoveredServices = [];

async function runTests() {
  console.log('🔍 Starting mDNS discovery test...\n');
  
  try {
    await testMDNSDiscovery();
    console.log('\n📡 Testing API communication...\n');
    await testAPICommunication();
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    bonjour.destroy();
  }
}

function testMDNSDiscovery() {
  return new Promise((resolve, reject) => {
    const browser = bonjour.find({ type: 'screenfleet' });
    let timeout;

    browser.on('up', (service) => {
      console.log(`✅ Discovered service: ${service.name}`);
      console.log(`   - Type: ${service.type}`);
      console.log(`   - Port: ${service.port}`);
      console.log(`   - Addresses: ${service.addresses?.join(', ') || 'N/A'}`);
      
      if (service.txt) {
        console.log('   - TXT Record:');
        Object.entries(service.txt).forEach(([key, value]) => {
          console.log(`     ${key}: ${value}`);
        });
      }
      console.log();

      discoveredServices.push(service);
    });

    browser.on('down', (service) => {
      console.log(`⬇️  Service went down: ${service.name}`);
    });

    // Set timeout for discovery
    timeout = setTimeout(() => {
      browser.stop();
      
      if (discoveredServices.length === 0) {
        reject(new Error('No ScreenFleet services discovered. Make sure host agents are running.'));
      } else {
        console.log(`🎉 Discovery complete! Found ${discoveredServices.length} service(s)\n`);
        resolve();
      }
    }, TEST_CONFIG.discoveryTimeout);

    // Handle early completion if we find services quickly
    setTimeout(() => {
      if (discoveredServices.length > 0) {
        clearTimeout(timeout);
        browser.stop();
        console.log(`🎉 Discovery complete! Found ${discoveredServices.length} service(s)\n`);
        resolve();
      }
    }, 3000);
  });
}

async function testAPICommunication() {
  if (discoveredServices.length === 0) {
    throw new Error('No services to test API communication with');
  }

  for (const service of discoveredServices) {
    const address = service.addresses?.[0] || 'localhost';
    const port = service.port || 8080;
    const baseURL = `http://${address}:${port}`;

    console.log(`🔗 Testing API communication with ${service.name} (${baseURL})`);

    try {
      // Test health endpoint
      console.log('   Testing /health endpoint...');
      const healthResponse = await axios.get(`${baseURL}/health`, {
        timeout: TEST_CONFIG.apiTimeout
      });
      
      if (healthResponse.status === 200) {
        console.log('   ✅ Health check passed');
        console.log(`      Status: ${healthResponse.data.data?.status || 'unknown'}`);
        console.log(`      Uptime: ${healthResponse.data.data?.uptime || 'unknown'}s`);
      }

      // Test status endpoint
      console.log('   Testing /api/status endpoint...');
      const statusResponse = await axios.get(`${baseURL}/api/status`, {
        timeout: TEST_CONFIG.apiTimeout
      });
      
      if (statusResponse.status === 200) {
        console.log('   ✅ Status check passed');
        const status = statusResponse.data.data;
        if (status) {
          console.log(`      CPU Usage: ${status.hostStatus?.cpuUsage || 'unknown'}%`);
          console.log(`      Memory Usage: ${status.hostStatus?.memoryUsage || 'unknown'}%`);
          console.log(`      Browser Processes: ${status.hostStatus?.browserProcesses || 'unknown'}`);
        }
      }

      // Test command endpoint with health check command
      console.log('   Testing command dispatch...');
      const commandResponse = await axios.post(`${baseURL}/api/command`, {
        type: 'health_check',
        targetTv: 'display-1',
        payload: {},
        timestamp: new Date()
      }, {
        timeout: TEST_CONFIG.apiTimeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (commandResponse.status === 200) {
        console.log('   ✅ Command dispatch passed');
      }

      console.log(`   🎉 All API tests passed for ${service.name}\n`);

    } catch (error) {
      console.log(`   ❌ API test failed for ${service.name}:`);
      if (error.code === 'ECONNREFUSED') {
        console.log('      Connection refused - is the host agent running?');
      } else if (error.code === 'ETIMEDOUT') {
        console.log('      Request timeout - host agent may be overloaded');
      } else {
        console.log(`      ${error.message}`);
      }
      console.log();
    }
  }
}

// Handle script interruption
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted by user');
  bonjour.destroy();
  process.exit(0);
});

// Start tests
if (require.main === module) {
  runTests().catch((error) => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}
