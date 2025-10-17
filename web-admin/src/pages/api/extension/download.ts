import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import fs from 'fs';
import path from 'path';

const logger = createContextLogger('api-extension-download');

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    // Path to pre-built extension ZIP in public/downloads
    const zipPath = path.join(process.cwd(), 'public', 'downloads', 'displayops-extension.zip');

    logger.info('Serving extension ZIP', { path: zipPath });

    // Check if ZIP exists
    if (!fs.existsSync(zipPath)) {
      logger.error('Extension ZIP not found', { 
        path: zipPath,
        hint: 'Run "npm run package-extension" to generate the ZIP file'
      });
      return res.status(404).json({
        success: false,
        error: 'Extension package not found. Please run the build process first.'
      });
    }

    // Get file stats
    const stats = fs.statSync(zipPath);
    const fileSize = stats.size;

    // Set response headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=displayops-extension.zip');
    res.setHeader('Content-Length', fileSize);

    // Stream the file
    const fileStream = fs.createReadStream(zipPath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      logger.info('Extension ZIP served successfully', { 
        bytes: fileSize,
        mb: (fileSize / 1024 / 1024).toFixed(2)
      });
    });

    fileStream.on('error', (err) => {
      logger.error('Error streaming extension ZIP', { error: err.message });
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to download extension'
        });
      }
    });

  } catch (error: any) {
    logger.error('Error serving extension ZIP', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error while serving extension'
      });
    }
  }
}

export default handler;

