import { Controller } from '@/types/multi-site-types';

interface ControllerStatusConfig {
  offlineThreshold: number; // milliseconds
}

const getConfig = (): ControllerStatusConfig => ({
  offlineThreshold: parseInt(process.env.CONTROLLER_OFFLINE_THRESHOLD || '120000') // 2 minutes default
});

export function calculateControllerStatus(controller: Controller): Controller {
  const config = getConfig();
  const now = new Date();
  const lastSync = new Date(controller.lastSync);
  const timeSinceLastSync = now.getTime() - lastSync.getTime();
  
  // If controller was marked as 'error', keep it as error
  if (controller.status === 'error') {
    return controller;
  }
  
  // Calculate status based on lastSync
  const calculatedStatus = timeSinceLastSync >= config.offlineThreshold ? 'offline' : 'online';
  
  return {
    ...controller,
    status: calculatedStatus
  };
}

export function calculateControllersStatus(controllers: Controller[]): Controller[] {
  return controllers.map(calculateControllerStatus);
}

export function getControllerStatusStats(controllers: Controller[]): {
  total: number;
  online: number;
  offline: number;
  error: number;
} {
  const controllersWithStatus = calculateControllersStatus(controllers);
  
  return {
    total: controllersWithStatus.length,
    online: controllersWithStatus.filter(c => c.status === 'online').length,
    offline: controllersWithStatus.filter(c => c.status === 'offline').length,
    error: controllersWithStatus.filter(c => c.status === 'error').length,
  };
}

export function isControllerOnline(controller: Controller): boolean {
  const config = getConfig();
  const now = new Date();
  const lastSync = new Date(controller.lastSync);
  const timeSinceLastSync = now.getTime() - lastSync.getTime();
  
  return controller.status !== 'error' && timeSinceLastSync < config.offlineThreshold;
}

export function getTimeSinceLastSync(controller: Controller): {
  milliseconds: number;
  seconds: number;
  minutes: number;
  humanReadable: string;
} {
  const now = new Date();
  const lastSync = new Date(controller.lastSync);
  const milliseconds = now.getTime() - lastSync.getTime();
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  
  let humanReadable: string;
  if (minutes >= 1) {
    humanReadable = `${minutes}m${seconds % 60 > 0 ? ` ${seconds % 60}s` : ''}`;
  } else {
    humanReadable = `${seconds}s`;
  }
  
  return {
    milliseconds,
    seconds,
    minutes,
    humanReadable
  };
}

export const controllerStatusConfig = getConfig();