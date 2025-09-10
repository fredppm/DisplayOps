import { useState, useEffect } from 'react';
import { NextPage, GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  User, 
  Mail, 
  Shield, 
  MapPin,
  Calendar,
  AlertTriangle 
} from 'lucide-react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToastContext } from '@/contexts/ToastContext';
import { useToastStore } from '@/stores/toastStore';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'site-manager' | 'viewer';
  sites: string[];
  createdAt: string;
  lastLogin: string | null;
}

interface UserDetailsPageProps {
  user: User | null;
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  user: User;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ 
  isOpen, 
  user, 
  onConfirm, 
  onCancel, 
  isDeleting 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Confirm Deletion</h3>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-3">
            Are you sure you want to delete the user <strong>{user.name}</strong> ({user.email})?
          </p>
          
          <p className="text-sm text-gray-600">
            This action cannot be undone.
          </p>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 flex items-center"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete User
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const UserDetailsPage: NextPage<UserDetailsPageProps> = ({ user: initialUser }) => {
  const router = useRouter();
  const toast = useToastContext();
  const { addPendingToast } = useToastStore();
  const [user, setUser] = useState<User | null>(initialUser);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'viewer' as 'admin' | 'site-manager' | 'viewer',
    sites: user?.sites || []
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
        sites: user.sites
      });
    }
  }, [user]);

  const availableSites = ['rio', 'nyc', 'sp']; // This should come from sites API

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUser(data.user);
        setIsEditing(false);
        toast.success('User updated successfully!');
      } else {
        toast.error('Error saving changes', data.error);
      }
    } catch (err: any) {
      toast.error('Network error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!user) return;
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Adiciona toast pendente no Zustand
        addPendingToast({
          type: 'success',
          message: 'User deleted successfully!'
        });
        
        // Navega para listagem
        router.push('/admin/users');
      } else {
        toast.error('Error deleting user', data.error);
        setShowDeleteModal(false);
      }
    } catch (err: any) {
      toast.error('Network error', err.message);
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleColor = (role: string) => {
    return 'bg-gray-100 text-gray-700';
  };

  if (!user) {
    return (
      <ProtectedRoute adminOnly>
        <Layout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User not found</h2>
              <p className="mt-2 text-gray-600">The user you're looking for doesn't exist.</p>
              <Link
                href="/admin/users"
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Back to Users
              </Link>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute adminOnly>
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="border-b border-gray-200 pb-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center mb-2">
                  <Link
                    href="/admin/users"
                    className="mr-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <ArrowLeft className="h-6 w-6" />
                  </Link>
                  <h1 className="text-2xl font-bold leading-7 text-gray-900 dark:text-gray-100 dark:text-gray-100 sm:truncate sm:text-3xl sm:tracking-tight">
                    {isEditing ? 'Edit User' : user.name}
                  </h1>
                </div>
              </div>
              <div className="ml-6 flex flex-shrink-0 space-x-3">
                {!isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      className="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-500"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setFormData({
                          name: user.name,
                          email: user.email,
                          password: '',
                          role: user.role,
                          sites: user.sites
                        });
                      }}
                      className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* User Information */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-4">
                    User Information
                  </h3>
                  
                  <form className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Full Name
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="block w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            placeholder="Enter full name"
                            required
                          />
                        ) : (
                          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Mail className="h-4 w-4 inline mr-2" />
                          Email Address
                        </label>
                        {isEditing ? (
                          <input
                            type="email"
                            id="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="block w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            placeholder="Enter email address"
                            required
                          />
                        ) : (
                          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.email}</p>
                          </div>
                        )}
                      </div>

                      {isEditing && (
                        <div>
                          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Password (leave blank to keep current)
                          </label>
                          <input
                            type="password"
                            id="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="block w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            placeholder="Enter new password"
                          />
                        </div>
                      )}
                      
                      <div>
                        <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Shield className="h-4 w-4 inline mr-2" />
                          Role
                        </label>
                        {isEditing ? (
                          <select
                            id="role"
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                            className="block w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="site-manager">Site Manager</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                              {user.role.replace('-', ' ')}
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <MapPin className="h-4 w-4 inline mr-2" />
                          Site Access
                        </label>
                        {isEditing ? (
                          <div className="space-y-2">
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
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span className="ml-2 text-sm text-gray-900 dark:text-gray-100 capitalize">{site}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {user.sites.includes('*') ? 'All Sites' : user.sites.join(', ') || 'No access'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-4">
                  Account Information
                </h3>
                
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">User ID</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono">{user.id}</dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created At</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                      {new Date(user.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Login</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Never'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          user={user}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteModal(false)}
          isDeleting={isDeleting}
        />
      </Layout>
    </ProtectedRoute>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ params, req }) => {
  try {
    const userId = params?.id as string;
    
    if (!userId) {
      return {
        notFound: true,
      };
    }
    
    // Get the port from the request headers
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || 'localhost:3001';
    
    // Forward the auth cookies from the browser request
    const cookieHeader = req.headers.cookie || '';
    
    // Fetch user data with proper authentication forwarding
    const response = await fetch(`${protocol}://${host}/api/users/${userId}`, {
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': req.headers['user-agent'] || ''
      }
    });
    
    if (!response.ok) {
      return {
        notFound: true,
      };
    }
    
    const data = await response.json();
    const user = data.user;
    
    if (!user) {
      return {
        notFound: true,
      };
    }
    
    return {
      props: {
        user,
      },
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    
    return {
      props: {
        user: null,
      },
    };
  }
};

export default UserDetailsPage;