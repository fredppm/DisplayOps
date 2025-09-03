import { NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { Controller, AutoRegisterControllerRequest, ApiResponse } from '@/types/multi-site-types';
import { AutoRegisterControllerSchema } from '@/schemas/validation';
import { withPermission, ProtectedApiRequest } from '@/lib/api-protection';
import { logger } from '@/utils/logger';

const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');
const SITES_FILE = path.join(process.cwd(), 'data', 'sites.json');

interface ControllersData {
  controllers: Controller[];
}

interface SitesData {
  sites: Array<{
    id: string;
    name: string;
    location: string;
    timezone: string;
    controllers: string[];
    createdAt: string;
    updatedAt: string;
  }>;
}

const AUTO_DISCOVERED_SITE_ID = 'auto-discovered';

async function readControllersData(): Promise<ControllersData> {
  try {
    const data = await fs.readFile(CONTROLLERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logger.warn('Controllers file not found, creating empty data');
    return { controllers: [] };
  }
}

async function writeControllersData(data: ControllersData): Promise<void> {
  try {
    await fs.writeFile(CONTROLLERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Error writing controllers data:', error);
    throw new Error('Failed to write controllers data');
  }
}

async function readSitesData(): Promise<SitesData> {
  try {
    const data = await fs.readFile(SITES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logger.warn('Sites file not found, creating empty data');
    return { sites: [] };
  }
}

async function writeSitesData(data: SitesData): Promise<void> {
  try {
    await fs.writeFile(SITES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Error writing sites data:', error);
    throw new Error('Failed to write sites data');
  }
}

async function ensureAutoDiscoveredSite(sitesData: SitesData): Promise<void> {
  const autoSite = sitesData.sites.find(s => s.id === AUTO_DISCOVERED_SITE_ID);
  
  if (!autoSite) {
    logger.info('Creating auto-discovered site');
    sitesData.sites.push({
      id: AUTO_DISCOVERED_SITE_ID,
      name: 'Auto-Discovered Controllers',
      location: 'Various Locations',
      timezone: 'America/Sao_Paulo',
      controllers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await writeSitesData(sitesData);
  }
}

async function generateControllerId(hostname: string, macAddress: string, siteId?: string): Promise<string> {
  // Generate ID based on hostname and MAC for uniqueness
  const cleanHostname = hostname.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const macSuffix = macAddress.replace(/[:-]/g, '').slice(-6).toLowerCase();
  
  if (siteId) {
    return `${siteId}-${cleanHostname}-${macSuffix}`;
  }
  
  return `${AUTO_DISCOVERED_SITE_ID}-${cleanHostname}-${macSuffix}`;
}

async function handler(req: ProtectedApiRequest, res: NextApiResponse<ApiResponse<Controller>>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`,
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Validate request body
    const validation = AutoRegisterControllerSchema.safeParse(req.body);
    if (!validation.success) {
      logger.error('Auto-register validation failed:', validation.error);
      return res.status(400).json({
        success: false,
        error: validation.error.issues.map(e => e.message).join(', '),
        timestamp: new Date().toISOString()
      });
    }

    const registerData: AutoRegisterControllerRequest = validation.data;
    
    logger.info('Controller auto-registration attempt', {
      hostname: registerData.hostname,
      macAddress: registerData.macAddress,
      siteId: registerData.siteId,
      location: registerData.location
    });

    // Load existing data
    const controllersData = await readControllersData();
    const sitesData = await readSitesData();

    // Check if siteId is provided and exists
    let targetSiteId = registerData.siteId;
    if (targetSiteId) {
      const site = sitesData.sites.find(s => s.id === targetSiteId);
      if (!site) {
        logger.warn('Specified site not found, using auto-discovered', { siteId: targetSiteId });
        targetSiteId = undefined;
      }
    }

    // If no valid siteId, ensure auto-discovered site exists
    if (!targetSiteId) {
      await ensureAutoDiscoveredSite(sitesData);
      targetSiteId = AUTO_DISCOVERED_SITE_ID;
    }

    // Generate unique controller ID
    const controllerId = await generateControllerId(
      registerData.hostname, 
      registerData.macAddress, 
      targetSiteId
    );

    // Check if controller already exists (by MAC address for true uniqueness)
    const existingController = controllersData.controllers.find(
      controller => controller.id === controllerId
    );

    if (existingController) {
      // Update existing controller with new data
      existingController.name = registerData.location || registerData.hostname;
      existingController.localNetwork = registerData.localNetwork;
      existingController.mdnsService = registerData.mdnsService;
      existingController.webAdminUrl = registerData.webAdminUrl || existingController.webAdminUrl;
      existingController.version = registerData.version;
      existingController.status = 'online';
      existingController.lastSync = new Date().toISOString();

      await writeControllersData(controllersData);

      logger.info('Controller updated via auto-registration', { controllerId });

      return res.status(200).json({
        success: true,
        data: existingController,
        timestamp: new Date().toISOString()
      });
    }

    // Create new controller
    const newController: Controller = {
      id: controllerId,
      siteId: targetSiteId,
      name: registerData.location || registerData.hostname,
      localNetwork: registerData.localNetwork,
      mdnsService: registerData.mdnsService,
      webAdminUrl: registerData.webAdminUrl || 'http://localhost:3000',
      status: 'online',
      lastSync: new Date().toISOString(),
      version: registerData.version
    };

    // Add to controllers array
    controllersData.controllers.push(newController);
    await writeControllersData(controllersData);

    // Update site's controllers list
    const targetSite = sitesData.sites.find(s => s.id === targetSiteId);
    if (targetSite) {
      if (!targetSite.controllers.includes(controllerId)) {
        targetSite.controllers.push(controllerId);
        targetSite.updatedAt = new Date().toISOString();
        await writeSitesData(sitesData);
      }
    }

    logger.info('Controller auto-registered successfully', { 
      controllerId, 
      siteId: targetSiteId,
      hostname: registerData.hostname 
    });

    res.status(201).json({
      success: true,
      data: newController,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Controller auto-registration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to register controller',
      timestamp: new Date().toISOString()
    });
  }
}

// Export without authentication for auto-registration
// Controllers need to be able to register themselves without prior authentication
export default handler;