import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const extensionPath = path.join(process.cwd(), '../browser-extension');
    
    if (!fs.existsSync(extensionPath)) {
      return res.status(404).json({
        success: false,
        error: 'Extension directory not found'
      });
    }

    // Set headers for zip download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="screenfleet-extension.zip"');

    // Create zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create extension package' });
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add extension files to archive (excluding development files)
    archive.glob('**/*', {
      cwd: extensionPath,
      ignore: [
        '*.md',
        '*.py',
        '__pycache__/**',
        '.git/**',
        'node_modules/**',
        '*.log'
      ]
    });

    // Finalize archive
    await archive.finalize();

    console.log('Extension package created and sent successfully');

  } catch (error) {
    console.error('Error creating extension package:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to package extension',
        message: 'Erro ao empacotar extensão para download'
      });
    }
  }
}

// Increase body size limit for zip files
export const config = {
  api: {
    responseLimit: '10mb',
  },
}