import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { getLatestVersionForElectronUpdater } from '@/lib/releases-utils';

const updatesLogger = createContextLogger('api-updates-controller-stable');

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

    // Get platform from query parameters or detect from User-Agent
    let platform = req.query.platform as string;
    
    // If no platform specified, detect from User-Agent
    if (!platform) {
      const userAgent = req.headers['user-agent'] || '';
      
      if (userAgent.includes('Windows')) {
        platform = 'win32';
      } else if (userAgent.includes('Mac')) {
        platform = 'darwin';
      } else if (userAgent.includes('Linux')) {
        platform = 'linux';
      } else {
        platform = 'win32'; // default fallback
      }
    }
    
    updatesLogger.info('Electron updater checking for controller stable updates', { 
      platform,
      userAgent: req.headers['user-agent'],
      detectedFromUserAgent: !req.query.platform
    });

    // Get latest version info from GitHub
    const updateInfo = await getLatestVersionForElectronUpdater('controller', platform);

    if (!updateInfo) {
      updatesLogger.warn('No stable update information available', { platform });
      return res.status(404).json({
        success: false,
        error: 'No stable updates available'
      });
    }

    updatesLogger.info('Stable update information retrieved successfully', {
      version: updateInfo.version,
      platform,
      url: updateInfo.url
    });

    // Convert to YAML format that electron-updater expects
    const filename = updateInfo.url.split('/').pop() || 'unknown';
    const yamlResponse = `version: ${updateInfo.version}
files:
  - url: ${updateInfo.url}
    sha512: ${updateInfo.sha512 || ''}
    size: ${updateInfo.size || 0}
path: ${filename}
sha512: ${updateInfo.sha512 || ''}
releaseDate: '${updateInfo.releaseDate}'`;

    // Set content type as YAML
    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    return res.status(200).send(yamlResponse);

  } catch (error: any) {
    updatesLogger.error('Controller stable updates API error', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Return plain text error for electron-updater compatibility
    res.setHeader('Content-Type', 'text/plain');
    return res.status(500).send('Internal server error');
  }
}

export default handler;