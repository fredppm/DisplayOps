import { createContextLogger } from '@/utils/logger';

const releasesLogger = createContextLogger('releases-utils');

// GitHub API configuration
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'fredppm';
const GITHUB_REPO = process.env.GITHUB_REPO || 'DisplayOps';
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

// Simple in-memory cache to avoid GitHub API rate limits
interface CacheEntry {
  data: GitHubRelease[];
  timestamp: number;
  app: string;
}

const releasesCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
  download_count: number;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  prerelease: boolean;
  assets: GitHubAsset[];
}

export interface PlatformInfo {
  filename: string;
  downloadUrl: string;
  size: number;
}

export interface VersionInfo {
  version: string;
  releaseDate: string;
  changelog?: string;
  platforms: {
    win32?: PlatformInfo;
    darwin?: PlatformInfo;
    linux?: PlatformInfo;
  };
}

export interface ElectronUpdaterResponse {
  version: string;
  releaseDate: string;
  url: string;
  releaseNotes?: string;
  size?: number;
  sha512?: string;
}

/**
 * Fetch releases from GitHub API
 */
async function fetchGitHubReleases(app: 'controller' | 'host'): Promise<GitHubRelease[]> {
  const cacheKey = `releases-${app}`;
  const now = Date.now();
  
  // Check cache first
  const cached = releasesCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    releasesLogger.info(`Using cached releases for ${app}`, { 
      cached: cached.data.length,
      age: Math.round((now - cached.timestamp) / 1000) + 's'
    });
    return cached.data;
  }
  
  try {
    const tagPrefix = app === 'controller' ? 'controller-v' : 'host-v';
    const url = `${GITHUB_API_BASE}/releases`;
    
    releasesLogger.info(`Fetching releases from GitHub`, { url, app, tagPrefix });
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'DisplayOps-Admin'
      },
      timeout: 30000 // 30 second timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      releasesLogger.error(`GitHub API request failed`, {
        status: response.status,
        statusText: response.statusText,
        url,
        app,
        errorText: errorText.substring(0, 500) // Limit error text
      });
      
      // If we have stale cached data, use it as fallback
      if (cached) {
        releasesLogger.warn(`Using stale cached data due to GitHub API error`, { app });
        return cached.data;
      }
      
      throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
    }
    
    const releases: GitHubRelease[] = await response.json();
    
    // Filter releases by app tag prefix
    const appReleases = releases.filter(release => 
      release.tag_name.startsWith(tagPrefix) && !release.prerelease
    );
    
    // Cache the results
    releasesCache.set(cacheKey, {
      data: appReleases,
      timestamp: now,
      app
    });
    
    releasesLogger.info(`Found ${appReleases.length} releases for ${app} - cached`, {
      releases: appReleases.map(r => r.tag_name)
    });
    
    return appReleases;
  } catch (error) {
    releasesLogger.error(`Failed to fetch releases for ${app}`, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // If we have any cached data (even stale), use it as last resort
    if (cached) {
      releasesLogger.warn(`Using stale cached data as last resort`, { app });
      return cached.data;
    }
    
    throw error;
  }
}

/**
 * Map GitHub asset to platform info
 */
function mapAssetToPlatform(asset: GitHubAsset): { platform: string; info: PlatformInfo } | null {
  const name = asset.name.toLowerCase();
  
  let platform: string;
  if (name.includes('.exe') || name.includes('setup') || name.includes('installer')) {
    platform = 'win32';
  } else if (name.includes('.dmg') || name.includes('mac')) {
    platform = 'darwin';
  } else if (name.includes('.appimage') || name.includes('linux')) {
    platform = 'linux';
  } else {
    return null;
  }
  
  return {
    platform,
    info: {
      filename: asset.name,
      downloadUrl: asset.browser_download_url,
      size: asset.size
    }
  };
}

/**
 * Convert GitHub release to VersionInfo
 */
function convertGitHubReleaseToVersionInfo(release: GitHubRelease, app: 'controller' | 'host'): VersionInfo {
  const tagPrefix = app === 'controller' ? 'controller-v' : 'host-v';
  const version = release.tag_name.replace(tagPrefix, '');
  
  const platforms: VersionInfo['platforms'] = {};
  
  // Map assets to platforms
  for (const asset of release.assets) {
    const mapped = mapAssetToPlatform(asset);
    if (mapped) {
      platforms[mapped.platform as keyof VersionInfo['platforms']] = mapped.info;
    }
  }
  
  return {
    version,
    releaseDate: release.published_at,
    changelog: release.body || release.name,
    platforms
  };
}

/**
 * Get latest version info for electron-updater format
 */
export async function getLatestVersionForElectronUpdater(
  app: 'controller' | 'host',
  platform: string = 'win32'
): Promise<ElectronUpdaterResponse | null> {
  try {
    const releases = await fetchGitHubReleases(app);
    
    if (!releases || releases.length === 0) {
      releasesLogger.warn(`No releases found for ${app}`);
      return null;
    }
    
    // Get the latest release (first one, as GitHub API returns them sorted by creation date)
    const latestRelease = releases[0];
    const versionInfo = convertGitHubReleaseToVersionInfo(latestRelease, app);
    
    // Map platform names to electron platform names
    const platformMap: { [key: string]: keyof VersionInfo['platforms'] } = {
      'win32': 'win32',
      'windows': 'win32',
      'darwin': 'darwin',
      'mac': 'darwin',
      'macos': 'darwin',
      'linux': 'linux'
    };
    
    const normalizedPlatform = platformMap[platform.toLowerCase()] || 'win32';
    const platformInfo = versionInfo.platforms[normalizedPlatform];
    
    if (!platformInfo) {
      releasesLogger.error(`Platform ${normalizedPlatform} not available for ${app} version ${versionInfo.version}`);
      return null;
    }
    
    const response: ElectronUpdaterResponse = {
      version: versionInfo.version,
      releaseDate: versionInfo.releaseDate,
      url: platformInfo.downloadUrl, // Direct GitHub download URL
      releaseNotes: versionInfo.changelog,
      size: platformInfo.size,
      sha512: '' // GitHub doesn't provide SHA512, electron-updater can work without it
    };
    
    releasesLogger.info(`Generated electron-updater response for ${app}`, {
      version: response.version,
      platform: normalizedPlatform,
      url: response.url,
      tag: latestRelease.tag_name
    });
    
    return response;
  } catch (error) {
    releasesLogger.error(`Error generating electron-updater response for ${app}`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Get download URL for a specific version and platform from GitHub
 */
export async function getVersionDownloadUrl(
  app: 'controller' | 'host',
  version: string,
  platform: string
): Promise<string | null> {
  try {
    const releases = await fetchGitHubReleases(app);
    
    const tagPrefix = app === 'controller' ? 'controller-v' : 'host-v';
    const targetTag = `${tagPrefix}${version}`;
    
    const release = releases.find(r => r.tag_name === targetTag);
    if (!release) {
      releasesLogger.error(`Release not found for ${app} version ${version}`);
      return null;
    }
    
    const versionInfo = convertGitHubReleaseToVersionInfo(release, app);
    
    // Map platform names
    const platformMap: { [key: string]: keyof VersionInfo['platforms'] } = {
      'win32': 'win32',
      'windows': 'win32',
      'darwin': 'darwin',
      'mac': 'darwin',
      'macos': 'darwin',
      'linux': 'linux'
    };
    
    const normalizedPlatform = platformMap[platform.toLowerCase()];
    if (!normalizedPlatform) {
      releasesLogger.error(`Invalid platform: ${platform}`);
      return null;
    }
    
    const platformInfo = versionInfo.platforms[normalizedPlatform];
    if (!platformInfo) {
      releasesLogger.error(`Platform ${normalizedPlatform} not available for ${app} version ${version}`);
      return null;
    }
    
    return platformInfo.downloadUrl;
  } catch (error) {
    releasesLogger.error(`Error getting download URL for ${app}`, {
      version,
      platform,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Check if a version exists in GitHub releases
 */
export async function versionExists(app: 'controller' | 'host', version: string): Promise<boolean> {
  try {
    const releases = await fetchGitHubReleases(app);
    const tagPrefix = app === 'controller' ? 'controller-v' : 'host-v';
    const targetTag = `${tagPrefix}${version}`;
    
    return releases.some(r => r.tag_name === targetTag);
  } catch {
    return false;
  }
}

/**
 * Get all available versions from GitHub releases
 */
export async function getAllVersions(app: 'controller' | 'host'): Promise<string[]> {
  try {
    const releases = await fetchGitHubReleases(app);
    const tagPrefix = app === 'controller' ? 'controller-v' : 'host-v';
    
    return releases
      .map(r => r.tag_name.replace(tagPrefix, ''))
      .filter(v => v.length > 0);
  } catch {
    return [];
  }
}

/**
 * Clear the releases cache for a specific app or all apps
 */
export function clearReleasesCache(app?: 'controller' | 'host'): void {
  if (app) {
    const cacheKey = `releases-${app}`;
    releasesCache.delete(cacheKey);
    releasesLogger.info(`Cleared releases cache for ${app}`);
  } else {
    releasesCache.clear();
    releasesLogger.info('Cleared all releases cache');
  }
}