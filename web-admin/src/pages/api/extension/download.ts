import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('api-extension-download');

// GitHub API configuration
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'fredppm';
const GITHUB_REPO = process.env.GITHUB_REPO || 'DisplayOps';
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    logger.info('Fetching latest extension release from GitHub');

    // Fetch releases from GitHub
    const releasesUrl = `${GITHUB_API_BASE}/releases`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(releasesUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'DisplayOps-Admin'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error('GitHub API request failed', {
        status: response.status,
        statusText: response.statusText
      });
      return res.status(502).json({
        success: false,
        error: 'Failed to fetch extension releases from GitHub'
      });
    }

    const releases = await response.json();

    // Find the latest extension release (tag starts with 'ext-v')
    const extensionRelease = releases.find((release: any) => 
      release.tag_name.startsWith('ext-v') && !release.prerelease
    );

    if (!extensionRelease) {
      logger.error('No extension releases found on GitHub');
      return res.status(404).json({
        success: false,
        error: 'No extension releases available'
      });
    }

    // Find the ZIP asset
    const zipAsset = extensionRelease.assets.find((asset: any) => 
      asset.name.endsWith('.zip')
    );

    if (!zipAsset) {
      logger.error('No ZIP file found in release', {
        tag: extensionRelease.tag_name,
        assets: extensionRelease.assets.map((a: any) => a.name)
      });
      return res.status(404).json({
        success: false,
        error: 'Extension package not found in release'
      });
    }

    logger.info('Redirecting to GitHub download', {
      tag: extensionRelease.tag_name,
      asset: zipAsset.name,
      url: zipAsset.browser_download_url
    });

    // Redirect to GitHub download URL
    return res.redirect(302, zipAsset.browser_download_url);

  } catch (error: any) {
    logger.error('Error fetching extension from GitHub', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to download extension'
      });
    }
  }
}

export default handler;

