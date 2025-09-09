import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronDownIcon, UserCircleIcon } from 'lucide-react';
import { ToastProvider } from '@/contexts/ToastContext';
import ThemeToggle from '@/components/ThemeToggle';
import { SyncAlertManager, createSyncAlert } from '@/components/SyncAlert';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminStatus } from '@/contexts/AdminStatusContext';

interface LayoutProps {
  children: React.ReactNode;
}

const LayoutContent: React.FC<LayoutProps> = ({ children }) => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isSystemDropdownOpen, setIsSystemDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [syncAlerts, setSyncAlerts] = useState<any[]>([]);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const systemDropdownRef = useRef<HTMLDivElement>(null);
  
  // Use SSE for sync monitoring instead of polling
  const { status: sseStatus, alerts: sseAlerts } = useAdminStatus();

  const isActiveRoute = (path: string): boolean => {
    return router.pathname.startsWith(path);
  };

  // Generate alerts from SSE data
  useEffect(() => {
    if (!sseStatus) return;
    
    const newAlerts: any[] = [...sseAlerts];

    // Check for controllers with pending syncs from SSE data
    sseStatus.sync.controllers.forEach((controller: any) => {
      const pendingSyncs: string[] = [];
      if (controller.dashboardSync.pending) pendingSyncs.push('Dashboards');
      if (controller.cookieSync.pending) pendingSyncs.push('Cookies');
      
      if (pendingSyncs.length > 0) {
        newAlerts.push({
          id: `controller-sync-${controller.controllerId}-${Date.now()}`,
          type: 'warning',
          title: `${controller.name} Sync Pending`,
          message: `Pending sync: ${pendingSyncs.join(', ')}`,
          timestamp: new Date().toISOString(),
          controllerId: controller.controllerId,
          autoHide: false,
          persist: true
        });
      }
    });

    setSyncAlerts(newAlerts);
  }, [sseStatus, sseAlerts]);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
      if (systemDropdownRef.current && !systemDropdownRef.current.contains(event.target as Node)) {
        setIsSystemDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  const navigationItems = [
    { name: 'Sites', href: '/sites', current: isActiveRoute('/sites') },
    { name: 'Controllers', href: '/controllers', current: isActiveRoute('/controllers') },
    { name: 'Dashboards', href: '/dashboards', current: isActiveRoute('/dashboards') },
    { name: 'Cookies', href: '/cookies', current: isActiveRoute('/cookies') },
  ];

  const isUserAdmin = user?.role === 'admin';

  const adminMenuItems = [
    { name: 'Users', href: '/admin/users' },
  ];

  const systemMenuItems = [
    { name: 'System Health', href: '/admin/health' },
    { name: 'Metrics', href: '/admin/metrics' },
    { name: 'Alerts', href: '/admin/alerts' },
    { name: 'Monitoring', href: '/admin/monitoring' },
  ];

  const allAdminItems = [...adminMenuItems, ...systemMenuItems];
  const isAdminActive = allAdminItems.some(item => isActiveRoute(item.href));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Compact Header */}
      <header className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-sm border-b border-gray-200/60 dark:border-gray-800/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-12 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <img 
                  src="/icon-idle-128.png" 
                  alt="DisplayOps" 
                  className="h-7 w-7"
                />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex md:space-x-8">
              {navigationItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium transition-colors rounded-md ${
                    item.current
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              
              {/* Admin Dropdown - Only show for admins */}
              {isUserAdmin && (
                <div className="relative" ref={systemDropdownRef}>
                  <button 
                    onClick={() => setIsSystemDropdownOpen(!isSystemDropdownOpen)}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium transition-colors rounded-md ${
                      isAdminActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    Admin
                    <ChevronDownIcon className="ml-1 h-4 w-4" />
                  </button>
                {isSystemDropdownOpen && (
                  <div className="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-700 focus:outline-none">
                    <div className="py-1">
                      {/* Admin Items */}
                      {adminMenuItems.map((item) => (
                        <Link 
                          key={item.name}
                          href={item.href}
                          onClick={() => setIsSystemDropdownOpen(false)}
                          className={`block px-4 py-2 text-sm transition-colors ${
                            isActiveRoute(item.href)
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                          }`}
                        >
                          {item.name}
                        </Link>
                      ))}
                      
                      {/* System Section */}
                      <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        System
                      </div>
                      {systemMenuItems.map((item) => (
                        <Link 
                          key={item.name}
                          href={item.href}
                          onClick={() => setIsSystemDropdownOpen(false)}
                          className={`block px-6 py-2 text-sm transition-colors ${
                            isActiveRoute(item.href)
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                          }`}
                        >
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              )}
            </nav>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Theme Toggle */}
              <ThemeToggle />
              {/* User menu */}
              <div className="relative" ref={userDropdownRef}>
                <button 
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  <UserCircleIcon className="h-5 w-5" />
                  <span className="hidden sm:block">{user?.name || 'User'}</span>
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
                {isUserDropdownOpen && (
                  <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-700 focus:outline-none">
                    <div className="py-1">
                      <button 
                        onClick={async () => {
                          setIsUserDropdownOpen(false);
                          await logout();
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 md:hidden transition-colors"
              >
                <span className="sr-only">Open main menu</span>
                {isMobileMenuOpen ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="space-y-1 px-2 pb-3 pt-2 sm:px-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
              {navigationItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block rounded-md px-3 py-2 text-base font-medium transition-colors ${
                    item.current
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              
              {/* Mobile Admin Menu - Only show for admins */}
              {isUserAdmin && (
                <div className="space-y-1">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Admin
                  </div>
                  {adminMenuItems.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`block rounded-md px-6 py-2 text-base font-medium transition-colors ${
                        isActiveRoute(item.href)
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      {item.name}
                    </Link>
                  ))}
                  
                  {/* System subsection in mobile */}
                  <div className="px-6 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    System
                  </div>
                  {systemMenuItems.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`block rounded-md px-8 py-2 text-base font-medium transition-colors ${
                        isActiveRoute(item.href)
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="py-6">
          {children}
        </div>
      </main>

      {/* Global Sync Alert Manager */}
      <SyncAlertManager 
        alerts={syncAlerts}
        maxAlerts={3}
        position="top-right"
      />
    </div>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <ToastProvider>
      <LayoutContent>{children}</LayoutContent>
    </ToastProvider>
  );
};

export default Layout;