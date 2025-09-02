const axios = require('axios');
const BonjourService = require('bonjour-service');

const TEST_CONFIG = {
  webControllerPort: 3002,
  hostAgentPort: 8080,
  timeout: 10000
};

/**
 * Test script to validate mDNS discovery fixes
 * 
 * Tests:
 * 1. mDNS service doesn't restart constantly 
 * 2. Web controller /hosts endpoint returns 200 (not 500)
 * 3. Host discovery works properly
 * 4. No excessive service restarts in logs
 */

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) {
    console.log(`   ${details}`);
  }
  console.log('');
  
  testResults.tests.push({ name, passed, details });
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testHostsEndpoint() {
  console.log('🧪 Testing /hosts endpoint for 500 errors...');
  
  try {
    const response = await axios.get(`http://localhost:${TEST_CONFIG.webControllerPort}/api/discovery/hosts`, {
      timeout: TEST_CONFIG.timeout
    });
    
    if (response.status === 200) {
      logTest('Hosts endpoint returns 200', true, `Response: ${response.status}, Hosts found: ${response.data.data?.length || 0}`);
      
      // Check for warnings in response (indicates graceful degradation)
      if (response.data.warning) {
        console.log(`   ⚠️ Warning present: ${response.data.warning}`);
      }
      
      return response.data;
    } else {
      logTest('Hosts endpoint returns 200', false, `Expected 200, got ${response.status}`);
      return null;
    }
  } catch (error) {
    if (error.response?.status === 500) {
      logTest('Hosts endpoint returns 200', false, `Got 500 error: ${error.message}`);
    } else {
      logTest('Hosts endpoint returns 200', false, `Network error: ${error.message}`);
    }
    return null;
  }
}

async function testMDNSServiceStability() {
  console.log('🧪 Testing mDNS service stability (checking for constant restarts)...');
  
  const bonjour = new BonjourService();
  const discoveredServices = new Set();
  const serviceEvents = [];
  
  return new Promise((resolve) => {
    const browser = bonjour.find({ type: '_screenfleet._tcp' });
    
    browser.on('up', (service) => {
      const serviceKey = `${service.name}-${service.port}`;
      const timestamp = new Date().toISOString();
      
      serviceEvents.push({ type: 'up', service: serviceKey, timestamp });
      discoveredServices.add(serviceKey);
      
      console.log(`   📡 Service UP: ${serviceKey} at ${timestamp}`);
    });
    
    browser.on('down', (service) => {
      const serviceKey = `${service.name}-${service.port}`;
      const timestamp = new Date().toISOString();
      
      serviceEvents.push({ type: 'down', service: serviceKey, timestamp });
      
      console.log(`   📡 Service DOWN: ${serviceKey} at ${timestamp}`);
    });
    
    // Test for 30 seconds
    setTimeout(() => {
      browser.stop();
      bonjour.destroy();
      
      const upEvents = serviceEvents.filter(e => e.type === 'up');
      const downEvents = serviceEvents.filter(e => e.type === 'down');
      
      // Check for excessive restarts (more than 2 up events for same service indicates restarts)
      const serviceUpCounts = {};
      upEvents.forEach(event => {
        serviceUpCounts[event.service] = (serviceUpCounts[event.service] || 0) + 1;
      });
      
      const excessiveRestarts = Object.entries(serviceUpCounts).filter(([service, count]) => count > 2);
      
      if (excessiveRestarts.length === 0) {
        logTest('mDNS service stability', true, 
          `No excessive restarts detected. Services found: ${discoveredServices.size}, Total events: ${serviceEvents.length}`);
      } else {
        logTest('mDNS service stability', false, 
          `Excessive restarts detected: ${excessiveRestarts.map(([s, c]) => `${s} (${c} restarts)`).join(', ')}`);
      }
      
      resolve({
        servicesFound: discoveredServices.size,
        totalEvents: serviceEvents.length,
        upEvents: upEvents.length,
        downEvents: downEvents.length,
        excessiveRestarts: excessiveRestarts.length
      });
    }, 30000); // 30 seconds
  });
}

async function testHostAgentStatus() {
  console.log('🧪 Testing host agent status endpoint...');
  
  try {
    const response = await axios.get(`http://localhost:${TEST_CONFIG.hostAgentPort}/api/status`, {
      timeout: TEST_CONFIG.timeout
    });
    
    if (response.status === 200 && response.data.success) {
      logTest('Host agent status endpoint', true, `Response: ${response.status}, Agent healthy`);
      return response.data;
    } else {
      logTest('Host agent status endpoint', false, `Unexpected response: ${response.status}`);
      return null;
    }
  } catch (error) {
    logTest('Host agent status endpoint', false, `Error: ${error.message}`);
    return null;
  }
}

async function runAllTests() {
  console.log('🚀 Starting mDNS Discovery Fix Validation Tests');
  console.log('=====================================\n');
  
  // Test 1: Hosts endpoint should not return 500
  await testHostsEndpoint();
  
  // Test 2: Host agent should be healthy
  await testHostAgentStatus();
  
  // Test 3: mDNS service stability (this takes 30 seconds)
  console.log('⏰ Running 30-second mDNS stability test...');
  await testMDNSServiceStability();
  
  // Test 4: Second hosts endpoint call should still work
  console.log('🔄 Testing hosts endpoint again after mDNS test...');
  await testHostsEndpoint();
  
  // Summary
  console.log('=====================================');
  console.log('🎯 Test Summary:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.tests.length}`);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed! mDNS discovery fixes are working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Check the results above for details.');
  }
  
  console.log('\n📝 Individual test results:');
  testResults.tests.forEach((test, i) => {
    const status = test.passed ? '✅' : '❌';
    console.log(`${i + 1}. ${status} ${test.name}`);
    if (test.details && !test.passed) {
      console.log(`   ${test.details}`);
    }
  });
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n⚠️ Test interrupted');
  process.exit(1);
});

// Run tests
runAllTests().catch(error => {
  console.error('💥 Test runner error:', error);
  process.exit(1);
});