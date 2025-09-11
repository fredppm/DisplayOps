import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { dashboardsRepository } from '@/lib/repositories/DashboardsRepository';
import { controllersRepository } from '@/lib/repositories/ControllersRepository';
import { cookiesRepository } from '@/lib/repositories/CookiesRepository';

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

async function loadDashboards(): Promise<any[]> {
  try {
    return await dashboardsRepository.getAll();
  } catch (error) {
    commandsLogger.error('Error loading dashboards for sync', { error });
    return [];
  }
}

async function loadCookies(): Promise<any> {
  try {
    return await cookiesRepository.getAllAsApiFormat();
  } catch (error) {
    commandsLogger.error('Error loading cookies for sync', { error });
    return { domains: {}, lastUpdated: new Date().toISOString() };
  }
}

function generateCommandId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function getPendingCommands(controllerId: string): Promise<PendingCommand[]> {
  try {
    const controller = await controllersRepository.getById(controllerId);
    if (!controller) {
      return [];
    }

    const commands: PendingCommand[] = [];

    // With WebSocket real-time sync, this HTTP polling is legacy
    // Return current dashboards and cookies for compatibility with older controllers
    
    // Always provide dashboard sync for HTTP polling controllers
    const dashboards = await loadDashboards();
    const syncTimestamp = new Date().toISOString();

    if (dashboards.length > 0) {
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
    }

    // Always provide cookie sync for HTTP polling controllers
    const cookiesData = await loadCookies();
    const cookieSyncTimestamp = new Date().toISOString();

    if (cookiesData.domains && Object.keys(cookiesData.domains).length > 0) {
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
        last_updated: cookieSyncTimestamp
      }));

      commands.push({
        command_id: generateCommandId(),
        controller_id: controllerId,
        type: 'cookie_sync',
        timestamp: cookieSyncTimestamp,
        payload: {
          cookie_domains: cookieDomains,
          sync_timestamp: cookieSyncTimestamp,
          sync_type: 'full'
        }
      });
    }

    // Update lastSync since we provided data
    if (commands.length > 0) {
      await controllersRepository.updateLastSync(controllerId);
    }

    return commands;
  } catch (error) {
    commandsLogger.error('Failed to get pending commands', { controllerId, error });
    return [];
  }
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