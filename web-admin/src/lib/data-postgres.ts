import { db } from './database';

// Types matching the existing JSON structure
export interface Controller {
  id: string;
  name: string;
  localNetwork?: string;
  mdnsService?: string;
  controllerUrl?: string;
  status: 'online' | 'offline' | 'maintenance' | 'error';
  lastSync?: string;
  version?: string;
}

export interface Site {
  id: string;
  name: string;
  location?: string;
  timezone: string;
  status: 'online' | 'offline' | 'maintenance';
  controllers: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Dashboard {
  id: string;
  name: string;
  url: string;
  siteId?: string;
  controllerId?: string;
  status: 'active' | 'inactive' | 'maintenance';
  config?: any;
}

export interface AuditLogEntry {
  id?: string;
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: string;
}

// Controllers CRUD operations
export async function loadControllersFromDB(): Promise<Controller[]> {
  try {
    const result = await db.query(`
      SELECT id, name, local_network as "localNetwork", mdns_service as "mdnsService",
             controller_url as "controllerUrl", status, last_sync as "lastSync", version
      FROM controllers 
      ORDER BY name ASC
    `);
    
    return result.rows.map((row: any) => ({
      ...row,
      lastSync: row.lastSync?.toISOString()
    }));
  } catch (error) {
    console.error('Error loading controllers from database:', error);
    throw new Error('Failed to load controllers');
  }
}

export async function saveControllerToDB(controller: Controller): Promise<void> {
  try {
    const existing = await db.query('SELECT id FROM controllers WHERE id = $1', [controller.id]);
    
    if (existing.rows.length > 0) {
      // Update existing controller
      await db.query(`
        UPDATE controllers 
        SET name = $2, local_network = $3, mdns_service = $4, controller_url = $5, 
            status = $6, last_sync = $7, version = $8, updated_at = NOW()
        WHERE id = $1
      `, [
        controller.id, controller.name, controller.localNetwork, controller.mdnsService,
        controller.controllerUrl, controller.status, 
        controller.lastSync ? new Date(controller.lastSync) : null, controller.version
      ]);
    } else {
      // Insert new controller
      await db.query(`
        INSERT INTO controllers (id, name, local_network, mdns_service, controller_url, 
                               status, last_sync, version, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        controller.id, controller.name, controller.localNetwork, controller.mdnsService,
        controller.controllerUrl, controller.status,
        controller.lastSync ? new Date(controller.lastSync) : null, controller.version
      ]);
    }
  } catch (error) {
    console.error('Error saving controller to database:', error);
    throw new Error('Failed to save controller');
  }
}

export async function deleteControllerFromDB(controllerId: string): Promise<boolean> {
  try {
    const result = await db.query('DELETE FROM controllers WHERE id = $1', [controllerId]);
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting controller:', error);
    return false;
  }
}

// Sites CRUD operations
export async function loadSitesFromDB(): Promise<Site[]> {
  try {
    const result = await db.query(`
      SELECT id, name, location, timezone, status, controllers,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM sites 
      ORDER BY name ASC
    `);
    
    return result.rows.map((row: any) => ({
      ...row,
      createdAt: row.createdAt?.toISOString(),
      updatedAt: row.updatedAt?.toISOString()
    }));
  } catch (error) {
    console.error('Error loading sites from database:', error);
    throw new Error('Failed to load sites');
  }
}

export async function saveSiteToDB(site: Site): Promise<void> {
  try {
    const existing = await db.query('SELECT id FROM sites WHERE id = $1', [site.id]);
    
    if (existing.rows.length > 0) {
      // Update existing site
      await db.query(`
        UPDATE sites 
        SET name = $2, location = $3, timezone = $4, status = $5, controllers = $6, updated_at = NOW()
        WHERE id = $1
      `, [
        site.id, site.name, site.location, site.timezone, site.status, site.controllers
      ]);
    } else {
      // Insert new site
      await db.query(`
        INSERT INTO sites (id, name, location, timezone, status, controllers, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        site.id, site.name, site.location, site.timezone, site.status, site.controllers,
        site.createdAt ? new Date(site.createdAt) : new Date()
      ]);
    }
  } catch (error) {
    console.error('Error saving site to database:', error);
    throw new Error('Failed to save site');
  }
}

export async function deleteSiteFromDB(siteId: string): Promise<boolean> {
  try {
    const result = await db.query('DELETE FROM sites WHERE id = $1', [siteId]);
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting site:', error);
    return false;
  }
}

// Dashboards CRUD operations
export async function loadDashboardsFromDB(): Promise<Dashboard[]> {
  try {
    const result = await db.query(`
      SELECT id, name, url, site_id as "siteId", controller_id as "controllerId", 
             status, config
      FROM dashboards 
      ORDER BY name ASC
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error loading dashboards from database:', error);
    throw new Error('Failed to load dashboards');
  }
}

export async function saveDashboardToDB(dashboard: Dashboard): Promise<void> {
  try {
    const existing = await db.query('SELECT id FROM dashboards WHERE id = $1', [dashboard.id]);
    
    if (existing.rows.length > 0) {
      // Update existing dashboard
      await db.query(`
        UPDATE dashboards 
        SET name = $2, url = $3, site_id = $4, controller_id = $5, status = $6, 
            config = $7, updated_at = NOW()
        WHERE id = $1
      `, [
        dashboard.id, dashboard.name, dashboard.url, dashboard.siteId, 
        dashboard.controllerId, dashboard.status, JSON.stringify(dashboard.config || {})
      ]);
    } else {
      // Insert new dashboard
      await db.query(`
        INSERT INTO dashboards (id, name, url, site_id, controller_id, status, config, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        dashboard.id, dashboard.name, dashboard.url, dashboard.siteId, 
        dashboard.controllerId, dashboard.status, JSON.stringify(dashboard.config || {})
      ]);
    }
  } catch (error) {
    console.error('Error saving dashboard to database:', error);
    throw new Error('Failed to save dashboard');
  }
}

export async function deleteDashboardFromDB(dashboardId: string): Promise<boolean> {
  try {
    const result = await db.query('DELETE FROM dashboards WHERE id = $1', [dashboardId]);
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting dashboard:', error);
    return false;
  }
}

// Audit log operations
export async function saveAuditLogToDB(entry: AuditLogEntry): Promise<void> {
  try {
    await db.query(`
      INSERT INTO audit_log (user_id, action, resource, resource_id, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      entry.userId, entry.action, entry.resource, entry.resourceId,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.ipAddress, entry.userAgent
    ]);
  } catch (error) {
    console.error('Error saving audit log entry:', error);
    throw new Error('Failed to save audit log');
  }
}

export async function loadAuditLogFromDB(limit: number = 100): Promise<AuditLogEntry[]> {
  try {
    const result = await db.query(`
      SELECT id, user_id as "userId", action, resource, resource_id as "resourceId",
             details, ip_address as "ipAddress", user_agent as "userAgent",
             timestamp
      FROM audit_log 
      ORDER BY timestamp DESC 
      LIMIT $1
    `, [limit]);
    
    return result.rows.map((row: any) => ({
      ...row,
      timestamp: row.timestamp.toISOString(),
      details: row.details ? JSON.parse(row.details) : null
    }));
  } catch (error) {
    console.error('Error loading audit log from database:', error);
    throw new Error('Failed to load audit log');
  }
}

// Migration utility functions
export async function migrateJSONDataToDB(): Promise<void> {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Load existing JSON data if files exist
    const dataDir = path.join(process.cwd(), 'data');
    
    // Migrate users
    const usersFile = path.join(dataDir, 'users.json');
    if (fs.existsSync(usersFile)) {
      const usersData = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
      for (const user of usersData.users || []) {
        await db.query(`
          INSERT INTO users (id, email, name, password, role, sites, created_at, last_login)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            password = EXCLUDED.password,
            role = EXCLUDED.role,
            sites = EXCLUDED.sites,
            last_login = EXCLUDED.last_login
        `, [
          user.id, user.email, user.name, user.password, user.role, user.sites,
          new Date(user.createdAt), user.lastLogin ? new Date(user.lastLogin) : null
        ]);
      }
      console.log('Migrated users to PostgreSQL');
    }
    
    // Migrate controllers
    const controllersFile = path.join(dataDir, 'controllers.json');
    if (fs.existsSync(controllersFile)) {
      const controllersData = JSON.parse(fs.readFileSync(controllersFile, 'utf-8'));
      for (const controller of controllersData.controllers || []) {
        await db.query(`
          INSERT INTO controllers (id, name, local_network, mdns_service, controller_url, 
                                 status, last_sync, version, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            local_network = EXCLUDED.local_network,
            controller_url = EXCLUDED.controller_url,
            status = EXCLUDED.status,
            last_sync = EXCLUDED.last_sync,
            version = EXCLUDED.version
        `, [
          controller.id, controller.name, controller.localNetwork, controller.mdnsService,
          controller.controllerUrl, controller.status,
          controller.lastSync ? new Date(controller.lastSync) : null, controller.version
        ]);
      }
      console.log('Migrated controllers to PostgreSQL');
    }
    
    // Migrate sites
    const sitesFile = path.join(dataDir, 'sites.json');
    if (fs.existsSync(sitesFile)) {
      const sitesData = JSON.parse(fs.readFileSync(sitesFile, 'utf-8'));
      for (const site of sitesData.sites || []) {
        await db.query(`
          INSERT INTO sites (id, name, location, timezone, status, controllers, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            location = EXCLUDED.location,
            timezone = EXCLUDED.timezone,
            status = EXCLUDED.status,
            controllers = EXCLUDED.controllers,
            updated_at = EXCLUDED.updated_at
        `, [
          site.id, site.name, site.location, site.timezone, site.status, site.controllers,
          site.createdAt ? new Date(site.createdAt) : new Date(),
          site.updatedAt ? new Date(site.updatedAt) : new Date()
        ]);
      }
      console.log('Migrated sites to PostgreSQL');
    }
    
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Cookie types and functions
export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  expirationDate: number;
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

// Cookies CRUD operations
export async function loadCookiesFromDB(): Promise<CookiesData> {
  try {
    const result = await db.query(`
      SELECT domain, name, value, path, secure, http_only as "httpOnly", 
             same_site as "sameSite", expiration_date as "expirationDate", 
             description, created_at, updated_at
      FROM cookies 
      ORDER BY domain, name
    `);
    
    // Group cookies by domain
    const domains: { [domain: string]: CookieDomain } = {};
    
    result.rows.forEach((row: any) => {
      if (!domains[row.domain]) {
        domains[row.domain] = {
          domain: row.domain,
          description: `Cookies for ${row.domain}`,
          cookies: [],
          lastUpdated: row.updated_at?.toISOString() || row.created_at?.toISOString()
        };
      }
      
      domains[row.domain].cookies.push({
        name: row.name,
        value: row.value,
        domain: row.domain,
        path: row.path,
        secure: row.secure,
        httpOnly: row.httpOnly,
        sameSite: row.sameSite,
        expirationDate: row.expirationDate,
        description: row.description
      });
      
      // Update the domain's lastUpdated to the most recent cookie
      const cookieUpdated = row.updated_at?.toISOString() || row.created_at?.toISOString();
      if (cookieUpdated > domains[row.domain].lastUpdated) {
        domains[row.domain].lastUpdated = cookieUpdated;
      }
    });
    
    return {
      domains,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error loading cookies from database:', error);
    throw new Error('Failed to load cookies');
  }
}

export async function saveCookieToDB(domainName: string, cookie: Cookie): Promise<void> {
  try {
    await db.query(`
      INSERT INTO cookies (domain, name, value, path, secure, http_only, same_site, 
                          expiration_date, description, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (domain, name) DO UPDATE SET
        value = EXCLUDED.value,
        path = EXCLUDED.path,
        secure = EXCLUDED.secure,
        http_only = EXCLUDED.http_only,
        same_site = EXCLUDED.same_site,
        expiration_date = EXCLUDED.expiration_date,
        description = EXCLUDED.description,
        updated_at = NOW()
    `, [
      domainName, cookie.name, cookie.value, cookie.path, cookie.secure,
      cookie.httpOnly, cookie.sameSite, cookie.expirationDate, cookie.description
    ]);
  } catch (error) {
    console.error('Error saving cookie to database:', error);
    throw new Error('Failed to save cookie');
  }
}

export async function deleteCookieFromDB(domain: string, cookieName?: string): Promise<boolean> {
  try {
    let result;
    if (cookieName) {
      // Delete specific cookie
      result = await db.query('DELETE FROM cookies WHERE domain = $1 AND name = $2', [domain, cookieName]);
    } else {
      // Delete all cookies for domain
      result = await db.query('DELETE FROM cookies WHERE domain = $1', [domain]);
    }
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting cookie from database:', error);
    return false;
  }
}