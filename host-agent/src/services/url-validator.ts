// Using Node.js built-in fetch (available in Node.js 18+)

export interface URLValidationResult {
  isValid: boolean;
  isReachable: boolean;
  responseTime: number;
  statusCode?: number;
  error?: string;
  contentType?: string;
}

export class URLValidator {
  private static readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private static readonly USER_AGENT = 'ScreenFleet-Agent/1.0.0';

  /**
   * Validates if a URL is properly formatted
   */
  public static isValidURL(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Tests if a URL is reachable and returns validation information
   */
  public static async validateURL(url: string, timeout: number = this.DEFAULT_TIMEOUT): Promise<URLValidationResult> {
    const startTime = Date.now();
    
    // First check if URL format is valid
    if (!this.isValidURL(url)) {
      return {
        isValid: false,
        isReachable: false,
        responseTime: 0,
        error: 'Invalid URL format'
      };
    }

    try {
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'HEAD', // Use HEAD to avoid downloading full content
        headers: {
          'User-Agent': this.USER_AGENT
        },
        signal: controller.signal,
        redirect: 'follow'
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      return {
        isValid: true,
        isReachable: response.ok,
        responseTime,
        statusCode: response.status,
        contentType: response.headers.get('content-type') || undefined
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      let errorMessage = 'Unknown error';
      if (error.name === 'AbortError') {
        errorMessage = `Request timeout after ${timeout}ms`;
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'DNS resolution failed';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused';
      } else if (error.code === 'ECONNRESET') {
        errorMessage = 'Connection reset';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        isValid: true,
        isReachable: false,
        responseTime,
        error: errorMessage
      };
    }
  }

  /**
   * Validates multiple URLs concurrently
   */
  public static async validateURLs(urls: string[], timeout?: number): Promise<Map<string, URLValidationResult>> {
    const validationPromises = urls.map(url => 
      this.validateURL(url, timeout).then(result => [url, result] as [string, URLValidationResult])
    );

    const results = await Promise.all(validationPromises);
    return new Map(results);
  }

  /**
   * Checks if a URL is suitable for dashboard display
   */
  public static async validateDashboardURL(url: string): Promise<URLValidationResult> {
    const result = await this.validateURL(url);
    
    if (!result.isReachable) {
      return result;
    }

    // Additional checks for dashboard suitability
    const contentType = result.contentType?.toLowerCase() || '';
    const isSuitableContent = contentType.includes('text/html') || 
                             contentType.includes('application/json') || 
                             contentType === '';

    if (!isSuitableContent) {
      return {
        ...result,
        isReachable: false,
        error: `Unsuitable content type: ${result.contentType}`
      };
    }

    return result;
  }

  /**
   * Extracts domain from URL for cookie management
   */
  public static extractDomain(url: string): string | null {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname;
    } catch {
      return null;
    }
  }

  /**
   * Sanitizes URL for logging (removes sensitive query parameters)
   */
  public static sanitizeURLForLogging(url: string): string {
    try {
      const parsedUrl = new URL(url);
      // Remove common sensitive parameters
      const sensitiveParams = ['token', 'api_key', 'password', 'secret', 'auth'];
      
      sensitiveParams.forEach(param => {
        if (parsedUrl.searchParams.has(param)) {
          parsedUrl.searchParams.set(param, '[REDACTED]');
        }
      });

      return parsedUrl.toString();
    } catch {
      return url;
    }
  }
}
