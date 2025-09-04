import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { grpcServerSingleton } from '@/lib/grpc-server-singleton';
import fs from 'fs';
import path from 'path';

const COOKIES_FILE = path.join(process.cwd(), 'data', 'cookies.json');

const cookiesApiLogger = createContextLogger('api-cookies');

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  expirationDate: number; // Unix timestamp, 0 = session cookie
  description?: string;
}

export interface CookieDomain {
  domain: string;
  description: string;
  cookies: Cookie[];
  lastUpdated: string;
}

export interface CookiesData {
  domains: { [domain: string]: CookieDomain };
  lastUpdated: string;
}

// Ensure data directory exists
const ensureDataDirectory = () => {
  const dataDir = path.dirname(COOKIES_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Load cookies from file
const loadCookies = (): CookiesData => {
  try {
    ensureDataDirectory();
    
    if (!fs.existsSync(COOKIES_FILE)) {
      // Initialize with empty structure
      const defaultCookies: CookiesData = {
        domains: {},
        lastUpdated: new Date().toISOString()
      };
      
      saveCookies(defaultCookies);
      return defaultCookies;
    }
    
    const data = fs.readFileSync(COOKIES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    cookiesApiLogger.error('Error loading cookies', { error: error instanceof Error ? error.message : String(error) });
    return { domains: {}, lastUpdated: new Date().toISOString() };
  }
};

// Save cookies to file
const saveCookies = (cookiesData: CookiesData): void => {
  try {
    ensureDataDirectory();
    cookiesData.lastUpdated = new Date().toISOString();
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookiesData, null, 2), 'utf8');
  } catch (error) {
    cookiesApiLogger.error('Error saving cookies', { error: error instanceof Error ? error.message : String(error) });
    throw new Error('Failed to save cookies');
  }
};

// Validate cookie data
const validateCookie = (data: any): data is Omit<Cookie, 'description'> => {
  return (
    typeof data.name === 'string' &&
    typeof data.value === 'string' &&
    typeof data.domain === 'string' &&
    typeof data.path === 'string' &&
    typeof data.secure === 'boolean' &&
    typeof data.httpOnly === 'boolean' &&
    typeof data.sameSite === 'string' &&
    typeof data.expirationDate === 'number'
  );
};

// Trigger cookie sync to all controllers
const triggerCookieSync = async (): Promise<void> => {
  try {
    await grpcServerSingleton.triggerCookieSync();
    cookiesApiLogger.info('Cookie sync triggered successfully');
  } catch (error) {
    cookiesApiLogger.error('Failed to trigger cookie sync', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'GET':
        // List all cookies by domain
        const cookiesData = loadCookies();
        return res.status(200).json({
          success: true,
          data: cookiesData
        });

      case 'POST':
        // Add cookie to domain
        const { domain, cookie } = req.body;
        
        if (!domain || !cookie || !validateCookie(cookie)) {
          return res.status(400).json({
            success: false,
            error: 'Domain and valid cookie data are required. Required fields: name, value, domain, path, secure, httpOnly, sameSite, expirationDate'
          });
        }

        const currentCookies = loadCookies();
        
        // Ensure domain exists
        if (!currentCookies.domains[domain]) {
          currentCookies.domains[domain] = {
            domain,
            description: req.body.domainDescription || `Cookies for ${domain}`,
            cookies: [],
            lastUpdated: new Date().toISOString()
          };
        }

        // Check for duplicate cookie names in the same domain
        const existingCookieIndex = currentCookies.domains[domain].cookies.findIndex(
          c => c.name === cookie.name
        );

        const newCookie: Cookie = {
          ...cookie,
          description: cookie.description || `Cookie ${cookie.name} for ${domain}`
        };

        if (existingCookieIndex >= 0) {
          // Update existing cookie
          currentCookies.domains[domain].cookies[existingCookieIndex] = newCookie;
          cookiesApiLogger.info('Cookie updated', { domain, cookieName: cookie.name });
        } else {
          // Add new cookie
          currentCookies.domains[domain].cookies.push(newCookie);
          cookiesApiLogger.info('Cookie added', { domain, cookieName: cookie.name });
        }

        currentCookies.domains[domain].lastUpdated = new Date().toISOString();
        saveCookies(currentCookies);

        // Trigger sync to all controllers
        await triggerCookieSync();

        return res.status(201).json({
          success: true,
          data: {
            domain,
            cookie: newCookie
          }
        });

      case 'PUT':
        // Update domain description or bulk update cookies
        const { domain: updateDomain, description, cookies } = req.body;
        
        if (!updateDomain) {
          return res.status(400).json({
            success: false,
            error: 'Domain is required'
          });
        }

        const cookiesToUpdate = loadCookies();
        
        if (!cookiesToUpdate.domains[updateDomain]) {
          return res.status(404).json({
            success: false,
            error: 'Domain not found'
          });
        }

        // Update description if provided
        if (description) {
          cookiesToUpdate.domains[updateDomain].description = description;
        }

        // Update cookies if provided
        if (cookies && Array.isArray(cookies)) {
          // Validate all cookies first
          for (const cookie of cookies) {
            if (!validateCookie(cookie)) {
              return res.status(400).json({
                success: false,
                error: 'Invalid cookie data in cookies array'
              });
            }
          }
          
          cookiesToUpdate.domains[updateDomain].cookies = cookies.map(c => ({
            ...c,
            description: c.description || `Cookie ${c.name} for ${updateDomain}`
          }));
        }

        cookiesToUpdate.domains[updateDomain].lastUpdated = new Date().toISOString();
        saveCookies(cookiesToUpdate);

        // Trigger sync to all controllers
        await triggerCookieSync();

        return res.status(200).json({
          success: true,
          data: cookiesToUpdate.domains[updateDomain]
        });

      case 'DELETE':
        // Delete cookie or entire domain
        const { domain: deleteDomain, cookieName } = req.query;
        
        if (!deleteDomain || typeof deleteDomain !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Domain is required'
          });
        }

        const cookiesToDelete = loadCookies();
        
        if (!cookiesToDelete.domains[deleteDomain]) {
          return res.status(404).json({
            success: false,
            error: 'Domain not found'
          });
        }

        if (cookieName && typeof cookieName === 'string') {
          // Delete specific cookie
          const cookieIndex = cookiesToDelete.domains[deleteDomain].cookies.findIndex(
            c => c.name === cookieName
          );
          
          if (cookieIndex === -1) {
            return res.status(404).json({
              success: false,
              error: 'Cookie not found'
            });
          }

          const deletedCookie = cookiesToDelete.domains[deleteDomain].cookies[cookieIndex];
          cookiesToDelete.domains[deleteDomain].cookies.splice(cookieIndex, 1);
          cookiesToDelete.domains[deleteDomain].lastUpdated = new Date().toISOString();

          // If no more cookies, remove domain
          if (cookiesToDelete.domains[deleteDomain].cookies.length === 0) {
            delete cookiesToDelete.domains[deleteDomain];
          }

          saveCookies(cookiesToDelete);
          
          // Trigger sync to all controllers
          await triggerCookieSync();

          return res.status(200).json({
            success: true,
            data: { deletedCookie, domain: deleteDomain }
          });
        } else {
          // Delete entire domain
          const deletedDomain = cookiesToDelete.domains[deleteDomain];
          delete cookiesToDelete.domains[deleteDomain];
          saveCookies(cookiesToDelete);

          // Trigger sync to all controllers
          await triggerCookieSync();

          return res.status(200).json({
            success: true,
            data: { deletedDomain }
          });
        }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({
          success: false,
          error: `Method ${req.method} Not Allowed`
        });
    }
  } catch (error: any) {
    cookiesApiLogger.error('Cookies API error', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

export default handler;