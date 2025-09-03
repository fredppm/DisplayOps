import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleInfo as getRoleDisplay, Role } from '@/lib/permissions';
import { User, Mail, Shield, MapPin, Calendar, AlertCircle, CheckCircle, XCircle, Edit2, Trash2 } from 'lucide-react';
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
  const { user } = useAuth();
  const { canManageUsers, getRoleInfo } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const hasInitializedRef = useRef(false);

  // Form state
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

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setEditingUser(null);
        setFormData({ email: '', name: '', password: '', role: 'viewer', sites: [] });
        loadUsers();
      } else {
        const error = await response.json();
        console.error('Failed to update user:', error.error);
      }
    } catch (error) {
      console.error('Network error');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadUsers();
      } else {
        const error = await response.json();
        console.error('Failed to delete user:', error.error);
      }
    } catch (error) {
      console.error('Network error');
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      password: '',
      role: user.role,
      sites: user.sites
    });
  };

  const availableSites = ['rio', 'nyc', 'sp']; // This should come from sites API

  if (!canManageUsers()) {
    return (
      <ProtectedRoute adminOnly>
        <div>Access denied</div>
      </ProtectedRoute>
    );
  }

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
                    <User className="-ml-0.5 mr-1.5 h-4 w-4" />
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

            {/* Users Grid Skeleton */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b">
                <div className="animate-pulse h-5 bg-gray-200 rounded w-32"></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sites</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="h-4 bg-gray-200 rounded w-24"></div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="h-4 bg-gray-200 rounded w-32"></div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="h-4 bg-gray-200 rounded w-16"></div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="h-4 bg-gray-200 rounded w-20"></div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-2">
                            <div className="h-4 bg-gray-200 rounded w-12"></div>
                            <div className="h-4 bg-gray-200 rounded w-12"></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

          {/* Edit User Form */}
          {editingUser && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Edit User: {editingUser.name}</h2>
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Password (leave blank to keep current)</label>
                    <input
                      type="password"
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
                      disabled={editingUser.id === user?.id}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="site-manager">Site Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Update User
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users List */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Users ({users.length})</h2>
            </div>
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
                    <User className="-ml-0.5 mr-1.5 h-4 w-4" />
                    Create User
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sites</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((u) => {
                      const roleInfo = getRoleDisplay(u.role as Role);
                      return (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                                  <User className="h-4 w-4 text-gray-600" />
                                </div>
                              </div>
                              <div className="font-medium text-gray-900">{u.name}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600">{u.email}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${roleInfo?.color || 'gray'}-100 text-${roleInfo?.color || 'gray'}-800`}>
                              {roleInfo?.icon} {roleInfo?.name}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600">
                                {u.sites.includes('*') ? 'All Sites' : u.sites.join(', ') || 'None'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600">
                                {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                            <button
                              onClick={() => startEdit(u)}
                              className="inline-flex items-center px-2 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit2 className="h-3 w-3 mr-1" />
                              Edit
                            </button>
                            {u.id !== user?.id && (
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="inline-flex items-center px-2 py-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}