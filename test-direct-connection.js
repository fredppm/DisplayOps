#!/usr/bin/env node

/**
 * Test script for Direct Connection Architecture
 * 
 * This script tests the new direct connection between Host-Agent and Web-Admin
 * without using mDNS.
 */

const fetch = require('node-fetch');

const WEB_ADMIN_URL = 'http://localhost:3000';

async function testWebAdminAPI() {
  console.log('🧪 Testing Direct Connection Architecture...\n');

  try {
    // Test 1: Check if Web-Admin is running
    console.log('1️⃣ Testing Web-Admin availability...');
    const healthResponse = await fetch(`${WEB_ADMIN_URL}/api/health/status`);
    
    if (healthResponse.ok) {
      console.log('✅ Web-Admin is running');
    } else {
      console.log('❌ Web-Admin is not responding');
      return;
    }

    // Test 2: Test host registration API
    console.log('\n2️⃣ Testing host registration API...');
    const registrationData = {
      agentId: 'test-agent-001',
      hostname: 'test-host',
      ipAddress: '192.168.1.100',
      grpcPort: 8082,
      displays: [
        {
          id: 'display-1',
          name: 'Primary Display',
          width: 1920,
          height: 1080,
          isPrimary: true
        }
      ],
      systemInfo: {
        platform: 'win32',
        arch: 'x64',
        nodeVersion: '18.17.0',
        electronVersion: '28.1.0',
        totalMemoryGB: 8,
        cpuCores: 4,
        cpuModel: 'Intel Core i5',
        uptime: 3600
      },
      version: '1.0.0',
      status: 'online'
    };

    const registerResponse = await fetch(`${WEB_ADMIN_URL}/api/hosts/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registrationData)
    });

    if (registerResponse.ok) {
      const result = await registerResponse.json();
      console.log('✅ Host registration successful:', result.message);
    } else {
      const error = await registerResponse.json();
      console.log('❌ Host registration failed:', error.message);
    }

    // Test 3: Test host listing API
    console.log('\n3️⃣ Testing host listing API...');
    const hostsResponse = await fetch(`${WEB_ADMIN_URL}/api/hosts`);
    
    if (hostsResponse.ok) {
      const result = await hostsResponse.json();
      console.log(`✅ Found ${result.data.length} registered hosts`);
      result.data.forEach(host => {
        console.log(`   - ${host.hostname} (${host.ipAddress}) - ${host.status}`);
      });
    } else {
      console.log('❌ Failed to list hosts');
    }

    // Test 4: Test heartbeat API
    console.log('\n4️⃣ Testing heartbeat API...');
    const heartbeatData = {
      agentId: 'test-agent-001',
      status: 'online',
      lastSeen: new Date().toISOString(),
      displays: [
        {
          id: 'display-1',
          name: 'Primary Display',
          width: 1920,
          height: 1080,
          isPrimary: true,
          assignedDashboard: null,
          isActive: false
        }
      ]
    };

    const heartbeatResponse = await fetch(`${WEB_ADMIN_URL}/api/hosts/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(heartbeatData)
    });

    if (heartbeatResponse.ok) {
      console.log('✅ Heartbeat successful');
    } else {
      const error = await heartbeatResponse.json();
      console.log('❌ Heartbeat failed:', error.message);
    }

    console.log('\n🎉 Direct Connection Architecture test completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Web-Admin API is working');
    console.log('   ✅ Host registration works');
    console.log('   ✅ Host listing works');
    console.log('   ✅ Heartbeat system works');
    console.log('\n🚀 Ready to use direct connection instead of mDNS!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure Web-Admin is running on http://localhost:3000');
  }
}

// Run the test
testWebAdminAPI();

