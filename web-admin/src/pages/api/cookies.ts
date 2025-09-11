import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';
import { webSocketServerSingleton } from '@/lib/websocket-server-singleton';
import { cookiesRepository, Cookie, CookieDomain } from '@/lib/repositories/CookiesRepository';

const cookiesApiLogger = createContextLogger('api-cookies');

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
    await webSocketServerSingleton.triggerCookieSync();
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
        const cookiesData = await cookiesRepository.getAllAsApiFormat();
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

        const newCookie: Cookie = {
          ...cookie,
          description: (cookie as any).description || `Cookie ${cookie.name} for ${domain}`
        };

        // Save cookie to PostgreSQL
        await cookiesRepository.addCookieToDomain(domain, newCookie);
        cookiesApiLogger.info('Cookie saved', { domain, cookieName: cookie.name });

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

        // Check if domain exists
        const existingDomain = await cookiesRepository.getByDomain(updateDomain);
        if (!existingDomain) {
          return res.status(404).json({
            success: false,
            error: 'Domain not found'
          });
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
          
          // Update all cookies for this domain
          const cookiesWithDescription = cookies.map(cookie => ({
            ...cookie,
            description: cookie.description || `Cookie ${cookie.name} for ${updateDomain}`
          }));
          
          await cookiesRepository.updateDomainCookies(updateDomain, cookiesWithDescription);
        }

        // Trigger sync to all controllers
        await triggerCookieSync();

        // Return updated domain data
        const updatedDomain = await cookiesRepository.getByDomain(updateDomain);
        return res.status(200).json({
          success: true,
          data: updatedDomain
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

        // Check if domain exists
        const domainToDelete = await cookiesRepository.getByDomain(deleteDomain);
        if (!domainToDelete) {
          return res.status(404).json({
            success: false,
            error: 'Domain not found'
          });
        }

        if (cookieName && typeof cookieName === 'string') {
          // Delete specific cookie
          const cookieToDelete = domainToDelete.cookies.find(c => c.name === cookieName);
          
          if (!cookieToDelete) {
            return res.status(404).json({
              success: false,
              error: 'Cookie not found'
            });
          }

          const deleted = await cookiesRepository.removeCookieFromDomain(deleteDomain, cookieName);
          if (!deleted) {
            return res.status(500).json({
              success: false,
              error: 'Failed to delete cookie'
            });
          }
          
          // Trigger sync to all controllers
          await triggerCookieSync();

          return res.status(200).json({
            success: true,
            data: { deletedCookie: cookieToDelete, domain: deleteDomain }
          });
        } else {
          // Delete entire domain
          const deleted = await cookiesRepository.delete(domainToDelete.id);
          
          if (!deleted) {
            return res.status(500).json({
              success: false,
              error: 'Failed to delete domain'
            });
          }

          // Trigger sync to all controllers
          await triggerCookieSync();

          return res.status(200).json({
            success: true,
            data: { deletedDomain: domainToDelete }
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