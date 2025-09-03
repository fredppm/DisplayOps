import { NextApiRequest, NextApiResponse } from 'next';
import { syncProtocol, SyncMessage, MessageType } from '@/lib/sync-protocol';
import { ApiResponse } from '@/types/multi-site-types';

interface SyncMessageResponse {
  messageId: string;
  status: 'success' | 'error' | 'partial';
  timestamp: string;
  error?: string;
  data?: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<SyncMessageResponse>>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Validar estrutura da mensagem
    const message: SyncMessage = req.body;
    
    if (!message.id || !message.type || !message.source || !message.payload) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message structure',
        timestamp: new Date().toISOString()
      });
    }

    // Processar mensagem usando o protocolo
    const ack = await syncProtocol.processMessage(message);

    // Log da mensagem processada
    console.log('Sync message processed', {
      messageId: message.id,
      type: message.type,
      controllerId: message.source.controllerId,
      status: ack.status
    });

    // Resposta de sucesso
    const response: SyncMessageResponse = {
      messageId: ack.messageId,
      status: ack.status,
      timestamp: ack.timestamp,
      error: ack.error,
      data: ack.details
    };

    res.status(200).json({
      success: ack.status === 'success',
      data: response,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Sync message processing failed:', error);

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process sync message',
      timestamp: new Date().toISOString()
    });
  }
}