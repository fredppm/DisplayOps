import { NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { Site, CreateSiteRequest, ApiResponse } from '@/types/multi-site-types';
import { CreateSiteSchema } from '@/schemas/validation';
import { withPermission, ProtectedApiRequest } from '@/lib/api-protection';

const SITES_FILE = path.join(process.cwd(), 'data', 'sites.json');

interface SitesData {
  sites: Site[];
}

async function readSitesData(): Promise<SitesData> {
  try {
    const data = await fs.readFile(SITES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading sites data:', error);
    return { sites: [] };
  }
}

async function writeSitesData(data: SitesData): Promise<void> {
  try {
    await fs.writeFile(SITES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing sites data:', error);
    throw new Error('Failed to write sites data');
  }
}

async function handler(req: ProtectedApiRequest, res: NextApiResponse<ApiResponse<Site[] | Site>>) {
  if (req.method === 'GET') {
    try {
      const data = await readSitesData();
      
      res.status(200).json({
        success: true,
        data: data.sites,
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
      const data = await readSitesData();

      // Check if site ID already exists (based on name)
      const siteId = createData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const existingSite = data.sites.find(site => site.id === siteId);
      
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
        controllers: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Add to sites array
      data.sites.push(newSite);
      
      // Write back to file
      await writeSitesData(data);

      res.status(201).json({
        success: true,
        data: newSite,
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