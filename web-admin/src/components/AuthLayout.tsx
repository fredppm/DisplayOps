import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const { user, logout, isAdmin } = useAuth();
  const { getRoleInfo } = usePermissions();
  const router = useRouter();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  const navigation = [
    { name: 'Dashboard', href: '/' },
    { name: 'Sites', href: '/sites' },
    { name: 'Controllers', href: '/controllers' },
    ...(isAdmin() ? [{ name: 'Admin', href: '/admin' }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white">
        <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8" aria-label="Global">
          {/* Logo */}
          <div className="flex lg:flex-1">
            <Link href="/" className="-m-1.5 p-1.5">
              <span className="text-2xl font-bold text-blue-600">DisplayOps</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex lg:gap-x-12">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-semibold leading-6 transition-colors ${
                  router.pathname === item.href
                    ? 'text-blue-600'
                    : 'text-gray-900 hover:text-blue-600'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div className="hidden lg:flex lg:flex-1 lg:justify-end lg:items-center lg:gap-x-4">
            <div className="text-sm">
              <div className="text-gray-900 font-medium">{user?.name}</div>
              <div className="text-xs text-gray-500">
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-${getRoleInfo()?.color || 'gray'}-50 text-${getRoleInfo()?.color || 'gray'}-700 ring-1 ring-inset ring-${getRoleInfo()?.color || 'gray'}-600/20`}>
                  {getRoleInfo()?.name}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm font-semibold leading-6 text-gray-900 hover:text-blue-600"
            >
              Log out
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex lg:hidden">
            <button
              type="button"
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
            >
              <span className="sr-only">Open main menu</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>
        </nav>

        {/* Mobile navigation menu */}
        <div className="lg:hidden">
          <div className="space-y-2 py-6 px-6 border-t border-gray-200">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 transition-colors ${
                  router.pathname === item.href
                    ? 'bg-gray-50 text-blue-600'
                    : 'text-gray-900 hover:bg-gray-50'
                }`}
              >
                {item.name}
              </Link>
            ))}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-semibold text-gray-900">{user?.name}</div>
                  <div className="text-sm text-gray-500">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-${getRoleInfo()?.color || 'gray'}-50 text-${getRoleInfo()?.color || 'gray'}-700 ring-1 ring-inset ring-${getRoleInfo()?.color || 'gray'}-600/20`}>
                      {getRoleInfo()?.name}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-base font-semibold text-gray-900 hover:text-blue-600"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}