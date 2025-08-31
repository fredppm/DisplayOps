const { Bonjour } = require('bonjour-service');

console.log('🔍 Scanning for mDNS services (_officedisplay._tcp)...');
console.log('⏰ Scanning for 15 seconds...\n');

const bonjour = new Bonjour();
let foundServices = [];

try {
  const browser = bonjour.find({ type: '_officedisplay._tcp' });
  
  browser.on('up', service => {
    const serviceInfo = {
      name: service.name,
      type: service.type,
      port: service.port,
      host: service.host,
      addresses: service.addresses,
      txt: service.txt
    };
    
    foundServices.push(serviceInfo);
    
    console.log('✅ Found _officedisplay service:');
    console.log(`   Name: ${service.name}`);
    console.log(`   Type: ${service.type}`);
    console.log(`   Port: ${service.port} (API)`);
    console.log(`   Host: ${service.host}`);
    console.log(`   Addresses: ${service.addresses?.join(', ') || 'none'}`);
    if (service.txt && Object.keys(service.txt).length > 0) {
      console.log(`   TXT: ${JSON.stringify(service.txt)}`);
      if (service.txt.grpcPort) {
        console.log(`   📡 gRPC Port: ${service.txt.grpcPort}`);
      }
    }
    console.log('');
  });
  
  browser.on('down', service => {
    console.log(`❌ Service went down: ${service.name}`);
  });
  
  // Also scan for all services to see what's available
  const allBrowser = bonjour.find({});
  allBrowser.on('up', service => {
    if (!service.type.includes('_officedisplay')) {
      console.log(`📡 Other service: ${service.name} (${service.type}) on port ${service.port}`);
    }
  });
  
  // Scan for 15 seconds
  setTimeout(() => {
    browser.stop();
    allBrowser.stop();
    bonjour.destroy();
    
    console.log('=====================================');
    console.log('📊 Scan Results:');
    console.log(`🎯 Found ${foundServices.length} _officedisplay._tcp services`);
    
    if (foundServices.length === 0) {
      console.log('\n❌ No _officedisplay._tcp services found.');
      console.log('💡 Possible reasons:');
      console.log('   - Host agent is not running');
      console.log('   - mDNS is not working on this network');
      console.log('   - Firewall blocking mDNS traffic (port 5353 UDP)');
      console.log('   - Service is advertising on different interface');
      console.log('   - Windows mDNS service not running');
      console.log('\n🔧 Try these troubleshooting steps:');
      console.log('   1. Start host agent: npm run start:host');
      console.log('   2. Check firewall: netstat -an | findstr :5353');
      console.log('   3. Verify Bonjour service is running');
      console.log('   4. Try connecting directly: http://localhost:8080');
    } else {
      console.log('\n✅ Services found! Connection info:');
      foundServices.forEach(service => {
        const address = service.addresses?.[0] || service.host;
        console.log(`   HTTP API: http://${address}:${service.port}`);
        if (service.txt?.grpcPort) {
          console.log(`   gRPC: ${address}:${service.txt.grpcPort}`);
        }
        console.log(`   Service: ${service.name}`);
        console.log('');
      });
    }
    
    process.exit(0);
  }, 30000);
  
} catch (error) {
  console.log(`❌ Scanner error: ${error.message}`);
  process.exit(1);
}

console.log('🔍 Scanning... (press Ctrl+C to stop)');