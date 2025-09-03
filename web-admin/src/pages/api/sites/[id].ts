import { NextApiResponse } from 'next';
import { Site, UpdateSiteRequest, ApiResponse } from '@/types/multi-site-types';
import { UpdateSiteSchema } from '@/schemas/validation';
import { withPermission, ProtectedApiRequest } from '@/lib/api-protection';
import { sitesRepository, controllersRepository } from '@/lib/repositories';

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

      // Handle orphaned hosts before deleting site
      try {
        const HOSTS_FILE = path.join(process.cwd(), 'data', 'hosts.json');
        let hostsData = { hosts: [] as any[] };
        
        try {
          const hostsContent = await fs.readFile(HOSTS_FILE, 'utf-8');
          hostsData = JSON.parse(hostsContent);
        } catch (hostsError) {
          console.log('No hosts file found or error reading hosts:', hostsError);
        }

        // Update hosts to remove site association
        let orphanedCount = 0;
        hostsData.hosts = hostsData.hosts.map(host => {
          if (host.siteId === id) {
            orphanedCount++;
            return { ...host, siteId: undefined };
          }
          return host;
        });

        // Write updated hosts data if any changes were made
        if (orphanedCount > 0) {
          try {
            await fs.writeFile(HOSTS_FILE, JSON.stringify(hostsData, null, 2), 'utf-8');
          } catch (writeError) {
            console.error('Error updating hosts file:', writeError);
          }
        }

        console.log(`Site ${id} deleted. ${orphanedCount} hosts were orphaned and updated.`);
      } catch (hostsError) {
        console.error('Error handling orphaned hosts:', hostsError);
        // Continue with site deletion even if host update fails
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