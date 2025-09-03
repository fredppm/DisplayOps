import { NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { Site, UpdateSiteRequest, ApiResponse } from '@/types/multi-site-types';
import { UpdateSiteSchema } from '@/schemas/validation';
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

async function handler(req: ProtectedApiRequest, res: NextApiResponse<ApiResponse<Site>>) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Site ID is required',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === 'GET') {
    try {
      const data = await readSitesData();
      const site = data.sites.find(s => s.id === id);

      if (!site) {
        return res.status(404).json({
          success: false,
          error: 'Site not found',
          timestamp: new Date().toISOString()
        });
      }

      res.status(200).json({
        success: true,
        data: site,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch site',
        timestamp: new Date().toISOString()
      });
    }
  } else if (req.method === 'PUT') {
    try {
      // Validate request body
      const validation = UpdateSiteSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: validation.error.issues.map(e => e.message).join(', '),
          timestamp: new Date().toISOString()
        });
      }

      const updateData: UpdateSiteRequest = validation.data;
      const data = await readSitesData();
      
      const siteIndex = data.sites.findIndex(s => s.id === id);
      if (siteIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Site not found',
          timestamp: new Date().toISOString()
        });
      }

      // If name is being updated, check for conflicts with new ID
      if (updateData.name && updateData.name !== data.sites[siteIndex].name) {
        const newSiteId = updateData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const existingSite = data.sites.find(site => site.id === newSiteId && site.id !== id);
        
        if (existingSite) {
          return res.status(409).json({
            success: false,
            error: 'A site with this name already exists',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Update site
      const updatedSite: Site = {
        ...data.sites[siteIndex],
        ...updateData,
        // If name changed, update the ID
        ...(updateData.name && updateData.name !== data.sites[siteIndex].name 
          ? { id: updateData.name.toLowerCase().replace(/[^a-z0-9]/g, '-') }
          : {}
        ),
        updatedAt: new Date().toISOString()
      };

      data.sites[siteIndex] = updatedSite;
      
      // Write back to file
      await writeSitesData(data);

      res.status(200).json({
        success: true,
        data: updatedSite,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update site',
        timestamp: new Date().toISOString()
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const data = await readSitesData();
      
      const siteIndex = data.sites.findIndex(s => s.id === id);
      if (siteIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Site not found',
          timestamp: new Date().toISOString()
        });
      }

      const site = data.sites[siteIndex];

      // Check if site has controllers before deleting
      if (site.controllers && site.controllers.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete site with associated controllers. Remove controllers first.',
          timestamp: new Date().toISOString()
        });
      }

      // Remove site from array
      data.sites.splice(siteIndex, 1);
      
      // Write back to file
      await writeSitesData(data);

      res.status(200).json({
        success: true,
        data: site,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete site',
        timestamp: new Date().toISOString()
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`,
      timestamp: new Date().toISOString()
    });
  }
}

// Export with authentication and permission checking
// All methods require 'sites:read' permission minimum
export default withPermission('sites:read')(handler);