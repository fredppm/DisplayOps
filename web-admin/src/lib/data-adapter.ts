// PostgreSQL data adapter - simplified version (JSON support removed)
import { User, AuthUser } from './auth-postgres';

import {
  loadUsersFromDB,
  saveUserToDB,
  authenticateUserFromDB,
  createUserInDB,
  getUserByIdFromDB,
  deleteUserFromDB
} from './auth-postgres';

import {
  loadControllersFromDB,
  saveControllerToDB,
  deleteControllerFromDB,
  loadSitesFromDB,
  saveSiteToDB,
  deleteSiteFromDB,
  loadDashboardsFromDB,
  saveDashboardToDB,
  deleteDashboardFromDB,
  saveAuditLogToDB,
  loadAuditLogFromDB,
  loadCookiesFromDB,
  saveCookieToDB,
  deleteCookieFromDB,
  Controller,
  Site,
  Dashboard,
  AuditLogEntry,
  Cookie,
  CookieDomain,
  CookiesData
} from './data-postgres';

// Auth functions - PostgreSQL only
export async function loadUsers(): Promise<User[]> {
  return await loadUsersFromDB();
}

export async function saveUsers(users: User[]): Promise<void> {
  // Save each user individually to DB
  for (const user of users) {
    await saveUserToDB(user);
  }
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  return await authenticateUserFromDB(email, password);
}

export async function createUser(userData: {
  email: string;
  name: string;
  password: string;
  role: 'admin' | 'site-manager' | 'viewer';
  sites: string[];
}): Promise<AuthUser> {
  return await createUserInDB(userData);
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  return await getUserByIdFromDB(userId);
}

export async function deleteUser(userId: string): Promise<boolean> {
  return await deleteUserFromDB(userId);
}

// Data functions - PostgreSQL only
export async function loadControllers(): Promise<Controller[]> {
  return await loadControllersFromDB();
}

export async function saveController(controller: Controller): Promise<void> {
  await saveControllerToDB(controller);
}

export async function deleteController(controllerId: string): Promise<boolean> {
  return await deleteControllerFromDB(controllerId);
}

export async function loadSites(): Promise<Site[]> {
  return await loadSitesFromDB();
}

export async function saveSite(site: Site): Promise<void> {
  await saveSiteToDB(site);
}

export async function deleteSite(siteId: string): Promise<boolean> {
  return await deleteSiteFromDB(siteId);
}

export async function loadDashboards(): Promise<Dashboard[]> {
  return await loadDashboardsFromDB();
}

export async function saveDashboard(dashboard: Dashboard): Promise<void> {
  await saveDashboardToDB(dashboard);
}

export async function deleteDashboard(dashboardId: string): Promise<boolean> {
  return await deleteDashboardFromDB(dashboardId);
}

export async function saveAuditLog(entry: AuditLogEntry): Promise<void> {
  await saveAuditLogToDB(entry);
}

export async function loadAuditLog(limit: number = 100): Promise<AuditLogEntry[]> {
  return await loadAuditLogFromDB(limit);
}

// Cookie functions - PostgreSQL only
export async function loadCookies(): Promise<CookiesData> {
  return await loadCookiesFromDB();
}

export async function saveCookie(domain: string, cookie: Cookie): Promise<void> {
  await saveCookieToDB(domain, cookie);
}

export async function deleteCookie(domain: string, cookieName?: string): Promise<boolean> {
  return await deleteCookieFromDB(domain, cookieName);
}

// Export types
export type { Cookie, CookieDomain, CookiesData };