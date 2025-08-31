#!/usr/bin/env node

const BonjourService = require('bonjour-service').default;

console.log('🔍 Starting mDNS discovery test for Office Display hosts...');

const bonjour = new BonjourService();
let foundHosts = [];

// Browse for _officedisplay._tcp services
const browser = bonjour.find({ type: '_officedisplay._tcp' });

browser.on('up', (service) => {
  console.log('✅ Found Office Display host:', {
    name: service.name,
    type: service.type,
    host: service.host,
    port: service.port,
    addresses: service.addresses,
    txt: service.txt
  });
  
  foundHosts.push(service);
  
  // Test gRPC connection if this is our expected port
  if (service.port === 8082) {
    console.log('🎯 Found host on gRPC port 8082 - this looks correct!');
  } else if (service.port === 8080) {
    console.log('⚠️ Found host on old REST API port 8080 - this should be updated');
  }
});

browser.on('down', (service) => {
  console.log('❌ Host went down:', service.name);
  foundHosts = foundHosts.filter(h => h.name !== service.name);
});

// Stop after 10 seconds
setTimeout(() => {
  console.log(`\n📊 Discovery Results:`);
  console.log(`Found ${foundHosts.length} Office Display hosts:`);
  
  foundHosts.forEach((host, index) => {
    console.log(`  ${index + 1}. ${host.name}`);
    console.log(`     Address: ${host.addresses?.[0] || host.host}:${host.port}`);
    console.log(`     Agent ID: ${host.txt?.agentId || 'unknown'}`);
    console.log(`     Port: ${host.port} ${host.port === 8082 ? '(gRPC ✅)' : host.port === 8080 ? '(Legacy REST ⚠️)' : ''}`);
  });
  
  if (foundHosts.length === 0) {
    console.log('❌ No Office Display hosts found via mDNS');
  } else {
    console.log('✅ mDNS discovery working correctly!');
  }
  
  browser.stop();
  bonjour.destroy();
  process.exit(0);
}, 10000);

console.log('Scanning for 10 seconds...');