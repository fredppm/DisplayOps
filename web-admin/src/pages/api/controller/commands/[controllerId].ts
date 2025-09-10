import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { createContextLogger } from '@/utils/logger';

const commandsLogger = createContextLogger('controller-commands');

interface PendingCommand {
  command_id: string;
  controller_id: string;
  type: 'dashboard_sync' | 'cookie_sync' | 'config_update' | 'status_request';
  timestamp: string;
  payload: any;
}

interface CommandsResponse {
  commands: PendingCommand[];
  timestamp: string;
}

async function readControllersData(filePath: string): Promise<{ controllers: any[] }> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { controllers: [] };
  }
}

async function loadDashboards(): Promise<any[]> {
  const DASHBOARDS_FILE = path.join(process.cwd(), 'data', 'dashboards.json');
  try {
    const data = await fs.readFile(DASHBOARDS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : parsed.dashboards || [];
  } catch (error) {
    commandsLogger.error('Error loading dashboards for sync', { error });
    return [];
  }
}

async function loadCookies(): Promise<any> {
  const COOKIES_FILE = path.join(process.cwd(), 'data', 'cookies.json');
  try {
    const data = await fs.readFile(COOKIES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    commandsLogger.error('Error loading cookies for sync', { error });
    return { domains: {}, lastUpdated: new Date().toISOString() };
  }
}

function generateCommandId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function getPendingCommands(controllerId: string): Promise<PendingCommand[]> {
  const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
  const controllersData = await readControllersData(CONTROLLERS_FILE);
  
  const controller = controllersData.controllers.find((c: any) => c.id === controllerId);
  if (!controller) {
    return [];
  }

  const commands: PendingCommand[] = [];

  // Check for pending dashboard sync
  if (controller.pendingDashboardSync) {
    const dashboards = await loadDashboards();
    const syncTimestamp = new Date().toISOString();

    commands.push({
      command_id: generateCommandId(),
      controller_id: controllerId,
      type: 'dashboard_sync',
      timestamp: syncTimestamp,
      payload: {
        dashboards: dashboards.map(d => ({
          id: d.id,
          name: d.name,
          url: d.url,
          description: d.description,
          refresh_interval: d.refreshInterval,
          requires_auth: d.requiresAuth,
          category: d.category || ''
        })),
        sync_timestamp: syncTimestamp,
        sync_type: 'full'
      }
    });

    // Clear the pending flag after creating the command
    controller.pendingDashboardSync = false;
    controller.dashboardSyncTimestamp = null;
  }

  // Check for pending cookie sync
  if (controller.pendingCookieSync) {
    const cookiesData = await loadCookies();
    const syncTimestamp = new Date().toISOString();

    const cookieDomains = Object.values(cookiesData.domains).map((domain: any) => ({
      domain: domain.domain,
      description: domain.description,
      cookies: domain.cookies.map((cookie: any) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        http_only: cookie.httpOnly,
        same_site: cookie.sameSite,
        expiration_date: cookie.expirationDate,
        description: cookie.description || ''
      })),
      last_updated: syncTimestamp
    }));

    commands.push({
      command_id: generateCommandId(),
      controller_id: controllerId,
      type: 'cookie_sync',
      timestamp: syncTimestamp,
      payload: {
        cookie_domains: cookieDomains,
        sync_timestamp: syncTimestamp,
        sync_type: 'full'
      }
    });

    // Clear the pending flag after creating the command
    controller.pendingCookieSync = false;
    controller.cookieSyncTimestamp = null;
  }

  // Save changes if any flags were cleared
  if (commands.length > 0) {
    await fs.writeFile(CONTROLLERS_FILE, JSON.stringify(controllersData, null, 2), 'utf-8');
  }

  return commands;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { controllerId } = req.query;

    if (!controllerId || typeof controllerId !== 'string') {
      return res.status(400).json({ 
        error: 'Controller ID is required',
        timestamp: new Date().toISOString()
      });
    }

    commandsLogger.debug('Polling for pending commands', { controllerId });

    const commands = await getPendingCommands(controllerId);

    const response: CommandsResponse = {
      commands,
      timestamp: new Date().toISOString()
    };

    if (commands.length > 0) {
      commandsLogger.info('Returning pending commands via HTTP polling', {
        controllerId,
        commandsCount: commands.length,
        types: commands.map(c => c.type)
      });
    }

    res.status(200).json(response);

  } catch (error) {
    commandsLogger.error('Failed to get pending commands:', error);
    
    res.status(500).json({
      error: `Failed to get commands: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString()
    });
  }
}