import { NextApiRequest, NextApiResponse } from 'next';
import { syncProtocol } from '@/lib/sync-protocol';
import { ApiResponse } from '@/types/multi-site-types';

interface CompressionStatsResponse {
  enabled: boolean;
  messagesCompressed: number;
  totalBytesSaved: number;
  averageCompressionRatio: number;
  humanReadable: {
    bytesSavedKB: number;
    bytesSavedMB: number;
    compressionPercentage: number;
  };
  settings: {
    minimumSize: number;
    level: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<CompressionStatsResponse>>
) {
  if (req.method === 'GET') {
    try {
      // Obter estatísticas de compressão
      const stats = syncProtocol.getCompressionStats();
      const options = syncProtocol.getCompressionOptions();

      // Calcular valores mais legíveis
      const bytesSavedKB = Math.round(stats.totalBytesSaved / 1024 * 100) / 100;
      const bytesSavedMB = Math.round(stats.totalBytesSaved / (1024 * 1024) * 100) / 100;
      const compressionPercentage = Math.round((1 - stats.averageCompressionRatio) * 100 * 100) / 100;

      const response: CompressionStatsResponse = {
        enabled: stats.enabled,
        messagesCompressed: stats.messagesCompressed,
        totalBytesSaved: stats.totalBytesSaved,
        averageCompressionRatio: stats.averageCompressionRatio,
        humanReadable: {
          bytesSavedKB,
          bytesSavedMB,
          compressionPercentage
        },
        settings: {
          minimumSize: options.minimumSize,
          level: options.level
        }
      };

      res.status(200).json({
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Failed to get compression stats:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get compression stats',
        timestamp: new Date().toISOString()
      });
    }
  } else if (req.method === 'PUT') {
    // Configurar opções de compressão
    try {
      const { enabled, minimumSize, level } = req.body;

      // Validar parâmetros
      if (typeof enabled !== 'undefined' && typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'enabled must be a boolean',
          timestamp: new Date().toISOString()
        });
      }

      if (typeof minimumSize !== 'undefined' && (typeof minimumSize !== 'number' || minimumSize < 0)) {
        return res.status(400).json({
          success: false,
          error: 'minimumSize must be a positive number',
          timestamp: new Date().toISOString()
        });
      }

      if (typeof level !== 'undefined' && (typeof level !== 'number' || level < 1 || level > 9)) {
        return res.status(400).json({
          success: false,
          error: 'level must be between 1 and 9',
          timestamp: new Date().toISOString()
        });
      }

      // Aplicar configurações
      const updates: any = {};
      if (typeof enabled !== 'undefined') updates.enabled = enabled;
      if (typeof minimumSize !== 'undefined') updates.minimumSize = minimumSize;
      if (typeof level !== 'undefined') updates.level = level;

      syncProtocol.setCompressionOptions(updates);

      // Retornar configurações atualizadas
      const updatedOptions = syncProtocol.getCompressionOptions();

      res.status(200).json({
        success: true,
        data: updatedOptions as any,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Failed to update compression options:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update compression options',
        timestamp: new Date().toISOString()
      });
    }
  } else {
    res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }
}