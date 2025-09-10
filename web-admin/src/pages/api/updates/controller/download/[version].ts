import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { getVersionDownloadUrl, versionExists } from '@/lib/releases-utils';

const downloadLogger = createContextLogger('api-updates-controller-download');

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

    const { version } = req.query;
    const platform = (req.query.platform as string) || 'win32';

    if (!version || typeof version !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Version is required'
      });
    }

    downloadLogger.info('Download redirect request received', { 
      version, 
      platform,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    });

    // Check if version exists in GitHub releases
    if (!(await versionExists('controller', version))) {
      downloadLogger.warn('Version not found', { version, platform });
      return res.status(404).json({
        success: false,
        error: `Version ${version} not found`
      });
    }

    // Get download URL from GitHub
    const downloadUrl = await getVersionDownloadUrl('controller', version, platform);
    
    if (!downloadUrl) {
      downloadLogger.warn('Download URL not found for platform', { version, platform });
      return res.status(404).json({
        success: false,
        error: `File not found for version ${version} on platform ${platform}`
      });
    }

    downloadLogger.info('Redirecting to GitHub download', {
      version,
      platform,
      downloadUrl
    });

    // Redirect to GitHub download URL
    return res.redirect(302, downloadUrl);

  } catch (error: any) {
    downloadLogger.error('Controller download API error', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      version: req.query.version,
      platform: req.query.platform
    });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

export default handler;