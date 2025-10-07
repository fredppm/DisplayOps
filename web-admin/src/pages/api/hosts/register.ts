import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { hostsRepository } from '@/lib/repositories/HostsRepository';

const hostRegisterLogger = createContextLogger('host-register');

interface HostRegistrationRequest {
  agentId: string;
  hostname: string;
  ipAddress: string;
  grpcPort: number;
  displays: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    isPrimary: boolean;
  }>;
  systemInfo: {
    platform: string;
    arch: string;
    nodeVersion: string;
    electronVersion: string;
    totalMemoryGB: number;
    cpuCores: number;
    cpuModel: string;
    uptime: number;
  };
  version: string;
  status: 'online' | 'offline';
}

interface HostRegistrationResponse {
  success: boolean;
  message: string;
  assignedHostId?: string;
  timestamp: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const registrationData: HostRegistrationRequest = req.body;

    if (!registrationData.agentId) {
      return res.status(400).json({ 
        success: false,
        message: 'Agent ID is required',
        timestamp: new Date().toISOString()
      });
    }

    if (!registrationData.hostname || !registrationData.ipAddress) {
      return res.status(400).json({ 
        success: false,
        message: 'Hostname and IP address are required',
        timestamp: new Date().toISOString()
      });
    }

    hostRegisterLogger.info('📝 Processing host registration', {
      agentId: registrationData.agentId,
      hostname: registrationData.hostname,
      ipAddress: registrationData.ipAddress,
      grpcPort: registrationData.grpcPort
    });

    // Check if host already exists
    const existingHost = await hostsRepository.getByAgentId(registrationData.agentId);
    
    if (existingHost) {
      // Update existing host
      const updatedHost = await hostsRepository.update(existingHost.id, {
        hostname: registrationData.hostname,
        ipAddress: registrationData.ipAddress,
        grpcPort: registrationData.grpcPort,
        displays: registrationData.displays,
        systemInfo: registrationData.systemInfo,
        version: registrationData.version,
        status: registrationData.status,
        lastSeen: new Date().toISOString()
      });

      hostRegisterLogger.info('✅ Host updated successfully', {
        hostId: updatedHost.id,
        agentId: registrationData.agentId
      });

      return res.status(200).json({
        success: true,
        message: `Host updated successfully`,
        assignedHostId: updatedHost.id,
        timestamp: new Date().toISOString()
      });
    } else {
      // Create new host
      const newHost = await hostsRepository.create({
        agentId: registrationData.agentId,
        hostname: registrationData.hostname,
        ipAddress: registrationData.ipAddress,
        grpcPort: registrationData.grpcPort,
        displays: registrationData.displays,
        systemInfo: registrationData.systemInfo,
        version: registrationData.version,
        status: registrationData.status,
        lastSeen: new Date().toISOString()
      });

      hostRegisterLogger.info('✅ Host registered successfully', {
        hostId: newHost.id,
        agentId: registrationData.agentId
      });

      return res.status(201).json({
        success: true,
        message: `Host registered successfully`,
        assignedHostId: newHost.id,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    hostRegisterLogger.error('❌ Host registration failed:', error);
    
    return res.status(500).json({
      success: false,
      message: `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString()
    });
  }
}

