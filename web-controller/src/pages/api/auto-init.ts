import { NextApiRequest, NextApiResponse } from 'next';
import { autoInitializeServices } from '@/lib/auto-init';
import { createContextLogger } from '@/utils/logger';

const autoInitApiLogger = createContextLogger('api-auto-init');

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    autoInitApiLogger.info('Auto-inicialização solicitada via API');
    const result = await autoInitializeServices();
    
    res.status(200).json(result);
  } catch (error) {
    autoInitApiLogger.error('Erro na auto-inicialização', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}