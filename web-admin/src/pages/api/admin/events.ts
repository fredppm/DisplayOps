import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

interface ControllerData {
  id: string;
  name: string;
  lastHeartbeat: string;
  status: 'online' | 'offline';
  location?: string;
}

interface SiteData {
  id: string;
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  controllers: string[];
}

const HEARTBEAT_TIMEOUT = 30000; // 30 seconds

function getControllers(): ControllerData[] {
  try {
    const controllersPath = path.join(process.cwd(), 'data', 'controllers.json');
    const data = fs.readFileSync(controllersPath, 'utf-8');
    const parsed = JSON.parse(data);
    const controllers = parsed.controllers || [];
    
    // Update status based on heartbeat
    const now = new Date();
    return controllers.map((controller: any) => ({
      ...controller,
      status: controller.lastHeartbeat && 
               (now.getTime() - new Date(controller.lastHeartbeat).getTime()) < HEARTBEAT_TIMEOUT
               ? 'online' : 'offline'
    }));
  } catch (error) {
    console.error('Error reading controllers:', error);
    return [];
  }
}

function getSites(): SiteData[] {
  try {
    const sitesPath = path.join(process.cwd(), 'data', 'sites.json');
    const data = fs.readFileSync(sitesPath, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.sites || [];
  } catch (error) {
    console.error('Error reading sites:', error);
    return [];
  }
}

function calculateSystemHealth(controllers: ControllerData[], sites: SiteData[]) {
  const onlineControllers = controllers.filter(c => c.status === 'online').length;
  const totalControllers = controllers.length;
  const healthySites = sites.filter(s => s.status === 'healthy').length;
  const totalSites = sites.length;
  
  const controllerHealthPercent = totalControllers > 0 ? (onlineControllers / totalControllers) * 100 : 0;
  const siteHealthPercent = totalSites > 0 ? (healthySites / totalSites) * 100 : 0;
  
  let overallStatus: 'healthy' | 'degraded' | 'critical';
  const avgHealth = (controllerHealthPercent + siteHealthPercent) / 2;
  
  if (avgHealth >= 80) {
    overallStatus = 'healthy';
  } else if (avgHealth >= 50) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'critical';
  }
  
  return {
    status: overallStatus,
    controllers: {
      online: onlineControllers,
      total: totalControllers,
      percentage: Math.round(controllerHealthPercent)
    },
    sites: {
      healthy: healthySites,
      total: totalSites,
      percentage: Math.round(siteHealthPercent)
    }
  };
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const sendEvent = (eventType: string, data: any) => {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial data
  const controllers = getControllers();
  const sites = getSites();
  const systemHealth = calculateSystemHealth(controllers, sites);

  sendEvent('health-update', systemHealth);
  sendEvent('controllers-update', controllers);
  sendEvent('sites-update', sites);

  // Set up interval to send updates
  const interval = setInterval(() => {
    try {
      const controllers = getControllers();
      const sites = getSites();
      const systemHealth = calculateSystemHealth(controllers, sites);

      sendEvent('health-update', systemHealth);
      sendEvent('controllers-update', controllers);
    } catch (error) {
      console.error('Error sending SSE update:', error);
    }
  }, 5000); // Send updates every 5 seconds

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(interval);
  });

  req.on('end', () => {
    clearInterval(interval);
  });
}