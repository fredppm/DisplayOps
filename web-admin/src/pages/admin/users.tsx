import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { usePermissions } from '@/hooks/usePermissions';
import { getRoleInfo as getRoleDisplay, Role } from '@/lib/permissions';
import { User, Mail, Shield, MapPin, Calendar, AlertCircle, CheckCircle, XCircle, ChevronRight, Plus } from 'lucide-react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'site-manager' | 'viewer';
  sites: string[];
  createdAt: string;
  lastLogin: string | null;
}

export default function UsersPage() {
  const { getRoleInfo } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const hasInitializedRef = useRef(false);

  // Form state for creating new users
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    role: 'viewer' as 'admin' | 'site-manager' | 'viewer',
    sites: [] as string[]
  });

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      loadUsers();
    }
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (response.ok && data.users) {
        setUsers(data.users);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch users');
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowCreateForm(false);
        setFormData({ email: '', name: '', password: '', role: 'viewer', sites: [] });
        loadUsers();
      } else {
        const error = await response.json();
        console.error('Failed to create user:', error.error);
      }
    } catch (error) {
      console.error('Network error');
    }
  };


  const availableSites = ['rio', 'nyc', 'sp']; // This should come from sites API


  if (loading) {
    return (
      <ProtectedRoute adminOnly>
        <Layout>
          <Head>
            <title>User Management - DisplayOps</title>
          </Head>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header Real */}
            <div className="pb-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center mb-2">
                    <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                      User Management
                    </h1>
                    <span className="ml-3 inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-400 ring-1 ring-inset ring-gray-200">
                      Loading...
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 max-w-2xl">
                    Manage users and their access to DisplayOps sites. Control permissions and monitor activity.
                  </p>
                </div>
                <div className="ml-6 flex flex-shrink-0">
                  <button
                    disabled
                    className="inline-flex items-center rounded-md bg-blue-400 px-3 py-2 text-sm font-medium text-white shadow-sm cursor-not-allowed"
                  >
                    <Plus className="-ml-0.5 mr-1.5 h-4 w-4" />
                    Create User
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Skeleton */}
            <div className="mb-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4">
                <div className="animate-pulse flex items-center space-x-8">
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-18"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Users List Skeleton */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-300">
              <ul role="list" className="divide-y divide-gray-200">
                {[1, 2, 3, 4, 5].map((i) => (
                  <li key={i}>
                    <div className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center min-w-0 flex-1">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
                          </div>
                          <div className="min-w-0 flex-1 px-4">
                            <div className="animate-pulse">
                              <div className="flex items-center space-x-2 mb-2">
                                <div className="h-4 bg-gray-200 rounded w-32"></div>
                                <div className="h-5 bg-gray-200 rounded w-16"></div>
                              </div>
                              <div className="flex items-center">
                                <div className="h-4 w-4 bg-gray-200 rounded mr-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-48"></div>
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="flex items-center space-x-6 animate-pulse">
                                <div className="flex items-center">
                                  <div className="h-4 w-4 bg-gray-200 rounded mr-2"></div>
                                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                                </div>
                                <div className="flex items-center">
                                  <div className="h-4 w-4 bg-gray-200 rounded mr-2"></div>
                                  <div className="h-3 bg-gray-200 rounded w-32"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-4">
                          <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute adminOnly>
        <Layout>
          <Head>
            <title>User Management - DisplayOps</title>
          </Head>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center">
                <XCircle className="h-6 w-6 text-red-500 mr-2" />
                <h3 className="text-lg font-medium text-red-800">Error Loading Users</h3>
              </div>
              <p className="mt-2 text-red-700">{error}</p>
              <button
                onClick={loadUsers}
                className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute adminOnly>
      <Layout>
        <Head>
          <title>User Management - DisplayOps</title>
        </Head>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="pb-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center mb-2">
                  <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                    User Management
                  </h1>
                  <span className="ml-3 inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                    {users.length} {users.length === 1 ? 'user' : 'users'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 max-w-2xl">
                  Manage users and their access to DisplayOps sites. Control permissions and monitor activity.
                </p>
              </div>
              <div className="ml-6 flex flex-shrink-0">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
                >
                  <User className="-ml-0.5 mr-1.5 h-4 w-4" />
                  Create User
                </button>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4">
              <div className="flex items-center space-x-8">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Total: <span className="font-semibold text-gray-900">{users.length}</span></span>
                </div>
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-gray-600">Admins: <span className="font-semibold text-blue-700">{users.filter(u => u.role === 'admin').length}</span></span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-600">Site Managers: <span className="font-semibold text-green-700">{users.filter(u => u.role === 'site-manager').length}</span></span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-600">Active: <span className="font-semibold text-green-700">{users.filter(u => u.lastLogin).length}</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* Create User Form */}
          {showCreateForm && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Create New User</h2>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="site-manager">Site Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Sites Access</label>
                  <div className="mt-2 space-y-2">
                    {availableSites.map(site => (
                      <label key={site} className="inline-flex items-center mr-4">
                        <input
                          type="checkbox"
                          checked={formData.sites.includes(site)}
                          onChange={(e) => {
                            const newSites = e.target.checked
                              ? [...formData.sites, site]
                              : formData.sites.filter(s => s !== site);
                            setFormData({ ...formData, sites: newSites });
                          }}
                          className="form-checkbox"
                        />
                        <span className="ml-2 capitalize">{site}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Create User
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}


          {/* Users List */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-300">
            {users.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <User className="h-6 w-6 text-gray-600" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-gray-900">No Users</h3>
                <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
                  Get started by creating your first user to manage access to DisplayOps.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500"
                  >
                    <Plus className="-ml-0.5 mr-1.5 h-4 w-4" />
                    Create User
                  </button>
                </div>
              </div>
            ) : (
              <ul role="list" className="divide-y divide-gray-200">
                {users.map((u) => (
                  <li key={u.id} className="relative">
                    <Link href={`/admin/users/${u.id}`} className="absolute inset-0 focus:outline-none">
                      <span className="sr-only">View {u.name}</span>
                    </Link>
                    <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center min-w-0 flex-1">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="h-5 w-5 text-gray-600" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1 px-4">
                            <div>
                              <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {u.name}
                                </p>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                  {u.role.replace('-', ' ')}
                                </span>
                              </div>
                              <div className="flex items-center mt-1">
                                <Mail className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                <p className="text-sm text-gray-500 truncate">{u.email}</p>
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="flex items-center text-sm text-gray-500 space-x-6">
                                <div className="flex items-center">
                                  <MapPin className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                  <span className="truncate">
                                    {u.sites.includes('*') ? 'All Sites' : u.sites.join(', ') || 'No access'}
                                  </span>
                                </div>
                                <div className="flex items-center">
                                  <Calendar className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                  <span>
                                    Last login: {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-4">
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}