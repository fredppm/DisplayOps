import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface CompressionOptions {
  enabled: boolean;
  minimumSize: number; // Tamanho mínimo para comprimir (em bytes)
  level: number; // Nível de compressão (1-9)
}

export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  enabled: true,
  minimumSize: 1024, // 1KB
  level: 6 // Balanceamento entre velocidade e compressão
};

export interface CompressedPayload {
  compressed: boolean;
  data: Buffer | string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Comprime dados se benéfico
 */
export async function compressData(
  data: any,
  options: CompressionOptions = DEFAULT_COMPRESSION_OPTIONS
): Promise<CompressedPayload> {
  const jsonString = JSON.stringify(data);
  const originalBuffer = Buffer.from(jsonString, 'utf-8');
  const originalSize = originalBuffer.length;

  // Não comprimir se desabilitado ou dados muito pequenos
  if (!options.enabled || originalSize < options.minimumSize) {
    return {
      compressed: false,
      data: jsonString,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1.0
    };
  }

  try {
    const compressedBuffer = await gzipAsync(originalBuffer, { level: options.level });
    const compressedSize = compressedBuffer.length;
    const compressionRatio = compressedSize / originalSize;

    // Só usar compressão se resultar em economia significativa (pelo menos 10%)
    if (compressionRatio < 0.9) {
      return {
        compressed: true,
        data: compressedBuffer,
        originalSize,
        compressedSize,
        compressionRatio
      };
    } else {
      // Compressão não vale a pena
      return {
        compressed: false,
        data: jsonString,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1.0
      };
    }
  } catch (error) {
    // Em caso de erro, retornar dados não comprimidos
    return {
      compressed: false,
      data: jsonString,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1.0
    };
  }
}

/**
 * Descomprime dados se necessário
 */
export async function decompressData(payload: CompressedPayload): Promise<any> {
  if (!payload.compressed) {
    // Dados não comprimidos, fazer parse direto
    return JSON.parse(payload.data.toString());
  }

  try {
    const decompressedBuffer = await gunzipAsync(payload.data as Buffer);
    const jsonString = decompressedBuffer.toString('utf-8');
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Failed to decompress data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Comprime string de forma síncrona (para casos simples)
 */
export function compressStringSync(data: string): Buffer {
  return require('zlib').gzipSync(Buffer.from(data, 'utf-8'));
}

/**
 * Descomprime string de forma síncrona (para casos simples)
 */
export function decompressStringSync(compressedData: Buffer): string {
  return require('zlib').gunzipSync(compressedData).toString('utf-8');
}

/**
 * Calcula estatísticas de compressão
 */
export function getCompressionStats(payload: CompressedPayload): {
  compressionRatio: number;
  spaceSaved: number;
  spaceSavedPercent: number;
  worthCompressing: boolean;
} {
  const spaceSaved = payload.originalSize - payload.compressedSize;
  const spaceSavedPercent = (spaceSaved / payload.originalSize) * 100;
  
  return {
    compressionRatio: payload.compressionRatio,
    spaceSaved,
    spaceSavedPercent,
    worthCompressing: payload.compressed && payload.compressionRatio < 0.9
  };
}

/**
 * Middleware para compressão automática baseada em tamanho
 */
export async function autoCompress(
  data: any,
  options: Partial<CompressionOptions> = {}
): Promise<CompressedPayload> {
  const fullOptions = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };
  return compressData(data, fullOptions);
}