import { NextApiRequest, NextApiResponse } from 'next';
import { Controller } from '@/types/multi-site-types';
import { createContextLogger } from '@/utils/logger';
import { controllersRepository } from '@/lib/repositories/ControllersRepository';
import { sitesRepository } from '@/lib/repositories/SitesRepository';

const registerLogger = createContextLogger('controller-register');

interface RegistrationRequest {
  controller_id: string;
  hostname: string;
  mac_address: string;
  local_network: string;
  version: string;
  location?: string;
  site_id?: string;
  mdns_service: string;
  web_admin_url: string;
  system_info: {
    platform: string;
    arch: string;
    node_version: string;
    controller_version: string;
    total_memory_gb: number;
    cpu_cores: number;
    cpu_model: string;
  };
}

interface RegistrationResponse {
  success: boolean;
  message: string;
  assigned_controller_id?: string;
  assigned_site_id?: string;
  timestamp: string;
}

// PostgreSQL functions are imported from data-postgres.ts

async function registerController(controllerId: string, registrationData: RegistrationRequest): Promise<Controller> {
  // Load data from repositories
  const controllers = await controllersRepository.getAll();
  const sites = await sitesRepository.getAll();
  
  let targetSiteId = registrationData.site_id || undefined;
  if (targetSiteId) {
    const site = sites.find((s: any) => s.id === targetSiteId);
    if (!site) {
      targetSiteId = undefined;
    }
  }

  const existingController = controllers.find(
    (c: Controller) => c.id === controllerId
  );

  if (existingController) {
    // Update existing controller using repository
    const updatedController = await controllersRepository.update(controllerId, {
      name: registrationData.location || registrationData.hostname,
      localNetwork: registrationData.local_network || existingController.localNetwork || '',
      mdnsService: registrationData.mdns_service || existingController.mdnsService || '',
      controllerUrl: registrationData.web_admin_url || existingController.controllerUrl || 'http://localhost:3000',
      version: registrationData.version || existingController.version || '1.0.0',
      status: 'online',
      lastSync: new Date().toISOString()
    });

    return updatedController!;
  }

  // Create new controller using repository
  const newController: Controller = {
    id: controllerId,
    siteId: targetSiteId || '',
    name: registrationData.location || registrationData.hostname,
    localNetwork: registrationData.local_network || '',
    mdnsService: registrationData.mdns_service || '',
    controllerUrl: registrationData.web_admin_url || 'http://localhost:3000',
    status: 'online',
    lastSync: new Date().toISOString(),
    version: registrationData.version || '1.0.0'
  };

  const createdController = await controllersRepository.create(newController);

  // Update site if specified
  if (targetSiteId) {
    const targetSite = sites.find((s: any) => s.id === targetSiteId);
    if (targetSite && !targetSite.controllers.includes(controllerId)) {
      targetSite.controllers.push(controllerId);
      await sitesRepository.update(targetSiteId, {
        controllers: targetSite.controllers,
        updatedAt: new Date().toISOString()
      });
    }
  }

  return createdController;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const registrationData: RegistrationRequest = req.body;

    if (!registrationData.controller_id) {
      return res.status(400).json({ 
        success: false,
        message: 'Controller ID is required',
        timestamp: new Date().toISOString()
      });
    }

    if (!registrationData.hostname || !registrationData.mac_address) {
      return res.status(400).json({ 
        success: false,
        message: 'Hostname and MAC address are required',
        timestamp: new Date().toISOString()
      });
    }

    registerLogger.info('Processing HTTP controller registration', {
      controller_id: registrationData.controller_id,
      hostname: registrationData.hostname,
      location: registrationData.location
    });

    const controller = await registerController(registrationData.controller_id, registrationData);

    const response: RegistrationResponse = {
      success: true,
      message: `Controller registered successfully as ${controller.name}`,
      assigned_controller_id: controller.id,
      assigned_site_id: controller.siteId,
      timestamp: new Date().toISOString()
    };

    registerLogger.info('HTTP controller registration successful', {
      controller_id: controller.id,
      name: controller.name,
      siteId: controller.siteId
    });

    res.status(200).json(response);

  } catch (error) {
    registerLogger.error('HTTP controller registration failed:', error);
    
    const errorResponse: RegistrationResponse = {
      success: false,
      message: `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(errorResponse);
  }
}