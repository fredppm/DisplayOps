import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('api-extension-version');

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
    logger.info('Fetching latest extension version from GitHub');

    // Fetch releases from GitHub
    const releasesUrl = `${GITHUB_API_BASE}/releases`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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

    // Extract version from tag (ext-v1.0 -> 1.0)
    const version = extensionRelease.tag_name.replace('ext-v', '');

    logger.info('Extension version fetched successfully', {
      version,
      tag: extensionRelease.tag_name,
      publishedAt: extensionRelease.published_at
    });

    return res.status(200).json({
      success: true,
      version,
      releaseDate: extensionRelease.published_at,
      tag: extensionRelease.tag_name
    });

  } catch (error: any) {
    logger.error('Error fetching extension version from GitHub', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch extension version'
    });
  }
}

export default handler;

