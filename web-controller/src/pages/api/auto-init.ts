import { NextApiRequest, NextApiResponse } from 'next';
import { autoInitializeServices } from '@/lib/auto-init';

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
    console.log('🚀 API: Auto-inicialização solicitada...');
    const result = await autoInitializeServices();
    
    res.status(200).json(result);
  } catch (error) {
    console.error('❌ API: Erro na auto-inicialização:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}