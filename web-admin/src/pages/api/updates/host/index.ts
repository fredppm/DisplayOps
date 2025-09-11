import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { getLatestVersionForElectronUpdater } from '@/lib/releases-utils';

const updatesLogger = createContextLogger('api-updates-host');

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({
        success: false,
        error: `Method ${req.method} Not Allowed`
      });
    }

    // Get platform from query parameters (default to win32)
    const platform = (req.query.platform as string) || 'win32';
    
    updatesLogger.info('Checking for host updates', { 
      platform,
      userAgent: req.headers['user-agent']
    });

    // Get latest version info in electron-updater format from GitHub
    const updateInfo = await getLatestVersionForElectronUpdater('host', platform);

    if (!updateInfo) {
      updatesLogger.warn('No update information available', { platform });
      return res.status(404).json({
        success: false,
        error: 'No updates available'
      });
    }

    updatesLogger.info('Update information retrieved successfully', {
      version: updateInfo.version,
      platform,
      url: updateInfo.url
    });

    // Return response in electron-updater format
    return res.status(200).json(updateInfo);

  } catch (error: any) {
    updatesLogger.error('Host updates API error', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

export default handler;