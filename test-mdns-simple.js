#!/usr/bin/env node

// Use the same bonjour-service import as the host agent
const BonjourService = require('bonjour-service');

console.log('🔍 Testing mDNS discovery with same module as host agent...');

const bonjour = new BonjourService();
let foundHosts = [];
let searchComplete = false;

console.log('📡 Starting browser for _officedisplay._tcp services...');

// Browse for services
const browser = bonjour.find({ type: 'officedisplay', protocol: 'tcp' }, (service) => {
  console.log('✅ Found service via callback:', {
    name: service.name,
    type: service.type,
    host: service.host,
    port: service.port,
    addresses: service.addresses,
    txt: service.txt
  });
  
  foundHosts.push(service);
});

browser.on('up', (service) => {
  console.log('✅ Found service via event:', {
    name: service.name,
    type: service.type,
    host: service.host,
    port: service.port,
    addresses: service.addresses,
    txt: service.txt
  });
  
  foundHosts.push(service);
});

browser.on('down', (service) => {
  console.log('❌ Service went down:', service.name);
});

// Try both service type formats
const browser2 = bonjour.find({ type: '_officedisplay._tcp' }, (service) => {
  console.log('✅ Found _officedisplay._tcp service:', {
    name: service.name,
    type: service.type,
    host: service.host,
    port: service.port,
    addresses: service.addresses,
    txt: service.txt
  });
  
  foundHosts.push(service);
});

// Also try browsing all services to see what's available
console.log('🔍 Browsing all available mDNS services...');
const allBrowser = bonjour.find({}, (service) => {
  if (service.name && service.name.toLowerCase().includes('vtex')) {
    console.log('🎯 Found VTEX-related service:', {
      name: service.name,
      type: service.type,
      port: service.port
    });
  }
});

setTimeout(() => {
  console.log(`\n📊 Discovery Results:`);
  console.log(`Found ${foundHosts.length} Office Display hosts.`);
  
  if (foundHosts.length === 0) {
    console.log('❌ No Office Display hosts found via mDNS');
    console.log('This suggests the mDNS service might not be properly advertised.');
  } else {
    foundHosts.forEach((host, index) => {
      console.log(`  ${index + 1}. ${host.name} on ${host.addresses?.[0] || host.host}:${host.port}`);
    });
  }
  
  searchComplete = true;
  browser.stop();
  browser2.stop();
  allBrowser.stop();
  bonjour.destroy();
  process.exit(0);
}, 5000);

console.log('Scanning for 5 seconds...');