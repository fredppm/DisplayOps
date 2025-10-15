import { NextApiResponse } from 'next';
import { Site, CreateSiteRequest, ApiResponse } from '@/types/multi-site-types';
import { CreateSiteSchema } from '@/schemas/validation';
import { withPermission, ProtectedApiRequest } from '@/lib/api-protection';
import { sitesRepository } from '@/lib/repositories';

async function handler(req: ProtectedApiRequest, res: NextApiResponse<ApiResponse<Site[] | Site>>) {
  if (req.method === 'GET') {
    try {
      const sites = await sitesRepository.getAll();
      
      res.status(200).json({
        success: true,
        data: sites,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch sites',
        timestamp: new Date().toISOString()
      });
    }
  } else if (req.method === 'POST') {
    try {
      // Validate request body
      const validation = CreateSiteSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: validation.error.issues.map(e => e.message).join(', '),
          timestamp: new Date().toISOString()
        });
      }

      const createData: CreateSiteRequest = validation.data;

      // Check if site ID already exists (based on name)
      const siteId = createData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const existingSite = await sitesRepository.getById(siteId);
      
      if (existingSite) {
        return res.status(409).json({
          success: false,
          error: 'A site with this name already exists',
          timestamp: new Date().toISOString()
        });
      }

      // Create new site
      const newSite: Site = {
        id: siteId,
        name: createData.name,
        location: createData.location,
        timezone: createData.timezone,
        status: 'offline', // Sites iniciam offline até hosts conectarem
        hosts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save using repository
      const createdSite = await sitesRepository.create(newSite);

      res.status(201).json({
        success: true,
        data: createdSite,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create site',
        timestamp: new Date().toISOString()
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`,
      timestamp: new Date().toISOString()
    });
  }
}

// Export with authentication and permission checking
// GET requires 'sites:read' permission
// POST requires 'sites:create' permission  
export default withPermission('sites:read')(handler);