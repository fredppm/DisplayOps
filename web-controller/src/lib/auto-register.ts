
interface AutoRegisterData {
  hostname: string;
  localNetwork: string;
  macAddress: string;
  location?: string;
  version: string;
  siteId?: string;
  mdnsService: string;
  webAdminUrl?: string;
}

interface AutoRegisterResponse {
  success: boolean;
  data?: {
    id: string;
    siteId: string;
    name: string;
    status: string;
  };
  error?: string;
  timestamp: string;
}

class AutoRegisterService {
  private static instance: AutoRegisterService;
  private registered = false;
  private registrationInProgress = false;
  private retryCount = 0;
  private maxRetries = 5;
  private retryDelay = 5000; // 5 seconds base delay

  static getInstance(): AutoRegisterService {
    if (!AutoRegisterService.instance) {
      AutoRegisterService.instance = new AutoRegisterService();
    }
    return AutoRegisterService.instance;
  }

  private constructor() {}

  async register(): Promise<boolean> {
    if (this.registered || this.registrationInProgress) {
      logger.info('Registration already completed or in progress');
      return this.registered;
    }

    const autoRegisterEnabled = process.env.CONTROLLER_AUTO_REGISTER === 'true';
    if (!autoRegisterEnabled) {
      logger.info('Auto-registration disabled via environment variable');
      return false;
    }

    this.registrationInProgress = true;

    try {
      const registrationData = await this.collectRegistrationData();
      const success = await this.sendRegistration(registrationData);
      
      if (success) {
        this.registered = true;
        this.retryCount = 0;
        logger.info('Controller successfully auto-registered');
      } else {
        await this.scheduleRetry();
      }

      return success;
    } catch (error) {
      logger.error('Auto-registration failed:', error);
      await this.scheduleRetry();
      return false;
    } finally {
      this.registrationInProgress = false;
    }
  }

  private async collectRegistrationData(): Promise<AutoRegisterData> {
    const hostname = await this.getHostname();
    const localNetwork = await this.getLocalNetwork();
    const macAddress = await this.getMacAddress();
    
    return {
      hostname,
      localNetwork,
      macAddress,
      location: process.env.CONTROLLER_LOCATION || `${hostname} - Auto-discovered`,
      version: '1.0.0',
      siteId: process.env.CONTROLLER_SITE_ID || undefined,
      mdnsService: '_displayops._tcp.local',
      webAdminUrl: process.env.ADMIN_REGISTER_URL
    };
  }

  private async getHostname(): Promise<string> {
    if (typeof window !== 'undefined') {
      return window.location.hostname || 'unknown-host';
    }
    
    try {
      const os = await import('os');
      return os.hostname();
    } catch {
      return 'unknown-host';
    }
  }

  private async getLocalNetwork(): Promise<string> {
    try {
      const os = await import('os');
      const interfaces = os.networkInterfaces();
      
      for (const [name, nets] of Object.entries(interfaces)) {
        if (!nets || name.includes('lo')) continue;
        
        for (const net of nets) {
          if (net.family === 'IPv4' && !net.internal) {
            // Infer network from IP (assumes /24 for simplicity)
            const ip = net.address;
            const parts = ip.split('.');
            parts[3] = '0';
            return `${parts.join('.')}/24`;
          }
        }
      }
    } catch (error) {
      logger.warn('Could not determine local network:', error);
    }
    
    return '192.168.1.0/24'; // fallback
  }

  private async getMacAddress(): Promise<string> {
    try {
      const os = await import('os');
      const interfaces = os.networkInterfaces();
      
      for (const [name, nets] of Object.entries(interfaces)) {
        if (!nets || name.includes('lo')) continue;
        
        for (const net of nets) {
          if (net.family === 'IPv4' && !net.internal && net.mac) {
            return net.mac;
          }
        }
      }
    } catch (error) {
      logger.warn('Could not determine MAC address:', error);
    }
    
    // Generate a fake MAC address for fallback
    return this.generateFakeMac();
  }

  private generateFakeMac(): string {
    const chars = '0123456789abcdef';
    let mac = '';
    for (let i = 0; i < 6; i++) {
      if (i > 0) mac += ':';
      mac += chars.charAt(Math.floor(Math.random() * chars.length));
      mac += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return mac;
  }

  private async sendRegistration(data: AutoRegisterData): Promise<boolean> {
    const adminUrl = process.env.ADMIN_REGISTER_URL || 'http://localhost:3000';
    const registerUrl = `${adminUrl}/api/controllers/register`;

    try {
      logger.info('Attempting controller registration', { 
        hostname: data.hostname,
        adminUrl: registerUrl 
      });

      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result: AutoRegisterResponse = await response.json();

      if (response.ok && result.success) {
        logger.info('Registration successful', { 
          controllerId: result.data?.id,
          siteId: result.data?.siteId 
        });
        return true;
      } else {
        logger.error('Registration failed:', result.error || 'Unknown error');
        return false;
      }
    } catch (error) {
      logger.error('Network error during registration:', error);
      return false;
    }
  }

  private async scheduleRetry(): Promise<void> {
    if (this.retryCount >= this.maxRetries) {
      logger.error('Max registration retries exceeded, giving up');
      return;
    }

    this.retryCount++;
    const delay = this.retryDelay * Math.pow(2, this.retryCount - 1); // Exponential backoff

    logger.info(`Scheduling registration retry ${this.retryCount}/${this.maxRetries} in ${delay}ms`);

    setTimeout(() => {
      this.register().catch(error => {
        logger.error('Retry registration failed:', error);
      });
    }, delay);
  }

  isRegistered(): boolean {
    return this.registered;
  }

  reset(): void {
    this.registered = false;
    this.registrationInProgress = false;
    this.retryCount = 0;
  }
}

// Create a simple logger if not available
const createLogger = () => {
  return {
    info: (message: string, meta?: any) => {
      console.log(`[AutoRegister] ${message}`, meta || '');
    },
    warn: (message: string, meta?: any) => {
      console.warn(`[AutoRegister] ${message}`, meta || '');
    },
    error: (message: string, meta?: any) => {
      console.error(`[AutoRegister] ${message}`, meta || '');
    }
  };
};

let logger: any;
try {
  logger = require('./logger').logger;
} catch {
  logger = createLogger();
}

export const autoRegisterService = AutoRegisterService.getInstance();
export default autoRegisterService;