const express = require('express');

// Create a simple mock host agent with mDNS info
const app = express();

// Manual CORS setup instead of requiring cors module
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

// Simulate host agent status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: {
      hostStatus: {
        cpuUsage: 15.5,
        memoryUsage: 45.2,
        browserProcesses: 2
      },
      displayStatuses: [
        {
          active: true,
          currentUrl: 'http://example.com/dashboard',
          lastRefresh: new Date(),
          isResponsive: true,
          errorCount: 0
        }
      ],
      systemInfo: {
        uptime: 3600,
        platform: 'win32',
        nodeVersion: '18.0.0',
        agentVersion: '1.0.0'
      }
    }
  });
});

// NEW: mDNS info endpoint (this is our solution!)
app.get('/api/mdns/info', (req, res) => {
  res.json({
    success: true,
    data: {
      isAdvertising: true,
      serviceInfo: {
        name: 'OFFICE-PC-001-agent-123',
        type: '_officetv._tcp.local',
        port: 8080,
        txt: {
          version: '1.0.0',
          agentId: 'agent-123',
          hostname: 'OFFICE-PC-001',
          displayCount: '2',
          displays: 'display-1,display-2',
          platform: 'win32',
          arch: 'x64',
          uptime: '3600',
          nodeVersion: 'v18.0.0',
          electronVersion: '25.0.0',
          status: 'online',
          timestamp: new Date().toISOString()
        },
        addresses: ['127.0.0.1', '192.168.1.100']
      }
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      version: '1.0.0',
      timestamp: new Date()
    }
  });
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`🎯 Mock Host Agent running on port ${PORT}`);
  console.log(`📡 mDNS info available at: http://localhost:${PORT}/api/mdns/info`);
  console.log(`🏥 Health check at: http://localhost:${PORT}/health`);
  console.log(`📊 Status at: http://localhost:${PORT}/api/status`);
  console.log('');
  console.log('✨ This demonstrates the SOLUTION to the mDNS "N/A" problem!');
  console.log('The web-controller will now be able to show mDNS service information.');
});
