import { useState } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save, 
  Monitor, 
  CheckCircle,
  XCircle,
  Globe,
  AlertCircle
} from 'lucide-react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToastContext } from '@/contexts/ToastContext';
import { useToastStore } from '@/stores/toastStore';

const NewDashboardPage: NextPage = () => {
  const router = useRouter();
  const toast = useToastContext();
  const { addPendingToast } = useToastStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    refreshInterval: 300,
    category: 'Custom',
    requiresAuth: false
  });

  // Simple URL validation function
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.url.trim()) {
      toast.error('Dashboard name and URL are required');
      return;
    }

    if (!isValidUrl(formData.url)) {
      toast.error('Please provide a valid URL (must start with http:// or https://)');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/dashboards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Adiciona toast pendente no Zustand
        addPendingToast({
          type: 'success',
          message: 'Dashboard created successfully!'
        });
        
        // Navega para listagem
        router.push('/dashboards');
      } else {
        toast.error('Error creating dashboard', data.error || 'Unknown error occurred');
      }
    } catch (err: any) {
      toast.error('Network error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center mb-2">
                  <Link
                    href="/dashboards"
                    className="mr-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <ArrowLeft className="h-6 w-6" />
                  </Link>
                  <h1 className="text-2xl font-bold leading-7 text-gray-900 dark:text-gray-100 sm:truncate sm:text-3xl sm:tracking-tight">
                    Create New Dashboard
                  </h1>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Add a new dashboard to display on controllers and display devices
                </p>
              </div>
              <div className="ml-6 flex flex-shrink-0">
                <Link
                  href="/dashboards"
                  className="inline-flex items-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Dashboard Information */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 mb-4">
                    Dashboard Information
                  </h3>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          Dashboard Name <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="block w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            placeholder="Enter dashboard name"
                            required
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          <Globe className="h-4 w-4 inline mr-2" />
                          Dashboard URL <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="url"
                            id="url"
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                            className="block w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                            placeholder="https://example.com/dashboard"
                            required
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          Description
                        </label>
                        <div className="relative">
                          <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="block w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            placeholder="Dashboard description"
                            rows={3}
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="refreshInterval" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            Refresh Interval (seconds)
                          </label>
                          <input
                            type="number"
                            id="refreshInterval"
                            min="30"
                            max="3600"
                            value={formData.refreshInterval}
                            onChange={(e) => setFormData({ ...formData, refreshInterval: parseInt(e.target.value) || 300 })}
                            className="block w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            disabled={isSubmitting}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            Category
                          </label>
                          <select
                            id="category"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="block w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            disabled={isSubmitting}
                          >
                            <option value="Custom">Custom</option>
                            <option value="Analytics">Analytics</option>
                            <option value="Monitoring">Monitoring</option>
                            <option value="Business">Business</option>
                            <option value="Development">Development</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="flex items-start p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.requiresAuth}
                            onChange={(e) => setFormData({ ...formData, requiresAuth: e.target.checked })}
                            className="mt-1 mr-3"
                            disabled={isSubmitting}
                          />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                              <AlertCircle className="w-4 h-4 mr-2 text-yellow-600 dark:text-yellow-400" />
                              Requires Authentication
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Dashboard needs login credentials to display properly
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Form Actions */}
                    <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex justify-end space-x-3">
                        <Link
                          href="/dashboards"
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                          Cancel
                        </Link>
                        <button
                          type="submit"
                          disabled={isSubmitting || !formData.name.trim() || !formData.url.trim() || !isValidUrl(formData.url)}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSubmitting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Creating...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Create Dashboard
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Getting Started
                </h3>
                
                <div className="space-y-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Dashboard Creation</h4>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Fill out the basic dashboard information to get started
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <div className="h-5 w-5 rounded-full bg-gray-200 dark:bg-gray-600 mt-0.5 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">2</span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Deploy to Controllers</h4>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Assign dashboard to controllers for display
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <div className="h-5 w-5 rounded-full bg-gray-200 dark:bg-gray-600 mt-0.5 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">3</span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Monitor Performance</h4>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Track dashboard loading and refresh metrics
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Tips & Requirements</h4>
                  <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
                    <li className="flex items-start">
                      <span className="text-red-500 mr-2">•</span>
                      Dashboard name and URL are required
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      Use HTTPS URLs when possible for better security
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">•</span>
                      Refresh interval affects network usage
                    </li>
                    <li className="flex items-start">
                      <span className="text-yellow-500 mr-2">•</span>
                      Enable auth only if dashboard requires login
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default NewDashboardPage;