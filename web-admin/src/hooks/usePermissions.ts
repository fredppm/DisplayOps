import { useAuth } from '@/contexts/AuthContext';
import { 
  Permission, 
  hasPermission, 
  hasSitePermission, 
  getAccessibleSites,
  canManageUsers,
  canAccessAdmin,
  validateAction,
  getRoleInfo
} from '@/lib/permissions';

export function usePermissions() {
  const { user } = useAuth();

  const checkPermission = (permission: Permission) => {
    if (!user) return false;
    return hasPermission(user, permission);
  };

  const checkSitePermission = (siteId: string, permission: Permission) => {
    if (!user) return false;
    return hasSitePermission(user, siteId, permission);
  };

  const getAccessibleSitesList = (allSites: string[]) => {
    if (!user) return [];
    return getAccessibleSites(user, allSites);
  };

  const canManageUsersCheck = () => {
    if (!user) return false;
    return canManageUsers(user);
  };

  const canAccessAdminCheck = () => {
    if (!user) return false;
    return canAccessAdmin(user);
  };

  const validateUserAction = (
    action: Permission,
    resource?: { siteId?: string }
  ) => {
    if (!user) return { allowed: false, reason: 'Not authenticated' };
    return validateAction(user, action, resource);
  };

  const getUserRoleInfo = () => {
    if (!user) return null;
    return getRoleInfo(user.role as any);
  };

  return {
    user,
    checkPermission,
    checkSitePermission,
    getAccessibleSites: getAccessibleSitesList,
    canManageUsers: canManageUsersCheck,
    canAccessAdmin: canAccessAdminCheck,
    validateAction: validateUserAction,
    getRoleInfo: getUserRoleInfo
  };
}