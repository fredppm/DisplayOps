import { NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { ApiResponse } from '@/types/multi-site-types';
import { withPermission, ProtectedApiRequest } from '@/lib/api-protection';

const HOSTS_FILE = path.join(process.cwd(), 'data', 'hosts.json');

interface Host {
  id: string;
  name: string;
  ip: string;
  siteId?: string;
  status: 'online' | 'offline' | 'error';
  lastSeen?: string;
}

interface HostsData {
  hosts: Host[];
}

async function readHostsData(): Promise<HostsData> {
  try {
    const data = await fs.readFile(HOSTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading hosts data:', error);
    return { hosts: [] };
  }
}

async function handler(req: ProtectedApiRequest, res: NextApiResponse<ApiResponse<string[]>>) {
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
      const data = await readHostsData();
      
      // Find hosts that are associated with this site
      const orphanedHosts = data.hosts
        .filter(host => host.siteId === id)
        .map(host => host.name);

      res.status(200).json({
        success: true,
        data: orphanedHosts,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch orphaned hosts',
        timestamp: new Date().toISOString()
      });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`,
      timestamp: new Date().toISOString()
    });
  }
}

export default withPermission('sites:read')(handler);