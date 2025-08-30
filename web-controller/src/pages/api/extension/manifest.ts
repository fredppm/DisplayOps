import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import fs from 'fs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Path to extension directory
    const extensionPath = path.join(process.cwd(), '../office-display-extension');
    
    // Read manifest.json from extension
    const manifestPath = path.join(extensionPath, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      return res.status(404).json({
        success: false,
        error: 'Extension not found',
        message: 'Office Display Extension não encontrada no servidor'
      });
    }

    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);

    // Get base URL
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    // Extension info
    const extensionInfo = {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      installUrl: `${baseUrl}/api/extension/install`,
      downloadUrl: `${baseUrl}/api/extension/download`,
      supportedBrowsers: ['chrome', 'edge', 'firefox', 'opera'],
      permissions: manifest.permissions,
      manifest_version: manifest.manifest_version,
      status: 'available'
    };

    res.status(200).json({
      success: true,
      data: extensionInfo
    });

  } catch (error) {
    console.error('Error reading extension manifest:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read extension manifest',
      message: 'Erro ao ler informações da extensão'
    });
  }
}