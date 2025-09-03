import { NextApiRequest, NextApiResponse } from 'next';
import { syncProtocol, HandshakeRequest, HandshakeResponse } from '@/lib/sync-protocol';
import { ApiResponse } from '@/types/multi-site-types';
import fs from 'fs/promises';
import path from 'path';

const CONTROLLERS_FILE = path.join(process.cwd(), 'data', 'controllers.json');

async function readControllersData(): Promise<any> {
  try {
    const data = await fs.readFile(CONTROLLERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { controllers: [] };
  }
}

async function updateControllerLastSync(controllerId: string): Promise<void> {
  try {
    const data = await readControllersData();
    const controllerIndex = data.controllers.findIndex((c: any) => c.id === controllerId);
    
    if (controllerIndex !== -1) {
      data.controllers[controllerIndex].lastSync = new Date().toISOString();
      data.controllers[controllerIndex].status = 'online';
      
      await fs.writeFile(CONTROLLERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch (error) {
    console.error('Failed to update controller sync time:', error);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<HandshakeResponse>>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const handshakeRequest: HandshakeRequest = req.body;
    
    // Validar campos obrigatórios
    if (!handshakeRequest.controllerId || !handshakeRequest.siteId || !handshakeRequest.version) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: controllerId, siteId, version',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar se o controller existe
    const controllersData = await readControllersData();
    const controller = controllersData.controllers.find((c: any) => c.id === handshakeRequest.controllerId);
    
    if (!controller) {
      return res.status(404).json({
        success: false,
        error: 'Controller not found',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar compatibilidade de versão
    const serverVersion = '1.0.0';
    const clientVersion = handshakeRequest.version;
    
    // Determinar tipo de sincronização
    const lastSync = handshakeRequest.lastSync;
    const now = new Date();
    const syncThreshold = 10 * 60 * 1000; // 10 minutos
    
    let syncRequired = true;
    let syncType: 'full' | 'incremental' = 'full';
    
    if (lastSync) {
      const lastSyncTime = new Date(lastSync);
      const timeDiff = now.getTime() - lastSyncTime.getTime();
      
      if (timeDiff < syncThreshold) {
        syncRequired = false;
      } else if (timeDiff < 60 * 60 * 1000) { // 1 hora
        syncType = 'incremental';
      }
    }

    // Atualizar status do controller
    await updateControllerLastSync(handshakeRequest.controllerId);

    // Configuração para o controller
    const config = {
      syncInterval: 300000,        // 5 minutos
      heartbeatInterval: 30000,    // 30 segundos
      maxRetries: 5,
      retryDelay: 1000,
      compressionThreshold: 1024,
      checksumRequired: true
    };

    // Preparar resposta
    const handshakeResponse: HandshakeResponse = {
      accepted: true,
      serverTime: now.toISOString(),
      syncRequired,
      syncType,
      config
    };

    console.log('Handshake successful', {
      controllerId: handshakeRequest.controllerId,
      siteId: handshakeRequest.siteId,
      version: clientVersion,
      syncRequired,
      syncType
    });

    res.status(200).json({
      success: true,
      data: handshakeResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Handshake failed:', error);

    res.status(500).json({
      success: false,
      error: error.message || 'Handshake failed',
      timestamp: new Date().toISOString()
    });
  }
}